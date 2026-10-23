import { NextRequest, NextResponse } from 'next/server';
import { getCachedAnalysisFromDb, saveCachedAnalysisToDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// In-memory hot cache for instant retrieval across concurrent requests
const memoryCache = new Map<string, any>();


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
    const { key, data } = body;

    if (!key) {
      return NextResponse.json({ success: false, error: 'Parameter key diperlukan' }, { status: 400 });
    }

    // Direct authentic analysis scoreMap payload computed by Stockfish engine
    if (data && typeof data === 'object') {
      memoryCache.set(key, data);
      await saveCachedAnalysisToDb(key, data);
      return NextResponse.json({ success: true, key, saved: true });
    }

    return NextResponse.json({ success: false, error: 'Data analisis Stockfish diperlukan' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error saving analysis' }, { status: 500 });
  }
}
