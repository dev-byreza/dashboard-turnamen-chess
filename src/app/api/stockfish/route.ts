import { NextRequest, NextResponse } from 'next/server';
import { Chess } from 'chess.js';
import path from 'path';
import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);

// In-memory cache for Stockfish 19 evaluations
const evalCache = new Map<string, any>();

export const dynamic = 'force-dynamic';

function centipawnsToWinChance(cp: number, mate?: number): number {
  if (mate !== undefined && mate !== 0) {
    return mate > 0 ? 100 : 0;
  }
  const clamped = Math.max(-2000, Math.min(2000, cp));
  const chance = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
  return Math.round(Math.max(0, Math.min(100, chance)) * 10) / 10;
}

// Convert UCI (e.g. "f3d4") to SAN ("Nxd4") and from/to - returns null if move is ILLEGAL on fenStr
function parseUciMove(fenStr: string, uci: string) {
  if (!uci || uci.length < 4) return null;
  try {
    const c = new Chess(fenStr);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4, 5) || undefined;
    const m = c.move({ from, to, promotion: promotion as any });
    if (!m) return null;
    return {
      san: m.san,
      from: m.from,
      to: m.to,
      piece: m.piece,
      legal: true,
    };
  } catch {
    return null;
  }
}

/**
 * ONE shared Stockfish instance (re-creating a WASM instance per request leaks memory
 * and made concurrent requests interfere with each other). Requests are serialized.
 */
let sharedEngine: any = null;
let activeLineListener: ((line: string) => void) | null = null;

function getEngine() {
  if (sharedEngine) return sharedEngine;
  const stockfishPath = path.join(
    process.cwd(),
    'public',
    'engines',
    'stockfish',
    'stockfish-19-lite-single.js'
  );
  const Stockfish = nodeRequire(stockfishPath);
  sharedEngine = Stockfish({
    locateFile: (file: string) =>
      path.join(process.cwd(), 'public', 'engines', 'stockfish', file),
    print: (line: string) => {
      if (typeof line === 'string' && activeLineListener) activeLineListener(line);
    },
    printErr: () => {},
  });
  sharedEngine.processCommand('uci');
  sharedEngine.processCommand('setoption name MultiPV value 1');
  sharedEngine.processCommand('setoption name Hash value 64');
  return sharedEngine;
}

let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p;
}

function flushEngine(engine: any): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        activeLineListener = null;
        resolve();
      }
    }, 400);

    activeLineListener = (line: string) => {
      if (line.includes('readyok')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          activeLineListener = null;
          resolve();
        }
      }
    };

    engine.processCommand('stop');
    engine.processCommand('isready');
  });
}

function formatPvContinuation(startFen: string, uciMoves: string[], maxMoves = 8): string {
  try {
    const c = new Chess(startFen);
    const tokens: string[] = [];
    let isFirst = true;

    for (let i = 0; i < Math.min(uciMoves.length, maxMoves); i++) {
      const uci = uciMoves[i];
      if (!uci || uci.length < 4) break;
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promo = uci.slice(4, 5) || undefined;
      const turn = c.turn();
      const moveNum = c.moveNumber();
      const res = c.move({ from, to, promotion: promo as any });
      if (!res) break;

      if (isFirst) {
        tokens.push(turn === 'b' ? `${moveNum}... ${res.san}` : `${moveNum}. ${res.san}`);
        isFirst = false;
      } else if (turn === 'w') {
        tokens.push(`${moveNum}. ${res.san}`);
      } else {
        tokens.push(res.san);
      }
    }
    return tokens.join(' ');
  } catch {
    return uciMoves.slice(0, maxMoves).join(' ');
  }
}

