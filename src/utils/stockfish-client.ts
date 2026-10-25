/**
 * Stockfish 19 Lite (WASM, single-thread) berjalan di Web Worker di browser pengguna.
 * HANYA untuk dipakai di client component / kode browser.
 *
 * Syarat file di /public:
 *   public/engines/stockfish/stockfish-19-lite-single.js
 *   public/engines/stockfish/stockfish-19-lite-single.wasm   (nama dasar sama dengan .js)
 * Build single-thread tidak butuh SharedArrayBuffer / header COOP-COEP.
 */
import { Chess } from 'chess.js';

export const ENGINE_URL = '/engines/stockfish/stockfish-19-lite-single.js';
export const CACHE_API = '/api/eval-cache';

/* ------------------------------ Tipe ------------------------------ */
export interface RawLine {
  rank: number;
  cp: number;      // sudut pandang PUTIH
  mate?: number;   // sudut pandang PUTIH
  pv: string[];    // UCI
}
export interface RawEval {
  depth: number;
  multipv: number;
  lines: RawLine[];
}
export interface EvalLine {
  rank: number;
  uci: string;
  san: string;
  continuation: string;
  scoreCp: number;
  mateIn?: number;
  scoreDisplay: string;
  winChanceWhite: number;
}
export interface EvalResult {
  success: true;
  fen: string;
  depth: number;
  multipv: number;
  scoreCp: number;
  scoreDisplay: string;
  mateIn?: number;
  winChanceWhite: number;
  bestMoveUci: string;
  bestMoveSan: string;
  bestMoveFrom: string;
  bestMoveTo: string;
  lines: EvalLine[];
  engine: string;
  source: 'engine' | 'memory' | 'server' | 'terminal';
}
export interface SearchOptions {
  movetime?: number;  // ms per posisi (default sesuai preset)
  maxDepth?: number;  // opsional: berhenti lebih awal jika depth ini tercapai
  multipv?: number;
}

export const PRESET_REVIEW = { movetime: 1000, multipv: 2 };   // review seluruh partai
export const PRESET_CURRENT = { movetime: 3000, multipv: 3 };  // posisi yang sedang dilihat

/* ----------------------------- Helper ----------------------------- */
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Kunci cache: 4 field pertama FEN (tanpa counter langkah) agar hit rate lebih tinggi. */
export function fenKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

function centipawnsToWinChance(cp: number, mate?: number): number {
  if (mate !== undefined && mate !== 0) return mate > 0 ? 100 : 0;
  const c = clamp(cp, -2000, 2000);
  const chance = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
  return Math.round(clamp(chance, 0, 100) * 10) / 10;
}

function formatScore(cp: number, mate?: number): string {
  if (mate) return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  const v = (cp / 100).toFixed(1);
  return cp > 0 ? `+${v}` : v === '-0.0' ? '0.0' : v;
}

function parseUciMove(fen: string, uci?: string) {
  if (!uci || uci.length < 4) return null;
  try {
    const m = new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: (uci.slice(4, 5) || undefined) as any,
    });
    return m ? { san: m.san, from: m.from, to: m.to } : null;
  } catch {
    return null;
  }
}

function formatPvContinuation(startFen: string, uciMoves: string[], maxMoves = 8): string {
  try {
    const c = new Chess(startFen);
    const tokens: string[] = [];
    let first = true;
    for (let i = 0; i < Math.min(uciMoves.length, maxMoves); i++) {
      const uci = uciMoves[i];
      if (!uci || uci.length < 4) break;
      const turn = c.turn();
      const num = c.moveNumber();
      const r = c.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: (uci.slice(4, 5) || undefined) as any,
      });
      if (!r) break;
      if (first) {
        tokens.push(turn === 'b' ? `${num}... ${r.san}` : `${num}. ${r.san}`);
        first = false;
      } else if (turn === 'w') {
        tokens.push(`${num}. ${r.san}`);
      } else {
        tokens.push(r.san);
      }
    }
    return tokens.join(' ');
  } catch {
    return uciMoves.slice(0, maxMoves).join(' ');
  }
}

