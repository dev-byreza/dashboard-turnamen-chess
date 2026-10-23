/**
 * Engine-based game review: every position is evaluated by the SAME Stockfish used for the
 * live eval bar, and move quality is derived from the real change in win probability
 * (the same idea Chess.com uses), instead of any heuristic / pseudo-random labelling.
 */
import { Chess } from 'chess.js';
import { centipawnsToWinChance } from './stockfishEngine';
import { isBookPosition } from './openingBook';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface PositionScore {
  fen: string;
  cp: number; // white perspective, +-10000 for mate
  mate?: number;
  winWhite: number; // 0..100
  scoreDisplay: string;
  bestUci?: string;
  bestSan?: string;
  /** Top engine candidate lines (MultiPV), white perspective */
  lines?: {
    uci: string;
    san: string;
    continuation?: string;
    cp: number;
    winWhite: number;
    scoreDisplay: string;
  }[];
}

export type ReviewLabel =
  | 'brilliant'
  | 'great'
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface ReviewedMove {
  label: ReviewLabel;
  loss: number; // win-probability points lost by mover (0..100)
  bestUci?: string;
  bestSan?: string;
  evalBefore: PositionScore;
  evalAfter: PositionScore;
}

export const COMMON_BOOK_LINES: Record<
  string,
  { uci: string; san: string; continuation: string; cp: number; winWhite: number; scoreDisplay: string }[]
> = {
  // START_FEN (White to move)
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': [
    {
      uci: 'e2e4',
      san: 'e4',
      continuation: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6',
      cp: 20,
      winWhite: 52.0,
      scoreDisplay: '+0.20',
    },
    {
      uci: 'd2d4',
      san: 'd4',
      continuation: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Be7',
      cp: 18,
      winWhite: 51.8,
      scoreDisplay: '+0.18',
    },
  ],
  // 1. d4 (Black to move - Queen's Pawn Game)
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1': [
    {
      uci: 'g8f6',
      san: 'Nf6',
      continuation: '1... Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O',
      cp: 17,
      winWhite: 51.5,
      scoreDisplay: '+0.17',
    },
    {
      uci: 'd7d5',
      san: 'd5',
      continuation: '1... d5 2. Nf3 Nf6 3. c4 e6 4. Nc3 Bb4 5. Bg5 h6',
      cp: 23,
      winWhite: 52.3,
      scoreDisplay: '+0.23',
    },
  ],
  // 1. e4 (Black to move - King's Pawn Game)
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': [
    {
      uci: 'e7e5',
      san: 'e5',
      continuation: '1... e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O',
      cp: 22,
      winWhite: 52.2,
      scoreDisplay: '+0.22',
    },
    {
      uci: 'c7c5',
      san: 'c5',
      continuation: '1... c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
      cp: 28,
      winWhite: 52.8,
      scoreDisplay: '+0.28',
    },
  ],
};

import { getStockfishEngine } from './stockfishEngine';

export async function fetchPositionScore(
  fen: string,
  depth: number,
  signal?: AbortSignal
): Promise<PositionScore | null> {
  // Pure Stockfish 19 Lite engine evaluation via API route
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(
      `/api/stockfish?fen=${encodeURIComponent(fen)}&depth=${depth}&multipv=3`,
      { signal: signal || controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      if (d && d.success) {
        const cp = typeof d.scoreCp === 'number' ? d.scoreCp : 0;
        return {
          fen,
          cp,
          mate: d.mateIn,
          winWhite: d.winChanceWhite ?? centipawnsToWinChance(cp, d.mateIn),
          scoreDisplay: d.scoreDisplay ?? '0.0',
          bestUci: d.bestMoveUci || undefined,
          bestSan: d.bestMoveSan || undefined,
          lines: Array.isArray(d.lines)
            ? d.lines.map((l: any) => ({
                uci: l.uci,
                san: l.san,
                continuation: l.continuation,
                cp: l.scoreCp,
                winWhite: l.winChanceWhite,
                scoreDisplay: l.scoreDisplay,
              }))
            : undefined,
        };
      }
    }
  } catch {
    // API route failed or timed out, fallback to client-side Web Worker
  }

  // 3. Fallback: Client-side Stockfish Web Worker
  try {
    if (typeof window !== 'undefined') {
      const engine = getStockfishEngine();
      const evalRes = await engine.evaluatePosition(fen, Math.min(depth, 12));
      if (evalRes) {
        return {
          fen,
          cp: evalRes.scoreCp,
          mate: evalRes.mateIn,
          winWhite: evalRes.winChanceWhite,
          scoreDisplay: evalRes.scoreDisplay,
          bestUci: evalRes.bestMoveUci,
          bestSan: evalRes.bestMoveSan,
        };
      }
    }
  } catch {
    // Both failed
  }

  return null;
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Static exchange evaluation on one square: best net material gain (>= 0, side may
 * stand pat) for the side to move, always capturing with the least valuable attacker.
 */
function see(chess: Chess, square: string, depth = 0): number {
  if (depth > 12) return 0;
  const caps = chess
    .moves({ verbose: true })
    .filter((mv) => mv.to === square && mv.captured)
    .sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece]);
  if (caps.length === 0) return 0;
  const mv = caps[0];
  chess.move(mv);
  const gain = PIECE_VALUE[mv.captured as string] - see(chess, square, depth + 1);
  chess.undo();
  return Math.max(0, gain);
}

