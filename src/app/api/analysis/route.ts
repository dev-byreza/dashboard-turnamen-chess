import { NextRequest, NextResponse } from 'next/server';
import { Chess } from 'chess.js';
import { getCachedAnalysisFromDb, saveCachedAnalysisToDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// Cache memori hanya "hot cache" singkat. Di serverless tiap instance punya salinan sendiri,
// jadi TTL pendek mencegah instance lain menyajikan analisis lama setelah analisis ulang.
const MEMORY_TTL_MS = 60_000;
const MEMORY_MAX_ENTRIES = 200;
const memoryCache = new Map<string, { data: any; at: number }>();

function memGet(key: string): any | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > MEMORY_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function memSet(key: string, data: any) {
  if (memoryCache.size >= MEMORY_MAX_ENTRIES) {
    memoryCache.delete(memoryCache.keys().next().value as string);
  }
  memoryCache.set(key, { data, at: Date.now() });
}

// Respons selalu segar: jangan di-cache browser / CDN
const noStore = { headers: { 'Cache-Control': 'no-store' } };

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
    const memData = effectiveKey ? memGet(effectiveKey) : null;
    if (memData) {
      if (isAnalysisDataValid(memData)) {
        return NextResponse.json(
          {
            success: true,
            source: 'memory',
            key: effectiveKey,
            data: memData,
          },
          noStore
        );
      }
      memoryCache.delete(effectiveKey);
    }

    // 2. Persistent PostgreSQL cache check (with url fallback)
    const dbCached = await getCachedAnalysisFromDb(effectiveKey, url);
    if (dbCached) {
      if (isAnalysisDataValid(dbCached)) {
        if (effectiveKey) memSet(effectiveKey, dbCached);
        return NextResponse.json(
          {
            success: true,
            source: 'postgres',
            key: effectiveKey,
            data: dbCached,
          },
          noStore
        );
      }
    }

    return NextResponse.json({ success: false, notFound: true }, noStore);
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
      const keysList: string[] = Array.isArray(extraKeys) ? extraKeys : [];
      // Simpan ke database dulu; memori baru diperbarui jika penyimpanan berhasil,
      // sehingga memori tidak pernah berisi data yang tidak ada di database.
      await saveCachedAnalysisToDb(key, data, keysList);
      memSet(key, data);
      for (const k of keysList) {
        if (k) memSet(k, data);
      }
      return NextResponse.json({ success: true, key, saved: true });
    }

    return NextResponse.json({ success: false, error: 'Data analisis Stockfish diperlukan' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error saving analysis' }, { status: 500 });
  }
}