/** Data mentah (ringkas, sama untuk semua FEN dengan key yang sama) -> hasil siap pakai UI. */
export function buildResult(fen: string, raw: RawEval, source: EvalResult['source']): EvalResult {
  const lines: EvalLine[] = [];
  for (const l of [...raw.lines].sort((a, b) => a.rank - b.rank)) {
    const p = parseUciMove(fen, l.pv[0]);
    if (!p) continue;
    lines.push({
      rank: l.rank,
      uci: l.pv[0],
      san: p.san,
      continuation: formatPvContinuation(fen, l.pv),
      scoreCp: l.cp,
      mateIn: l.mate,
      scoreDisplay: formatScore(l.cp, l.mate),
      winChanceWhite: centipawnsToWinChance(l.cp, l.mate),
    });
  }
  const top = lines[0];
  const bp = top ? parseUciMove(fen, top.uci) : null;
  return {
    success: true,
    fen,
    depth: raw.depth,
    multipv: raw.multipv,
    scoreCp: top?.scoreCp ?? 0,
    scoreDisplay: top?.scoreDisplay ?? '0.0',
    mateIn: top?.mateIn,
    winChanceWhite: top?.winChanceWhite ?? 50,
    bestMoveUci: top?.uci ?? '',
    bestMoveSan: bp?.san ?? '',
    bestMoveFrom: bp?.from ?? '',
    bestMoveTo: bp?.to ?? '',
    lines,
    engine: 'Stockfish 19 Lite WASM (browser)',
    source,
  };
}

/** Skakmat / stalemate / materi tidak cukup: tidak perlu engine. */
function terminalResult(fen: string): EvalResult | null {
  try {
    const c = new Chess(fen);
    let cp = 0;
    let display = '0.0';
    let win = 50;
    if (c.isCheckmate()) {
      const whiteLost = c.turn() === 'w';
      cp = whiteLost ? -10000 : 10000;
      display = whiteLost ? '0-1' : '1-0';
      win = whiteLost ? 0 : 100;
    } else if (!(c.isStalemate() || c.isInsufficientMaterial())) {
      return null;
    }
    return {
      success: true, fen, depth: 0, multipv: 0, scoreCp: cp, scoreDisplay: display,
      winChanceWhite: win, bestMoveUci: '', bestMoveSan: '', bestMoveFrom: '', bestMoveTo: '',
      lines: [], engine: 'terminal', source: 'terminal',
    };
  } catch {
    return null;
  }
}

