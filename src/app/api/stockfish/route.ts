import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Chess } from 'chess.js';

/**
 * Cache evaluasi di Redis (Upstash / Vercel KV). Engine tetap jalan di browser;
 * server hanya menyimpan dan membagikan hasilnya antar pengguna.
 *
 * Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      (atau KV_REST_API_URL + KV_REST_API_TOKEN dari integrasi Vercel KV)
 * Instal: npm i @upstash/redis
 *
 * Jika env tidak ada, route ini tetap menjawab (tanpa cache) sehingga aplikasi tidak error.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const PREFIX = 'sf19lite:v1:'; // naikkan versi jika engine/format berubah
const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 hari
const MAX_ITEMS = 200;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

interface RawLine { rank: number; cp: number; mate?: number; pv: string[] }
interface RawEval { depth: number; multipv: number; lines: RawLine[] }

function validKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length > 100) return false;
  if (key.trim().split(/\s+/).length !== 4) return false;
  try {
    new Chess(`${key} 0 1`);
    return true;
  } catch {
    return false;
  }
}

/** Validasi ketat karena data berasal dari client: bentuk, rentang, dan legalitas langkah terbaik. */
function sanitizeRaw(key: string, raw: any): RawEval | null {
  if (!raw || typeof raw !== 'object') return null;
  const { depth, multipv } = raw;
  if (!Number.isInteger(depth) || depth < 10 || depth > 60) return null;
  if (!Number.isInteger(multipv) || multipv < 1 || multipv > 5) return null;
  if (!Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > 5) return null;

  const lines: RawLine[] = [];
  for (const l of raw.lines) {
    if (!Number.isInteger(l?.rank) || l.rank < 1 || l.rank > 5) return null;
    if (typeof l.cp !== 'number' || !Number.isFinite(l.cp) || Math.abs(l.cp) > 20000) return null;
    if (l.mate !== undefined && l.mate !== null && (!Number.isInteger(l.mate) || Math.abs(l.mate) > 300)) return null;
    if (!Array.isArray(l.pv) || l.pv.length < 1 || l.pv.length > 12) return null;
    if (!l.pv.every((m: unknown) => typeof m === 'string' && UCI_RE.test(m))) return null;
    lines.push({
      rank: l.rank,
      cp: Math.round(l.cp),
      ...(l.mate !== undefined && l.mate !== null ? { mate: l.mate } : {}),
      pv: l.pv,
    });
  }

  try {
    const best = (lines.find((x) => x.rank === 1) ?? lines[0]).pv[0];
    new Chess(`${key} 0 1`).move({
      from: best.slice(0, 2),
      to: best.slice(2, 4),
      promotion: (best.slice(4, 5) || undefined) as any,
    });
  } catch {
    return null;
  }
  return { depth, multipv, lines };
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON' }, { status: 400 });
  }

  try {
    if (body?.action === 'get') {
      const keys: unknown[] = Array.isArray(body.keys) ? body.keys.slice(0, MAX_ITEMS) : [];
      const results: (RawEval | null)[] = keys.map(() => null);
      if (!redis) return NextResponse.json({ results, disabled: true });

      const idx = keys.map((k, i) => (validKey(k) ? i : -1)).filter((i) => i >= 0);
      if (idx.length) {
        const values = await redis.mget<(RawEval | null)[]>(...idx.map((i) => PREFIX + (keys[i] as string)));
        idx.forEach((i, j) => {
          results[i] = values[j] ?? null;
        });
      }
      return NextResponse.json({ results });
    }

    if (body?.action === 'put') {
      if (!redis) return NextResponse.json({ stored: 0, disabled: true });
      const entries: any[] = Array.isArray(body.entries) ? body.entries.slice(0, MAX_ITEMS) : [];

      const clean: { key: string; raw: RawEval }[] = [];
      for (const e of entries) {
        if (!validKey(e?.key)) continue;
        const raw = sanitizeRaw(e.key, e.raw);
        if (raw) clean.push({ key: e.key, raw });
      }
      if (!clean.length) return NextResponse.json({ stored: 0 });

      // Hanya timpa jika hasil baru lebih dalam / lebih banyak varian
      const existing = await redis.mget<(RawEval | null)[]>(...clean.map((e) => PREFIX + e.key));
      const pipe = redis.pipeline();
      let stored = 0;
      clean.forEach((e, i) => {
        const old = existing[i];
        const better = !old || e.raw.depth > old.depth || (e.raw.multipv > old.multipv && e.raw.depth >= old.depth);
        if (better) {
          pipe.set(PREFIX + e.key, e.raw, { ex: TTL_SECONDS });
          stored++;
        }
      });
      if (stored) await pipe.exec();
      return NextResponse.json({ stored });
    }

    return NextResponse.json({ error: 'action tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
