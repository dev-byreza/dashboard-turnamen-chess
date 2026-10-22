import { Chess } from 'chess.js';
import openingsData from '../data/openings.json';

export interface OpeningInfo {
  eco: string;
  name: string;
  plies: number;
}

export interface BookMoveInfo {
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  eco: string;
  name: string;
  resultingFen: string;
}

const DB = openingsData as unknown as Record<string, [string, string, number]>;

const epd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export function lookupOpening(fen: string): OpeningInfo | null {
  const hit = DB[epd(fen)];
  return hit ? { eco: hit[0], name: hit[1], plies: hit[2] } : null;
}

export function isBookPosition(fen: string): boolean {
  return epd(fen) in DB;
}

/** Deepest named opening reached by a sequence of FENs (one per ply). */
export function detectOpeningFromFens(fens: string[]): OpeningInfo | null {
  let deepest: OpeningInfo | null = null;
  for (let i = 0; i < fens.length; i++) {
    const o = lookupOpening(fens[i]);
    if (o && (!deepest || o.plies >= deepest.plies)) {
      deepest = o;
    }
  }
  return deepest;
}

const COMMON_MOVES_PRIORITY: Record<string, number> = {
  // White 1st moves
  e4: 100,
  d4: 95,
  Nf3: 90,
  c4: 85,
  g3: 70,
  b3: 65,
  f4: 60,
  Nc3: 55,
  c3: 50,
  b4: 45,
  // Replies to 1. e4
  c5: 100,
  e5: 95,
  e6: 90,
  c6: 85,
  d5: 80,
  Nf6: 75,
  d6: 70,
  g6: 65,
  b6: 60,
  Nc6: 55,
  // Standard development moves
  Bc4: 95,
  Bb5: 90,
  'O-O': 88,
  Be2: 82,
  Bd3: 80,
  Bg5: 78,
  Bf4: 76,
};

/** Get all theoretical opening book moves from a given position. */
export function getOpeningBookMoves(fen: string): BookMoveInfo[] {
  try {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return [];
    const moves = chess.moves({ verbose: true });
    const bookMoves: BookMoveInfo[] = [];

    for (const m of moves) {
      chess.move(m);
      const resultingFen = chess.fen();
      const hit = DB[epd(resultingFen)];
      if (hit) {
        bookMoves.push({
          san: m.san,
          uci: `${m.from}${m.to}${m.promotion || ''}`,
          from: m.from,
          to: m.to,
          promotion: m.promotion,
          eco: hit[0],
          name: hit[1],
          resultingFen,
        });
      }
      chess.undo();
    }

    // Sort by priority so classical theory moves appear first
    bookMoves.sort((a, b) => {
      const pA = COMMON_MOVES_PRIORITY[a.san] || 0;
      const pB = COMMON_MOVES_PRIORITY[b.san] || 0;
      return pB - pA;
    });

    return bookMoves;
  } catch {
    return [];
  }
}