/**
 * Real sacrifice: after the exchange sequence on the destination square the mover
 * ends up at least 2 pawns of material down (a protected piece that trades evenly
 * is NOT a sacrifice).
 */
function isSacrifice(fenAfter: string, to: string, piece: string, captured?: string): boolean {
  try {
    if (piece === 'p' || piece === 'k') return false;
    const c = new Chess(fenAfter); // opponent to move
    const oppGain = see(c, to);
    const moverNet = (captured ? PIECE_VALUE[captured] : 0) - oppGain;
    return moverNet <= -2;
  } catch {
    return false;
  }
}

function legalMoveCount(fen: string): number {
  try {
    return new Chess(fen).moves().length;
  } catch {
    return 99;
  }
}

export function classifyByEngine(
  m: { ply: number; color: 'w' | 'b'; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; fen: string },
  before: PositionScore,
  after: PositionScore,
  prevLoss: number, // loss of opponent's previous move (for "miss")
  prevMove?: { to: string; captured?: string } // opponent's previous move (recapture check)
): ReviewedMove {
  return classifyCore(m, before, after, prevLoss, prevMove);
}

function classifyCore(
  m: { ply: number; color: 'w' | 'b'; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; fen: string },
  before: PositionScore,
  after: PositionScore,
  prevLoss: number,
  prevMove?: { to: string; captured?: string }
): ReviewedMove {
  const mover = (s: PositionScore) => (m.color === 'w' ? s.winWhite : 100 - s.winWhite);
  const wb = mover(before);
  const wa = mover(after);
  const loss = Math.max(0, wb - wa);
  const playedUci = `${m.from}${m.to}${m.promotion || ''}`;
  const isBest = !!before.bestUci && before.bestUci === playedUci;
  const base = { loss, bestUci: before.bestUci, bestSan: before.bestSan, evalBefore: before, evalAfter: after };

  if (m.san.includes('#')) return { ...base, label: 'best' };

  // Opening theory: any theoretical position from opening database or standard first moves is ALWAYS a Book Move!
  const isOpeningBook =
    isBookPosition(m.fen) ||
    (m.ply <= 2 &&
      ['e4', 'd4', 'c4', 'Nf3', 'g3', 'b3', 'f4', 'e5', 'd5', 'c5', 'e6', 'c6', 'Nf6', 'g6', 'd6', 'Nc6'].includes(
        m.san
      ));
  if (isOpeningBook) return { ...base, loss: 0, label: 'book' };

  if (loss <= 2) {
    // Brilliant: genuine sacrifice (SEE), still near-best, not recapture, not forced,
    // not already winning big and leaves a real edge for the mover.
    const isRecapture = !!prevMove?.captured && prevMove.to === m.to && !!m.captured;
    if (
      wb < 85 &&
      wa >= 55 &&
      !isRecapture &&
      legalMoveCount(before.fen) > 1 &&
      isSacrifice(m.fen, m.to, m.piece, m.captured)
    ) {
      return { ...base, label: 'brilliant' };
    }
    // Seperti Chess.com: "Best" hanya jika langkah yang dimainkan = pilihan #1 engine.
    // Langkah hampir-setara tapi bukan pilihan #1 tetap "Excellent".
    if (isBest) {
      // 1. MultiPV check: Runner-up move is distinctly worse (wa - secondWin >= 7 or cpDiff >= 90)
      const second = before.lines && before.lines.length >= 2 ? before.lines[1] : null;
      if (second && wb < 92) {
        const secondWin = m.color === 'w' ? second.winWhite : 100 - second.winWhite;
        const cpDiff = typeof before.cp === 'number' && typeof second.cp === 'number'
          ? (m.color === 'w' ? before.cp - second.cp : second.cp - before.cp)
          : 0;
        if (wa - secondWin >= 7 || cpDiff >= 90) return { ...base, label: 'great' };
      }

      // 2. Crucial saving move under heavy pressure: position was difficult (wb <= 40),
      // and player found the critical move that held or saved the game (wa >= 45)
      if (wb <= 40 && wa >= 45 && loss <= 0.8) {
        return { ...base, label: 'great' };
      }

      return { ...base, label: 'best' };
    }
    return { ...base, label: 'excellent' };
  }

  if (loss <= 5) return { ...base, label: 'good' };
  if (loss <= 10) return { ...base, label: 'inaccuracy' };
  // Miss: gagal memanfaatkan kesalahan lawan (lawan baru saja salah >=10% DAN posisi kita
  // memang sudah menguntungkan). Selain itu kesalahan biasa = Mistake.
  if (loss <= 20) return { ...base, label: prevLoss >= 10 && wb >= 60 ? 'miss' : 'mistake' };
  return { ...base, label: 'blunder' };
}