async function evaluateWithStockfish19Lite(cleanFen: string, depth = 12, multipv = 3): Promise<any> {
  const engine = getEngine();
  await flushEngine(engine);

  return new Promise((resolve, reject) => {
    try {
      const targetDepth = Math.min(24, Math.max(6, depth));
      const pvCount = Math.min(5, Math.max(1, multipv));
      engine.processCommand(`setoption name MultiPV value ${pvCount}`);
      // The side to move in the FEN decides the sign: UCI scores are side-to-move relative
      const isBlackToMove = cleanFen.split(' ')[1] === 'b';

      // Candidate lines by rank (white perspective)
      const lineMap = new Map<number, { cp: number; mate?: number; display: string; uci: string; pvMoves: string[] }>();

      let latest = {
        depth: 0,
        scoreCp: 0,
        scoreDisplay: '0.0',
        mateIn: undefined as number | undefined,
        bestMoveUci: '',
      };

      // Only a real `bestmove` resolves the search. On timeout we send `stop` and still
      // wait for `bestmove`, so a stale bestmove can never leak into the next request.
      const timeoutMs = Math.max(5000, targetDepth * 500);
      const timer = setTimeout(() => engine.processCommand('stop'), timeoutMs);

      activeLineListener = (line: string) => {
        if (line.startsWith('info') && line.includes(' score ') && !line.includes('lowerbound') && !line.includes('upperbound')) {
          const depthMatch = line.match(/\bdepth\s+(\d+)/);
          const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
          const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
          const pvIdx = line.indexOf(' pv ');
          const pvRest = pvIdx !== -1 ? line.slice(pvIdx + 4).trim() : '';
          const pvMoves = pvRest ? pvRest.split(/\s+/) : [];
          const uciMove = pvMoves[0] || '';

          let cp = latest.scoreCp;
          let mate: number | undefined;
          let scoreText = latest.scoreDisplay;

          if (mateMatch) {
            const raw = parseInt(mateMatch[1], 10);
            const m = isBlackToMove ? -raw : raw;
            mate = m;
            scoreText = m > 0 ? `M${m}` : `-M${Math.abs(m)}`;
            cp = m > 0 ? 10000 : -10000;
          } else if (cpMatch) {
            let raw = parseInt(cpMatch[1], 10);
            if (isBlackToMove) raw = -raw;
            cp = raw;
            const pawnVal = (cp / 100).toFixed(1);
            scoreText = cp > 0 ? `+${pawnVal}` : pawnVal === '-0.0' ? '0.0' : pawnVal;
          } else {
            return;
          }

          const rank = parseInt(line.match(/\bmultipv\s+(\d+)/)?.[1] || '1', 10);
          if (uciMove) lineMap.set(rank, { cp, mate, display: scoreText, uci: uciMove, pvMoves });
          if (rank !== 1) return;

          latest = {
            depth: depthMatch ? parseInt(depthMatch[1], 10) : latest.depth,
            scoreCp: cp,
            scoreDisplay: scoreText,
            mateIn: mate,
            bestMoveUci: uciMove || latest.bestMoveUci,
          };
        }

        if (line.startsWith('bestmove')) {
          clearTimeout(timer);
          activeLineListener = null;
          const parts = line.split(/\s+/);
          const rawBestUci = parts[1] && parts[1] !== '(none)' ? parts[1] : latest.bestMoveUci;

          // Parse and strictly validate move legality on cleanFen
          let parsed = rawBestUci ? parseUciMove(cleanFen, rawBestUci) : null;
          let bestUci = parsed ? rawBestUci : '';

          const validLines: any[] = [];
          const sortedEntries = Array.from(lineMap.entries()).sort((a, b) => a[0] - b[0]);
          for (const [rank, l] of sortedEntries) {
            const p = parseUciMove(cleanFen, l.uci);
            if (p) {
              validLines.push({
                rank,
                uci: l.uci,
                san: p.san,
                continuation: formatPvContinuation(cleanFen, l.pvMoves || [l.uci]),
                scoreCp: l.cp,
                mateIn: l.mate,
                scoreDisplay: l.display,
                winChanceWhite: centipawnsToWinChance(l.cp, l.mate),
              });
              if (!parsed) {
                bestUci = l.uci;
                parsed = p;
              }
            }
          }

          // Fallback to first legal move from cleanFen if engine move was somehow invalid
          if (!parsed) {
            try {
              const c = new Chess(cleanFen);
              const legals = c.moves({ verbose: true });
              if (legals.length > 0) {
                const fb = legals[0];
                bestUci = `${fb.from}${fb.to}${fb.promotion || ''}`;
                parsed = {
                  san: fb.san,
                  from: fb.from,
                  to: fb.to,
                  piece: fb.piece,
                  legal: true,
                };
              }
            } catch {}
          }

          resolve({
            success: true,
            fen: cleanFen,
            depth: latest.depth || targetDepth,
            reachedTarget: latest.depth >= targetDepth,
            scoreCp: latest.scoreCp,
            scoreDisplay: latest.scoreDisplay,
            mateIn: latest.mateIn,
            winChanceWhite: centipawnsToWinChance(latest.scoreCp, latest.mateIn),
            bestMoveUci: bestUci,
            bestMoveSan: parsed ? parsed.san : '',
            bestMoveFrom: parsed ? parsed.from : '',
            bestMoveTo: parsed ? parsed.to : '',
            lines: validLines,
            engine: 'Stockfish 19 Lite WASM',
          });
        }
      };

      engine.processCommand(`position fen ${cleanFen}`);
      engine.processCommand(`go depth ${targetDepth}`);
    } catch (err) {
      activeLineListener = null;
      reject(err);
    }
  });
}

async function evaluateCached(cleanFen: string, depth: number, multipv = 3, fresh = false) {
  const cacheKey = `${cleanFen}_d${depth}_m${multipv}`;
  if (!fresh && evalCache.has(cacheKey)) return evalCache.get(cacheKey);
  const result = await enqueue(() => evaluateWithStockfish19Lite(cleanFen, depth, multipv));
  if (result.reachedTarget) evalCache.set(cacheKey, result);
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fen = searchParams.get('fen');
  const depth = parseInt(searchParams.get('depth') || '12', 10);

  if (!fen) {
    return NextResponse.json({ success: false, error: 'Parameter FEN is required' }, { status: 400 });
  }

  try {
    const mpv = parseInt(searchParams.get('multipv') || '3', 10);
    const fresh = searchParams.get('fresh') === '1';
    return NextResponse.json(await evaluateCached(fen.trim(), depth, mpv, fresh));
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fen = body?.fen;
    const depth = parseInt(body?.depth || '12', 10);
    const mpv = parseInt(body?.multipv || '3', 10);

    if (!fen) {
      return NextResponse.json({ success: false, error: 'Parameter FEN is required' }, { status: 400 });
    }

    return NextResponse.json(await evaluateCached(fen.trim(), depth, mpv));
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
