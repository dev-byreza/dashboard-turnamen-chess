/**
 * Opening book backed by lichess-org/chess-openings (CC0): ~3,800 named ECO positions.
 * Positions are keyed by EPD (first 4 FEN fields) so transpositions are recognised.
 */
import openingsData from '../data/openings.json';

export interface OpeningInfo {
  eco: string;
  name: string;
  plies: number;
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
