'use client';

import React, { useEffect, useState } from 'react';
import { LiveGameModal } from './LiveGameModal';
import type { LiveGameData } from '../utils/useLiveGame';

interface LiveGamesListProps {
  isAdmin?: boolean;
  /** Jeda pembaruan daftar (ms). Default 10000. */
  pollMs?: number;
}

/**
 * Daftar partai yang sedang berlangsung. Tidak menampilkan apa pun bila tidak ada partai live.
 * Klik sebuah partai untuk membuka papan live dengan analisis engine.
 */
export const LiveGamesList: React.FC<LiveGamesListProps> = ({ isAdmin = false, pollMs = 10000 }) => {
  const [games, setGames] = useState<LiveGameData[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (!cancelled) timer = setTimeout(load, pollMs);
    };

    const load = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      try {
        const res = await fetch('/api/live?list=1', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.success && Array.isArray(data.games)) {
          setGames(data.games as LiveGameData[]);
        }
      } catch {
        // abaikan, coba lagi pada putaran berikutnya
      }
      schedule();
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollMs]);

  return (
    <>
      {games.length > 0 && (
        <div
          style={{
            background: '#262522',
            border: '1px solid #3d3b37',
            borderRadius: 10,
            padding: '12px 14px',
            margin: '0 0 16px',
            color: '#fff',
          }}
        >
          <div style={{ fontWeight: 800, color: '#ff6b6b', marginBottom: 8, fontSize: 13, letterSpacing: 0.5 }}>
            ● LIVE SEKARANG
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {games.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setOpenId(g.id)}
                style={{
                  background: '#312e2b',
                  color: '#fff',
                  border: '1px solid #4b4845',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {g.whiteName} vs {g.blackName}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {Math.ceil(g.moveCount / 2)} langkah
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <LiveGameModal
        liveId={openId}
        isOpen={openId !== null}
        onClose={() => setOpenId(null)}
        isAdmin={isAdmin}
      />
    </>
  );
};

export default LiveGamesList;