/**
 * Calculates estimated Chess.com Game Performance Rating based on CAPS Accuracy & move quality
 */
export function calculateGameRating(
  accuracy: number,
  counts: { brilliant?: number; great?: number; best?: number; mistake?: number; blunder?: number },
  baseRating?: number
): number {
  let est = 0;
  if (accuracy >= 98) est = 2500 + (accuracy - 98) * 150;
  else if (accuracy >= 95) est = 2200 + (accuracy - 95) * 100;
  else if (accuracy >= 90) est = 1850 + (accuracy - 90) * 70;
  else if (accuracy >= 80) est = 1450 + (accuracy - 80) * 40;
  else if (accuracy >= 70) est = 1100 + (accuracy - 70) * 35;
  else if (accuracy >= 60) est = 800 + (accuracy - 60) * 30;
  else if (accuracy >= 50) est = 550 + (accuracy - 50) * 25;
  else est = Math.max(250, 300 + accuracy * 5);

  est += (counts.brilliant || 0) * 40;
  est += (counts.great || 0) * 20;
  est -= (counts.mistake || 0) * 15;
  est -= (counts.blunder || 0) * 35;

  if (baseRating && baseRating > 300 && baseRating < 3000) {
    est = Math.round(est * 0.75 + baseRating * 0.25);
  }

  const rounded = Math.round(est / 25) * 25;
  return Math.max(350, Math.min(2900, rounded));
}

export const LABEL_TITLE: Record<ReviewLabel, string> = {
  brilliant: 'Brilliant !! (Sangat Cemerlang)',
  great: 'Great Move ! (Langkah Hebat)',
  book: 'Book Move 📖 (Langkah Teori/Buku)',
  best: 'Best Move ★ (Langkah Terbaik)',
  excellent: 'Excellent 👍 (Sangat Bagus)',
  good: 'Good ✔ (Bagus)',
  inaccuracy: 'Inaccuracy ?! (Ketidakakuratan)',
  mistake: 'Mistake ? (Kesalahan)',
  miss: 'Miss ✖ (Melewatkan Peluang)',
  blunder: 'Blunder ?? (Kesalahan Fatal)',
};

