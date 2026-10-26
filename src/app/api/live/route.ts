import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import {
  appendLiveMove,
  finishLiveGame,
  getLiveGame,
  listLiveGames,
  startLiveGame,
  undoLiveMove,
  type LiveGame,
  type LiveMoveInput,
  type LiveOutcome,
  type LiveResult,
  START_FEN,
} from '../../../lib/liveDb';
import { isDbConfigured } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API partai LIVE.
 *  GET  /api/live?list=1                 -> daftar partai live
 *  GET  /api/live?id=ID[&since=VERSION]  -> state partai (since sama dengan versi terbaru -> { unchanged: true })
 *  POST /api/live  (header x-live-token) -> action: start | move | undo | finish
 *
 * Token: set env LIVE_ADMIN_TOKEN. Tanpa env ini, semua POST ditolak (fail closed).
 */

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const SQUARE_RE = /^[a-h][1-8]$/;
const RESULTS: LiveResult[] = ['1-0', '0-1', '1/2-1/2'];

// Hot cache sangat singkat agar banyak penonton tidak menembak database setiap detik pada instance yang sama.
const MEMORY_TTL_MS = 1000;
const MEMORY_MAX_ENTRIES = 100;
const memoryCache = new Map<string, { game: LiveGame; at: number }>();

function memGet(id: string): LiveGame | null {
  const entry = memoryCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.at > MEMORY_TTL_MS) {
    memoryCache.delete(id);
    return null;
  }
  return entry.game;
}

function memSet(game: LiveGame) {
  if (memoryCache.size >= MEMORY_MAX_ENTRIES) {
    memoryCache.delete(memoryCache.keys().next().value as string);
  }
  memoryCache.set(game.id, { game, at: Date.now() });
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function sha(value: string) {
  return createHash('sha256').update(value).digest();
}

function checkToken(req: NextRequest): 'ok' | 'denied' | 'not-configured' {
  const expected = process.env.LIVE_ADMIN_TOKEN;
  if (!expected) return 'not-configured';
  const given = req.headers.get('x-live-token') || '';
  return timingSafeEqual(sha(given), sha(expected)) ? 'ok' : 'denied';
}

const OUTCOME_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  FINISHED: 409,
  CONFLICT: 409,
  GAME_EXISTS: 409,
  ILLEGAL: 422,
  EMPTY: 422,
  BAD_FEN: 422,
  CORRUPT: 500,
};

function respondOutcome(outcome: LiveOutcome) {
  if (outcome.ok) {
    memSet(outcome.game);
    return json({ success: true, game: outcome.game });
  }
  if (outcome.game) memSet(outcome.game);
  return json(
    { success: false, error: outcome.error, game: outcome.game },
    OUTCOME_STATUS[outcome.error] ?? 400
  );
}

function parseMove(value: unknown): LiveMoveInput | null {
  if (typeof value === 'string') {
    const v = value.trim();
    return v.length > 0 && v.length <= 12 ? v : null;
  }
  if (value && typeof value === 'object') {
    const m = value as { from?: unknown; to?: unknown; promotion?: unknown };
    if (typeof m.from === 'string' && typeof m.to === 'string' && SQUARE_RE.test(m.from) && SQUARE_RE.test(m.to)) {
      if (m.promotion === undefined || m.promotion === null || m.promotion === '') {
        return { from: m.from, to: m.to };
      }
      if (typeof m.promotion === 'string' && /^[qrbn]$/.test(m.promotion)) {
        return { from: m.from, to: m.to, promotion: m.promotion };
      }
    }
  }
  return null;
}

function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const v = value.replace(/\s+/g, ' ').trim().slice(0, 100);
  return v || fallback;
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return json({ success: false, error: 'Database belum dikonfigurasi' }, 503);
    }

    const { searchParams } = new URL(req.url);

    if (searchParams.get('list')) {
      const games = await listLiveGames();
      return json({ success: true, games });
    }

    const id = searchParams.get('id') || '';
    if (!ID_RE.test(id)) {
      return json({ success: false, error: 'Parameter id tidak valid' }, 400);
    }

    let game = memGet(id);
    if (!game) {
      game = await getLiveGame(id);
      if (game) memSet(game);
    }
    if (!game) return json({ success: false, notFound: true }, 404);

    const since = Number(searchParams.get('since'));
    if (searchParams.has('since') && Number.isFinite(since) && since === game.version) {
      return json({ success: true, unchanged: true, version: game.version });
    }
    return json({ success: true, game });
  } catch (err: any) {
    return json({ success: false, error: err?.message || 'Gagal membaca partai live' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = checkToken(req);
    if (auth === 'not-configured') {
      return json({ success: false, error: 'LIVE_ADMIN_TOKEN belum dikonfigurasi di server' }, 503);
    }
    if (auth === 'denied') {
      return json({ success: false, error: 'Token tidak valid' }, 401);
    }
    if (!isDbConfigured()) {
      return json({ success: false, error: 'Database belum dikonfigurasi' }, 503);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'Body JSON diperlukan' }, 400);
    }

    const action = String((body as any).action || '');
    const id = String((body as any).id || '');
    if (!ID_RE.test(id)) {
      return json({ success: false, error: 'Parameter id tidak valid (huruf, angka, _ dan - saja, maks 100)' }, 400);
    }
    // Pencarian cache analisis (/api/analysis) mencocokkan deretan 9-15 digit sebagai ID partai Chess.com.
    if (/\d{9,}/.test(id)) {
      return json({ success: false, error: 'id tidak boleh memuat 9 digit angka berurutan atau lebih' }, 400);
    }

    if (action === 'start') {
      const b = body as any;
      if (typeof b.startFen === 'string' && b.startFen.trim() && b.startFen.trim() !== START_FEN) {
        return json({ success: false, error: 'startFen kustom belum didukung oleh tampilan papan' }, 422);
      }
      return respondOutcome(
        await startLiveGame({
          id,
          whiteName: cleanName(b.whiteName, 'White'),
          blackName: cleanName(b.blackName, 'Black'),
          tournamentId: typeof b.tournamentId === 'string' ? b.tournamentId.slice(0, 64) : null,
          matchId: typeof b.matchId === 'string' ? b.matchId.slice(0, 128) : null,
          startFen: typeof b.startFen === 'string' && b.startFen.trim() ? b.startFen.trim() : undefined,
          force: b.force === true,
        })
      );
    }

    if (action === 'move' || action === 'undo') {
      const expectedVersion = Number((body as any).expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
        return json({ success: false, error: 'expectedVersion (bilangan bulat) diperlukan' }, 400);
      }
      if (action === 'undo') {
        return respondOutcome(await undoLiveMove(id, expectedVersion));
      }
      const move = parseMove((body as any).move);
      if (!move) {
        return json({ success: false, error: 'move tidak valid (SAN, atau {from,to,promotion?})' }, 400);
      }
      return respondOutcome(await appendLiveMove(id, expectedVersion, move));
    }

    if (action === 'finish') {
      const result = (body as any).result as LiveResult;
      if (!RESULTS.includes(result)) {
        return json({ success: false, error: 'result harus 1-0, 0-1, atau 1/2-1/2' }, 400);
      }
      return respondOutcome(await finishLiveGame(id, result));
    }

    return json({ success: false, error: 'action harus start, move, undo, atau finish' }, 400);
  } catch (err: any) {
    if (err?.message === 'DB_NOT_CONFIGURED') {
      return json({ success: false, error: 'Database belum dikonfigurasi' }, 503);
    }
    return json({ success: false, error: err?.message || 'Gagal memproses aksi live' }, 500);
  }
}
