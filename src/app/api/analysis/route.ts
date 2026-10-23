import { NextRequest, NextResponse } from 'next/server';
import { Chess } from 'chess.js';
import { getCachedAnalysisFromDb, saveCachedAnalysisToDb } from '../../../lib/db';
import { COMMON_BOOK_LINES, START_FEN, PositionScore } from '../../../utils/gameReview';

export const dynamic = 'force-dynamic';

// In-memory hot cache for instant retrieval across concurrent requests
const memoryCache = new Map<string, any>();

function centipawnsToWinChance(cp: number, mate?: number): number {
  if (mate !== undefined && mate !== 0) {
    return mate > 0 ? 100 : 0;
  }
  const clamped = Math.max(-2000, Math.min(2000, cp));
  const chance = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
  return Math.round(Math.max(0, Math.min(100, chance)) * 10) / 10;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ success: false, error: 'Parameter key diperlukan' }, { status: 400 });
    }

    // 1. Hot in-memory cache check
    if (memoryCache.has(key)) {
      return NextResponse.json({
        success: true,
        source: 'memory',
        key,
        data: memoryCache.get(key),
      });
    }

    // 2. Persistent PostgreSQL cache check
    const dbCached = await getCachedAnalysisFromDb(key);
    if (dbCached) {
      memoryCache.set(key, dbCached);
      return NextResponse.json({
        success: true,
        source: 'postgres',
        key,
        data: dbCached,
      });
    }

    return NextResponse.json({ success: false, notFound: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error fetching analysis cache' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, data, pgn, depth = 14 } = body;

    if (!key) {
      return NextResponse.json({ success: false, error: 'Parameter key diperlukan' }, { status: 400 });
    }

    // A. Direct analysis scoreMap payload
    if (data && typeof data === 'object') {
      memoryCache.set(key, data);
      await saveCachedAnalysisToDb(key, data);
      return NextResponse.json({ success: true, key, saved: true });
    }

    // B. Precompute analysis from PGN (triggered when pulled from Chess.com)
    if (pgn && typeof pgn === 'string') {
      const chess = new Chess();
      try {
        chess.loadPgn(pgn);
      } catch (err) {
        return NextResponse.json({ success: false, error: 'Gagal parse PGN' }, { status: 400 });
      }

      const historyMoves = chess.history({ verbose: true });
      const tracker = new Chess();
      const fens = [START_FEN];

      historyMoves.forEach((m) => {
        tracker.move(m);
        fens.push(tracker.fen());
      });

      const uniqueFens = Array.from(new Set(fens));
      const scoreMap: Record<string, PositionScore> = {};

      for (let i = 0; i < uniqueFens.length; i++) {
        const f = uniqueFens[i];
        if (COMMON_BOOK_LINES[f]) {
          const b = COMMON_BOOK_LINES[f];
          scoreMap[f] = {
            fen: f,
            cp: b[0].cp,
            winWhite: b[0].winWhite,
            scoreDisplay: b[0].scoreDisplay,
            bestUci: b[0].uci,
            bestSan: b[0].san,
          };
        } else if (f === START_FEN) {
          scoreMap[f] = {
            fen: f,
            cp: 15,
            winWhite: 50.5,
            scoreDisplay: '+0.1',
          };
        } else {
          // Provide fast interpolated/material positional score
          try {
            const probe = new Chess(f);
            let materialCp = 0;
            const values: Record<string, number> = { p: 100, n: 305, b: 330, r: 500, q: 900, k: 0 };
            const board = probe.board();
            board.forEach((row) => {
              row.forEach((sq) => {
                if (sq) {
                  const val = values[sq.type] || 0;
                  materialCp += sq.color === 'w' ? val : -val;
                }
              });
            });
            const cp = Math.max(-1500, Math.min(1500, materialCp));
            const winWhite = centipawnsToWinChance(cp);
            const scoreDisplay = cp >= 0 ? `+${(cp / 100).toFixed(1)}` : `${(cp / 100).toFixed(1)}`;
            scoreMap[f] = {
              fen: f,
              cp,
              winWhite,
              scoreDisplay,
            };
          } catch {
            scoreMap[f] = {
              fen: f,
              cp: 0,
              winWhite: 50,
              scoreDisplay: '0.0',
            };
          }
        }
      }

      memoryCache.set(key, scoreMap);
      await saveCachedAnalysisToDb(key, scoreMap);

      return NextResponse.json({
        success: true,
        key,
        precomputed: true,
        data: scoreMap,
      });
    }

    return NextResponse.json({ success: false, error: 'Data atau PGN harus disertakan' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error saving analysis' }, { status: 500 });
  }
}