export function describeMoveTactics(m: string | {
  san: string;
  piece?: string;
  from?: string;
  to?: string;
  captured?: string;
  promotion?: string;
}): string {
  const san = typeof m === 'string' ? m : m.san;
  if (!san) return 'Langkah posisi catur.';
  if (san === 'O-O') return 'Rokade sayap raja untuk mengamankan raja dan mengaktifkan benteng ke pusat.';
  if (san === 'O-O-O') return 'Rokade sayap ratu yang dinamis, menyiapkan serangan sayap berlawanan.';
  if (san.includes('#')) return 'Skakmat! Manuver pamungkas yang menyegel kemenangan mutlak.';
  if (san.includes('+')) return 'Melancarkan skak tajam terhadap raja lawan, merebut tempo dan inisiatif.';

  const to = typeof m === 'object' && m.to ? m.to : san.replace(/[^a-h1-8]/g, '').slice(-2);
  const isCap = san.includes('x') || (typeof m === 'object' && !!m.captured);

  if (isCap) {
    return `Memukul perwira lawan di ${to || 'petak target'} untuk merebut materi dan mempertahankan inisiatif serangan.`;
  }

  const p = typeof m === 'object' && m.piece ? m.piece.toLowerCase() : san[0] >= 'A' && san[0] <= 'Z' ? san[0].toLowerCase() : 'p';
  switch (p) {
    case 'p':
      if (['e4', 'd4', 'e5', 'd5'].includes(to)) {
        return `Mendorong pion pusat ke ${to} untuk menguasai petak sentral dan membuka ruang pengembangan perwira.`;
      }
      if (['c4', 'f4', 'c5', 'f5'].includes(to)) {
        return `Mendorong pion ke ${to} untuk menantang dominasi struktur petak tengah lawan.`;
      }
      return `Mendorong pion ke ${to} untuk memperkuat rantai bidak dan memperluas ruang permainan.`;
    case 'n':
      return `Mengembangkan kuda ke ${to}, mengontrol petak-petak penting di pusat dan memperkuat pertahanan.`;
    case 'b':
      return `Mengembangkan gajah ke diagonal terbuka di ${to} untuk meningkatkan daya tekan dan keharmonisan perwira.`;
    case 'r':
      return `Mengaktifkan benteng ke petak ${to} untuk menguasai lajur tengah yang penting.`;
    case 'q':
      return `Memposisikan ratu ke ${to} untuk menghubungkan benteng-benteng dan melancarkan tekanan ofensif.`;
    case 'k':
      return `Menggeser raja ke ${to} untuk perlindungan posisi yang lebih aman.`;
    default:
      return `Menempatkan perwira ke ${to || 'petak strategis'} untuk mengontrol posisi.`;
  }
}

export function describeReview(
  moveOrSan: string | { san: string; piece?: string; from?: string; to?: string; captured?: string; promotion?: string },
  r: ReviewedMove
): string {
  const san = typeof moveOrSan === 'string' ? moveOrSan : moveOrSan.san;
  const tactics = describeMoveTactics(moveOrSan);
  const drop = r.loss.toFixed(1);
  const best = r.bestSan ? ` Saran langkah terbaik: ${r.bestSan}.` : '';
  const ev = `(Eval: ${r.evalAfter.scoreDisplay})`;

  switch (r.label) {
    case 'brilliant':
      return `${san} - Langkah Brilian!! Pengorbanan perwira akurat yang membuka serangan mematikan. ${tactics} ${ev}`;
    case 'great':
      return `${san} - Langkah Hebat! Satu-satunya langkah terbaik yang mempertahankan posisi krusial. ${tactics} ${ev}`;
    case 'book':
      return `${san} - Langkah Buku Pembukaan (Book Move). ${tactics} Mengikuti teori master. ${ev}`;
    case 'best':
      return `${san} - Langkah Terbaik ★ Pilihan nomor satu Stockfish. ${tactics} ${ev}`;
    case 'excellent':
      return `${san} - Langkah Sangat Bagus. ${tactics} Posisi tetap prima (kehilangan hanya ${drop}% peluang menang). ${ev}`;
    case 'good':
      return `${san} - Langkah Bagus. ${tactics} Pilihan aman dan masuk akal. ${ev}`;
    case 'inaccuracy':
      return `${san} - Ketidakakuratan ?! Melepaskan sedikit keunggulan inisiatif (-${drop}% peluang menang). ${ev}${best}`;
    case 'mistake':
      return `${san} - Kesalahan ? Merusak kestabilan posisi (-${drop}% peluang menang hilang). ${ev}${best}`;
    case 'miss':
      return `${san} - Melewatkan Peluang ✖ Melewatkan kesempatan taktis untuk menghukum lawan (-${drop}%). ${ev}${best}`;
    case 'blunder':
      return `${san} - Blunder Fatal ?? Mengubah jalannya permainan secara drastis (-${drop}%). ${ev}${best}`;
  }
}
