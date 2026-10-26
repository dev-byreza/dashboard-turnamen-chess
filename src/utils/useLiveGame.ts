'use client';

import { useEffect, useState } from 'react';

export type LiveResultValue = '1-0' | '0-1' | '1/2-1/2';

/** Bentuk JSON dari /api/live (sama dengan tipe LiveGame di src/lib/liveDb.ts). */
export interface LiveGameData {
  id: string;
  whiteName: string;
  blackName: string;
  status: 'live' | 'finished';
  result: LiveResultValue | null;
  startFen: string;
  moves: string[];
  moveCount: number;
  fen: string;
  pgn: string;
  version: number;
  tournamentId: string | null;
  matchId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LiveActionResult {
  ok: boolean;
  status: number;
  error?: string;
  game?: LiveGameData;
}

interface HookState {
  id: string | null;
  game: LiveGameData | null;
  error: string | null;
}

/**
 * Polling state partai live. Memakai ?since=VERSION sehingga server hanya mengirim
 * ulang data bila ada langkah baru. Polling dijeda saat tab tersembunyi.
 * error = 'NOT_FOUND' bila partai belum dibuat.
 */
export function useLiveGame(
  id: string | null,
  options: { intervalMs?: number } = {}
): { game: LiveGameData | null; error: string | null } {
  const intervalMs = options.intervalMs ?? 2000;
  const [state, setState] = useState<HookState>({ id: null, game: null, error: null });

  useEffect(() => {
    if (!id) {
      setState({ id: null, game: null, error: null });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let version: number | null = null;

    const schedule = () => {
      if (!cancelled) timer = setTimeout(load, intervalMs);
    };

    const load = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      try {
        const qs = new URLSearchParams({ id });
        if (version !== null) qs.set('since', String(version));
        const res = await fetch(`/api/live?${qs.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 404) {
          version = null;
          setState({ id, game: null, error: 'NOT_FOUND' });
        } else if (res.ok && data?.success) {
          if (data.unchanged) {
            setState((p) => (p.id === id && p.error ? { ...p, error: null } : p));
          } else if (data.game) {
            version = (data.game as LiveGameData).version;
            setState({ id, game: data.game as LiveGameData, error: null });
          }
        } else {
          const msg = data?.error || `HTTP ${res.status}`;
          setState((p) => ({ id, game: p.id === id ? p.game : null, error: msg }));
        }
      } catch {
        if (!cancelled) {
          setState((p) => ({ id, game: p.id === id ? p.game : null, error: 'NETWORK' }));
        }
      }
      schedule();
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, intervalMs]);

  const current = state.id === id;
  return { game: current ? state.game : null, error: current ? state.error : null };
}

/** Mengirim aksi arbiter (start | move | undo | finish) ke POST /api/live. */
export async function sendLiveAction(
  token: string,
  payload: Record<string, unknown>
): Promise<LiveActionResult> {
  const res = await fetch('/api/live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-live-token': token },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && data?.success === true,
    status: res.status,
    error: typeof data?.error === 'string' ? data.error : undefined,
    game: data?.game as LiveGameData | undefined,
  };
}