/* ----------------------- Satu Web Worker engine ----------------------- */
class EngineWorker {
  private worker: Worker | null = null;
  private listener: ((line: string) => void) | null = null;
  private ready: Promise<void> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private create(): Promise<void> {
    const w = new Worker(ENGINE_URL);
    this.worker = w;
    w.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data ?? '');
      if (line) this.listener?.(line);
    };
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Engine gagal dimuat (timeout). Cek file .js dan .wasm di /engines/stockfish')),
        20000
      );
      w.onerror = (ev) => {
        clearTimeout(timer);
        reject(new Error('Gagal memuat engine: ' + (ev.message || 'worker error')));
      };
      let stage: 'uci' | 'ready' = 'uci';
      this.listener = (line) => {
        if (stage === 'uci' && line.startsWith('uciok')) {
          stage = 'ready';
          this.send('setoption name Hash value 32');
          this.send('isready');
        } else if (stage === 'ready' && line.startsWith('readyok')) {
          clearTimeout(timer);
          this.listener = null;
          resolve();
        }
      };
      this.send('uci');
    });
  }

  private async ensure() {
    if (!this.worker || !this.ready) this.ready = this.create();
    try {
      await this.ready;
    } catch (e) {
      this.destroy();
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { fatal: true });
    }
  }

  private sync(): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        this.listener = null;
        resolve();
      };
      const t = setTimeout(fin, 500);
      this.listener = (l) => {
        if (l.startsWith('readyok')) fin();
      };
      this.send('isready');
    });
  }

  /** Hentikan pencarian berjalan (engine tetap membalas bestmove -> search selesai lebih cepat). */
  stop() {
    this.send('stop');
  }

  /** Matikan worker. Instance dibuat ulang otomatis pada search berikutnya. */
  destroy() {
    try { this.worker?.terminate(); } catch { }
    this.worker = null;
    this.ready = null;
    this.listener = null;
  }

  search(fen: string, opts: { movetime: number; multipv: number; maxDepth?: number }): Promise<RawEval> {
    const run = () => this.doSearch(fen, opts);
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  private async doSearch(
    fen: string,
    opts: { movetime: number; multipv: number; maxDepth?: number }
  ): Promise<RawEval> {
    await this.ensure();
    await this.sync();

    const pvCount = clamp(opts.multipv, 1, 5);
    const isBlack = fen.split(' ')[1] === 'b';
    const lineMap = new Map<number, RawLine>();
    let depth = 0;

    return new Promise<RawEval>((resolve, reject) => {
      let finished = false;
      let hardTimedOut = false;
      let hardTimer: ReturnType<typeof setTimeout>;

      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(hardTimer);
        this.listener = null;
        const lines = Array.from(lineMap.values()).sort((a, b) => a.rank - b.rank);
        if (hardTimedOut && lines.length === 0) {
          reject(new Error('Engine tidak merespons dan sudah di-reset'));
          return;
        }
        resolve({ depth, multipv: pvCount, lines });
      };

      // Batas keras: movetime + 3 dtk. Tanpa bestmove -> pakai hasil terakhir & buat ulang engine.
      hardTimer = setTimeout(() => {
        hardTimedOut = true;
        this.destroy();
        finish();
      }, opts.movetime + 3000);

      this.listener = (line) => {
        if (line.startsWith('bestmove')) {
          finish();
          return;
        }
        if (
          !line.startsWith('info') ||
          !line.includes(' score ') ||
          line.includes('lowerbound') ||
          line.includes('upperbound')
        ) return;

        const pvIdx = line.indexOf(' pv ');
        if (pvIdx === -1) return;
        const pv = line.slice(pvIdx + 4).trim().split(/\s+/).filter(Boolean);
        if (!pv.length) return;

        const rank = parseInt(line.match(/\bmultipv\s+(\d+)/)?.[1] || '1', 10);
        const mateM = line.match(/score\s+mate\s+(-?\d+)/);
        const cpM = line.match(/score\s+cp\s+(-?\d+)/);

        let cp: number;
        let mate: number | undefined;
        if (mateM) {
          const raw = parseInt(mateM[1], 10);
          mate = isBlack ? -raw : raw;
          cp = mate > 0 ? 10000 : -10000;
        } else if (cpM) {
          const raw = parseInt(cpM[1], 10);
          cp = isBlack ? -raw : raw; // UCI relatif terhadap pemilik giliran -> ubah ke sudut pandang putih
        } else {
          return;
        }

        lineMap.set(rank, { rank, cp, mate, pv: pv.slice(0, 12) });
        if (rank === 1) {
          const d = line.match(/\bdepth\s+(\d+)/);
          if (d) depth = parseInt(d[1], 10);
        }
      };

      this.send(`setoption name MultiPV value ${pvCount}`);
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${opts.movetime}` + (opts.maxDepth ? ` depth ${opts.maxDepth}` : ''));
    });
  }
}

/* ------------------------------ Cache ------------------------------ */
const memCache = new Map<string, RawEval>();
const MEM_LIMIT = 5000;

function isSufficient(raw: RawEval | undefined | null, need: { minDepth: number; multipv: number }) {
  return !!raw && raw.depth >= need.minDepth && raw.multipv >= need.multipv && raw.lines.length > 0;
}

function rememberLocal(key: string, raw: RawEval) {
  if (raw.depth < 8 || raw.lines.length === 0) return;
  const old = memCache.get(key);
  if (old && (old.depth > raw.depth || (old.depth === raw.depth && old.multipv >= raw.multipv))) return;
  if (memCache.size >= MEM_LIMIT) memCache.delete(memCache.keys().next().value as string);
  memCache.set(key, raw);
}

async function fetchServerCache(keys: string[]): Promise<(RawEval | null)[]> {
  const out: (RawEval | null)[] = keys.map(() => null);
  for (let i = 0; i < keys.length; i += 150) {
    try {
      const res = await fetch(CACHE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', keys: keys.slice(i, i + 150) }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      (data.results || []).forEach((r: RawEval | null, j: number) => {
        out[i + j] = r ?? null;
      });
    } catch { /* cache server bersifat opsional */ }
  }
  return out;
}

async function uploadServerCache(entries: { key: string; raw: RawEval }[]) {
  for (let i = 0; i < entries.length; i += 100) {
    try {
      await fetch(CACHE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'put', entries: entries.slice(i, i + 100) }),
      });
    } catch { /* abaikan */ }
  }
}

/* ------------------------- API: posisi saat ini ------------------------- */
let liveEngine: EngineWorker | null = null;

/**
 * Analisis satu posisi (mis. posisi yang sedang dilihat). Engine dipakai ulang antar panggilan.
 * Panggilan diantre berurutan. Isi `interrupt: true` untuk menghentikan pencarian sebelumnya
 * (hasil lama lalu kembali dangkal, jadi abaikan hasil usang di sisi UI).
 */
export async function analyzeCurrent(
  fen: string,
  o: SearchOptions & { minDepth?: number; useServerCache?: boolean; fresh?: boolean; interrupt?: boolean } = {}
): Promise<EvalResult> {
  const term = terminalResult(fen);
  if (term) return term;

  const need = { minDepth: o.minDepth ?? 14, multipv: o.multipv ?? PRESET_CURRENT.multipv };
  const key = fenKey(fen);

  const hit = memCache.get(key);
  if (!o.fresh && isSufficient(hit, need)) return buildResult(fen, hit!, 'memory');

  if (o.useServerCache !== false && !o.fresh) {
    const [remote] = await fetchServerCache([key]);
    if (isSufficient(remote, need)) {
      rememberLocal(key, remote!);
      return buildResult(fen, remote!, 'server');
    }
  }

  if (!liveEngine) liveEngine = new EngineWorker();
  if (o.interrupt) liveEngine.stop(); // default: antre berurutan, hasil tidak pernah terpotong
  const raw = await liveEngine.search(fen, {
    movetime: o.movetime ?? PRESET_CURRENT.movetime,
    multipv: need.multipv,
    maxDepth: o.maxDepth,
  });
  rememberLocal(key, raw);
  if (raw.depth >= 10) void uploadServerCache([{ key, raw }]);
  return buildResult(fen, raw, 'engine');
}

/* ------------------------ API: review seluruh partai ------------------------ */
export interface AnalyzeOptions extends SearchOptions {
  minDepth?: number;          // hasil cache lebih dangkal dari ini dihitung ulang (default 12)
  poolSize?: number;          // jumlah worker paralel (default: setengah jumlah core, 1-3)
  useServerCache?: boolean;   // default true
  fresh?: boolean;            // true = abaikan semua cache (analisis ulang murni)
  signal?: AbortSignal;
  onProgress?: (done: number, total: number, fen: string, result: EvalResult | null) => void;
  onError?: (fen: string, err: Error) => void;
}

function defaultPoolSize() {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return clamp(Math.floor(cores / 2), 1, 3);
}

/**
 * Analisis banyak posisi. Urutan: cache memori -> cache server (Redis) -> engine di browser.
 * Hasil dikembalikan sebagai Map berkunci FEN persis seperti yang kamu kirim.
 * Tip: untuk partai N langkah cukup N+1 posisi (posisi sesudah langkah ke-n = sebelum langkah ke-n+1).
 */
export async function analyzePositions(
  fens: string[],
  options: AnalyzeOptions = {}
): Promise<Map<string, EvalResult>> {
  const movetime = options.movetime ?? PRESET_REVIEW.movetime;
  const multipv = options.multipv ?? PRESET_REVIEW.multipv;
  const need = { minDepth: options.minDepth ?? 12, multipv };
  const poolSize = clamp(options.poolSize ?? defaultPoolSize(), 1, 6);

  // Satu posisi unik per key (FEN tanpa counter)
  const repFen = new Map<string, string>();
  for (const fen of fens) {
    const k = fenKey(fen);
    if (!repFen.has(k)) repFen.set(k, fen);
  }
  const total = repFen.size;
  let done = 0;
  const rawByKey = new Map<string, RawEval>();
  const sources = new Map<string, EvalResult['source']>();
  const report = (fen: string, r: EvalResult | null) => {
    done++;
    options.onProgress?.(done, total, fen, r);
  };

  // 1) terminal + cache memori
  let todo: string[] = [];
  for (const [k, fen] of repFen) {
    const term = terminalResult(fen);
    if (term) { report(fen, term); continue; }
    const hit = memCache.get(k);
    if (!options.fresh && isSufficient(hit, need)) {
      rawByKey.set(k, hit!);
      sources.set(k, 'memory');
      report(fen, buildResult(fen, hit!, 'memory'));
      continue;
    }
    todo.push(k);
  }

  // 2) cache server (Redis), satu batch
  if (options.useServerCache !== false && !options.fresh && todo.length && !options.signal?.aborted) {
    const remote = await fetchServerCache(todo);
    const rest: string[] = [];
    todo.forEach((k, i) => {
      const raw = remote[i];
      if (isSufficient(raw, need)) {
        rememberLocal(k, raw!);
        rawByKey.set(k, raw!);
        sources.set(k, 'server');
        report(repFen.get(k)!, buildResult(repFen.get(k)!, raw!, 'server'));
      } else {
        rest.push(k);
      }
    });
    todo = rest;
  }

  // 3) hitung dengan engine (pool worker), progress per posisi
  if (todo.length && !options.signal?.aborted) {
    const engines = Array.from({ length: Math.min(poolSize, todo.length) }, () => new EngineWorker());
    let next = 0;
    let fatal: Error | null = null;
    let pendingUpload: { key: string; raw: RawEval }[] = [];

    const onAbort = () => engines.forEach((e) => e.stop());
    options.signal?.addEventListener('abort', onAbort);

    const loop = async (eng: EngineWorker) => {
      while (!options.signal?.aborted && !fatal) {
        const idx = next++;
        if (idx >= todo.length) break;
        const k = todo[idx];
        const fen = repFen.get(k)!;

        let raw: RawEval | null = null;
        let lastErr: Error | null = null;
        for (let attempt = 0; attempt < 2 && !raw; attempt++) {
          try {
            raw = await eng.search(fen, { movetime, multipv, maxDepth: options.maxDepth });
          } catch (e: any) {
            lastErr = e instanceof Error ? e : new Error(String(e));
            if (e?.fatal) {
              fatal = lastErr;
              break;
            }
          }
        }

        if (!raw) {
          if (fatal) break;
          options.onError?.(fen, lastErr ?? new Error('Analisis gagal'));
          report(fen, null);
          continue;
        }

        rawByKey.set(k, raw);
        sources.set(k, 'engine');
        rememberLocal(k, raw);
        if (raw.depth >= 10) pendingUpload.push({ key: k, raw });
        if (pendingUpload.length >= 20) {
          const batch = pendingUpload;
          pendingUpload = [];
          void uploadServerCache(batch);
        }
        report(fen, buildResult(fen, raw, 'engine'));
      }
    };

    try {
      await Promise.all(engines.map(loop));
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
      engines.forEach((e) => e.destroy());
    }
    if (pendingUpload.length) await uploadServerCache(pendingUpload);
    if (fatal) throw fatal;
  }

  // 4) susun hasil per FEN yang diminta
  const out = new Map<string, EvalResult>();
  for (const fen of fens) {
    const term = terminalResult(fen);
    if (term) { out.set(fen, term); continue; }
    const k = fenKey(fen);
    const raw = rawByKey.get(k);
    if (raw) out.set(fen, buildResult(fen, raw, sources.get(k) ?? 'engine'));
  }
  return out;
}

/** Panggil saat komponen di-unmount untuk membebaskan worker analisis posisi saat ini. */
export function disposeLiveEngine() {
  liveEngine?.destroy();
  liveEngine = null;
}
