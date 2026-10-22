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

// Convert UCI (e.g. "f3d4") to SAN ("Nxd4") and from/to
function parseUciMove(fenStr: string, uci: string) {
  try {
    const c = new Chess(fenStr);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4, 5) || undefined;
    const m = c.move({ from, to, promotion: promotion as any });
    return {
      san: m ? m.san : uci,
      from,
      to,
      piece: m ? m.piece : undefined,
    };
  } catch {
    return {
      san: uci,
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
    };
  }
}

// Run Stockfish 19 Lite WASM directly in the backend
function evaluateWithStockfish19Lite(cleanFen: string, depth = 12): Promise<any> {

  return new Promise((resolve, reject) => {
    try {
      const stockfishPath = path.join(
        process.cwd(),
        'public',
        'engines',
        'stockfish',
        'stockfish-19-lite-single.js'
      );
      const Stockfish = nodeRequire(stockfishPath);

      let latestEval: any = {
        fen: cleanFen,
        depth: 0,
        scoreCp: 0,
        scoreDisplay: '0.0',
        winChanceWhite: 50,
        bestMoveUci: '',
        engine: 'Stockfish 19 Lite WASM',
      };

      const isBlackToMove = cleanFen.split(' ')[1] === 'b';
      let isResolved = false;

      const engine = Stockfish({
        locateFile: (file: string) =>
          path.join(process.cwd(), 'public', 'engines', 'stockfish', file),
        print: (line: string) => {
          if (typeof line !== 'string') return;

          if (line.startsWith('info') && line.includes('score')) {
            const depthMatch = line.match(/depth\s+(\d+)/);
            const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
            const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
            const pvMatch = line.match(/pv\s+([a-h1-8qrbn\s]+)/);

            const curDepth = depthMatch ? parseInt(depthMatch[1], 10) : latestEval.depth;
            let cp = 0;
            let mate: number | undefined;
            let scoreText = '0.0';

            if (mateMatch) {
              mate = parseInt(mateMatch[1], 10);
              const realMate = isBlackToMove ? -mate : mate;
              mate = realMate;
              scoreText = realMate > 0 ? `M${realMate}` : `-M${Math.abs(realMate)}`;
              cp = realMate > 0 ? 10000 : -10000;
            } else if (cpMatch) {
              let rawCp = parseInt(cpMatch[1], 10);
              if (isBlackToMove) rawCp = -rawCp;
              cp = rawCp;
              const pawnVal = (cp / 100).toFixed(1);
              scoreText = cp > 0 ? `+${pawnVal}` : pawnVal === '-0.0' ? '0.0' : `${pawnVal}`;
            }

            const pvMoves = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];
            const bestUci = pvMoves[0] || latestEval.bestMoveUci;

            latestEval = {
              fen: cleanFen,
              depth: curDepth,
              scoreCp: cp,
              scoreDisplay: scoreText,
              mateIn: mate,
              winChanceWhite: centipawnsToWinChance(cp, mate),
              bestMoveUci: bestUci,
              engine: 'Stockfish 19 Lite WASM',
            };
          }

          if (line.startsWith('bestmove') && !isResolved) {
            isResolved = true;
            const parts = line.split(/\s+/);
            const bestUci = parts[1] && parts[1] !== '(none)' ? parts[1] : latestEval.bestMoveUci;
            const parsed = parseUciMove(cleanFen, bestUci);

            const finalResult = {
              success: true,
              fen: cleanFen,
              depth: latestEval.depth || depth,
              scoreCp: latestEval.scoreCp,
              scoreDisplay: latestEval.scoreDisplay,
              mateIn: latestEval.mateIn,
              winChanceWhite: latestEval.winChanceWhite,
              bestMoveUci: bestUci,
              bestMoveSan: parsed.san,
              bestMoveFrom: parsed.from,
              bestMoveTo: parsed.to,
              engine: 'Stockfish 19 Lite WASM',
            };

            resolve(finalResult);
          }
        },
        printErr: (err: any) => {
          // Debug output if needed
        },
      });

      // Send UCI commands to Stockfish 19 Lite
      engine.processCommand('ucinewgame');
      engine.processCommand(`position fen ${cleanFen}`);
      engine.processCommand(`go depth ${Math.min(14, depth)}`);

      // Safety timeout
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          const parsed = parseUciMove(cleanFen, latestEval.bestMoveUci || '');
          resolve({
            success: true,
            fen: cleanFen,
            depth: latestEval.depth || depth,
            scoreCp: latestEval.scoreCp,
            scoreDisplay: latestEval.scoreDisplay,
            mateIn: latestEval.mateIn,
            winChanceWhite: latestEval.winChanceWhite,
            bestMoveUci: latestEval.bestMoveUci,
            bestMoveSan: parsed.san,
            bestMoveFrom: parsed.from,
            bestMoveTo: parsed.to,
            engine: 'Stockfish 19 Lite WASM',
          });
        }
      }, 3000);
    } catch (err) {
      reject(err);
    }
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fen = searchParams.get('fen');
  const depth = parseInt(searchParams.get('depth') || '12', 10);

  if (!fen) {
    return NextResponse.json({ success: false, error: 'Parameter FEN is required' }, { status: 400 });
  }

  const cleanFen = fen.trim();
  const cacheKey = `${cleanFen}_d${depth}`;
  if (evalCache.has(cacheKey)) {
    return NextResponse.json(evalCache.get(cacheKey));
  }

  try {
    const result = await evaluateWithStockfish19Lite(cleanFen, depth);
    evalCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const fen = body?.fen;
    const depth = parseInt(body?.depth || '12', 10);

    if (!fen) {
      return NextResponse.json({ success: false, error: 'Parameter FEN is required' }, { status: 400 });
    }

    const cleanFen = fen.trim();
    const cacheKey = `${cleanFen}_d${depth}`;
    if (evalCache.has(cacheKey)) {
      return NextResponse.json(evalCache.get(cacheKey));
    }

    const result = await evaluateWithStockfish19Lite(cleanFen, depth);
    evalCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
