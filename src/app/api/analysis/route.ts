import { NextRequest, NextResponse } from 'next/server';
import { Chess } from 'chess.js';
import { getCachedAnalysisFromDb, saveCachedAnalysisToDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// In-memory hot cache for instant retrieval across concurrent requests
const memoryCache = new Map<string, any>();

/**
 * Validate that all best moves inside the scoreMap are strictly legal moves on their corresponding FENs.
 * Rejects any corrupted/interleaved engine results (e.g. moves from empty squares like g5h4).
 */
function isAnalysisDataValid(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const entries = Object.entries(data);
  if (entries.length === 0) return false;

  for (const [fen, val] of entries) {
    const s = val as any;
    if (s && s.bestUci && typeof s.bestUci === 'string' && s.bestUci.length >= 4) {
      try {
        const c = new Chess(fen);
        const from = s.bestUci.slice(0, 2);
        const to = s.bestUci.slice(2, 4);
        const promo = s.bestUci.slice(4, 5) || undefined;
        const isLegal = c.moves({ verbose: true }).some(
          (m) => m.from === from && m.to === to && (!promo || m.promotion === promo)
        );
        if (!isLegal) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const url = searchParams.get('url');

    if (!key && !url) {
      return NextResponse.json({ success: false, error: 'Parameter key atau url diperlukan' }, { status: 400 });
    }

    const effectiveKey = key || (url ? `game_${url.replace(/[^a-zA-Z0-9]/g, '_')}` : '');

    // 1. Hot in-memory cache check
    if (effectiveKey && memoryCache.has(effectiveKey)) {
      const memData = memoryCache.get(effectiveKey);
      if (isAnalysisDataValid(memData)) {
        return NextResponse.json({
          success: true,
          source: 'memory',
          key: effectiveKey,
          data: memData,
        });
      } else {
        memoryCache.delete(effectiveKey);
      }
    }

    // 2. Persistent PostgreSQL cache check (with url fallback)
    const dbCached = await getCachedAnalysisFromDb(effectiveKey, url);
    if (dbCached) {
      if (isAnalysisDataValid(dbCached)) {
        if (effectiveKey) memoryCache.set(effectiveKey, dbCached);
        return NextResponse.json({
          success: true,
          source: 'postgres',
          key: effectiveKey,
          data: dbCached,
        });
      }
    }

    return NextResponse.json({ success: false, notFound: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error fetching analysis cache' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, data, extraKeys } = body;

    if (!key) {
      return NextResponse.json({ success: false, error: 'Parameter key diperlukan' }, { status: 400 });
    }

    // Direct authentic analysis scoreMap payload computed by Stockfish engine
    if (data && typeof data === 'object') {
      if (!isAnalysisDataValid(data)) {
        return NextResponse.json({ success: false, error: 'Data analisis mengandung langkah tidak sah' }, { status: 400 });
      }
      memoryCache.set(key, data);
      const keysList: string[] = Array.isArray(extraKeys) ? extraKeys : [];
      for (const k of keysList) {
        if (k) memoryCache.set(k, data);
      }
      await saveCachedAnalysisToDb(key, data, keysList);
      return NextResponse.json({ success: true, key, saved: true });
    }

    return NextResponse.json({ success: false, error: 'Data analisis Stockfish diperlukan' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error saving analysis' }, { status: 500 });
  }
}
