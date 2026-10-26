'use client';

import React, { useMemo, useState } from 'react';
import { LiveGameData, sendLiveAction, useLiveGame } from '../utils/useLiveGame';
import { LiveGameModal } from './LiveGameModal';

const TOKEN_KEY = 'live_arbiter_token';
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

const box: React.CSSProperties = {
  background: '#262522',
  border: '1px solid #3d3b37',
  borderRadius: 10,
  padding: 16,
  color: '#fff',
  maxWidth: 520,
};
const input: React.CSSProperties = {
  background: '#1b1a18',
  color: '#fff',
  border: '1px solid #4b4845',
  borderRadius: 6,
  padding: '8px 10px',
  width: '100%',
  boxSizing: 'border-box',
};
const label: React.CSSProperties = { display: 'block', fontSize: 12, opacity: 0.7, margin: '10px 0 4px' };
const btn = (bg: string, disabled?: boolean): React.CSSProperties => ({
  background: disabled ? '#4b4845' : bg,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 14px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

function describeError(error: string | undefined, status: number): string {
  switch (error) {
    case 'ILLEGAL':
      return 'Langkah ilegal di posisi ini.';
    case 'CONFLICT':
      return 'Posisi sudah berubah (ada perangkat lain yang mengirim langkah). Tampilan sudah diperbarui, coba lagi.';
    case 'FINISHED':
      return 'Partai sudah selesai. Gunakan Undo untuk membukanya kembali.';
    case 'NOT_FOUND':
      return 'Partai belum dibuat. Tekan Mulai partai.';
    case 'EMPTY':
      return 'Belum ada langkah yang bisa dibatalkan.';
    case 'GAME_EXISTS':
      return 'Partai ini sudah berjalan dan memiliki langkah.';
  }
  if (status === 401) return 'Token arbiter salah.';
  if (status === 503) return 'Server belum dikonfigurasi (LIVE_ADMIN_TOKEN atau database).';
  return error || `Gagal (HTTP ${status})`;
}

/**
 * Panel arbiter: memulai partai live, memasukkan langkah (SAN seperti Nf3, atau koordinat seperti g1f3),
 * membatalkan langkah terakhir, dan menandai hasil. Memerlukan token yang sama dengan env LIVE_ADMIN_TOKEN.
 */
export const LiveArbiterPanel: React.FC = () => {
  const [token, setToken] = useState<string>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) || '' : '';
    } catch {
      return '';
    }
  });
  const [liveId, setLiveId] = useState('');
  const [whiteName, setWhiteName] = useState('');
  const [blackName, setBlackName] = useState('');
  const [moveText, setMoveText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [actionGame, setActionGame] = useState<LiveGameData | null>(null);
  const [showBoard, setShowBoard] = useState(false);

  const trimmedId = liveId.trim();
  const { game: polledGame } = useLiveGame(trimmedId || null, { intervalMs: 3000 });

  // Pakai state terbaru antara hasil polling dan hasil aksi terakhir (berdasarkan versi)
  const game = useMemo<LiveGameData | null>(() => {
    const fromAction = actionGame && actionGame.id === trimmedId ? actionGame : null;
    if (fromAction && polledGame) return fromAction.version >= polledGame.version ? fromAction : polledGame;
    return fromAction || polledGame;
  }, [actionGame, polledGame, trimmedId]);

  const onTokenChange = (value: string) => {
    setToken(value);
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // sessionStorage tidak tersedia: token hanya disimpan di memori
    }
  };

  const run = async (payload: Record<string, unknown>, okText: string) => {
    if (!token.trim()) {
      setMessage({ type: 'error', text: 'Isi token arbiter terlebih dahulu.' });
      return null;
    }
    if (!trimmedId) {
      setMessage({ type: 'error', text: 'Isi ID partai terlebih dahulu.' });
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await sendLiveAction(token.trim(), { id: trimmedId, ...payload });
      if (r.game) setActionGame(r.game);
      setMessage(r.ok ? { type: 'ok', text: okText } : { type: 'error', text: describeError(r.error, r.status) });
      return r;
    } catch {
      setMessage({ type: 'error', text: 'Gagal terhubung ke server.' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const startGame = async (force = false): Promise<void> => {
    const r = await run(
      {
        action: 'start',
        whiteName: whiteName.trim() || 'White',
        blackName: blackName.trim() || 'Black',
        force,
      },
      'Partai dimulai.'
    );
    if (
      r &&
      !r.ok &&
      r.error === 'GAME_EXISTS' &&
      !force &&
      window.confirm('Partai ini sudah berjalan dan punya langkah. Mulai ulang dan hapus semua langkah?')
    ) {
      await startGame(true);
    }
  };

  const sendMove = async () => {
    const text = moveText.trim();
    if (!text || !game) return;
    const move = UCI_RE.test(text)
      ? {
          from: text.slice(0, 2).toLowerCase(),
          to: text.slice(2, 4).toLowerCase(),
          ...(text.length === 5 ? { promotion: text[4].toLowerCase() } : {}),
        }
      : text;
    const r = await run({ action: 'move', expectedVersion: game.version, move }, `Langkah ${text} terkirim.`);
    if (r?.ok) setMoveText('');
  };

  const undo = async () => {
    if (!game) return;
    await run({ action: 'undo', expectedVersion: game.version }, 'Langkah terakhir dibatalkan.');
  };

  const finish = async (result: '1-0' | '0-1' | '1/2-1/2') => {
    if (!window.confirm(`Tandai partai selesai dengan hasil ${result}?`)) return;
    await run({ action: 'finish', result }, `Partai ditandai selesai (${result}).`);
  };

  const isLive = game?.status === 'live';
  const turnText = game ? (game.moves.length % 2 === 0 ? 'Putih' : 'Hitam') : '-';
  const lastMoves = game
    ? game.moves
        .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
        .slice(-8)
        .join(' ')
    : '';

  return (
    <div style={box}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>Panel Arbiter Live</div>

      <label style={label}>Token arbiter</label>
      <input
        style={input}
        type="password"
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        autoComplete="off"
      />

      <label style={label}>ID partai (huruf, angka, _ atau -)</label>
      <input
        style={input}
        value={liveId}
        onChange={(e) => setLiveId(e.target.value)}
        placeholder="contoh: babak1-papan2"
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Pemain Putih</label>
          <input style={input} value={whiteName} onChange={(e) => setWhiteName(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Pemain Hitam</label>
          <input style={input} value={blackName} onChange={(e) => setBlackName(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" style={btn('#81b64c', busy)} disabled={busy} onClick={() => startGame(false)}>
          Mulai partai
        </button>
        <button
          type="button"
          style={btn('#4b6ea8', !game)}
          disabled={!game}
          onClick={() => setShowBoard(true)}
        >
          Buka papan
        </button>
      </div>

      {game && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <div>
            <strong>{game.whiteName}</strong> vs <strong>{game.blackName}</strong> ·{' '}
            {isLive ? (
              <span style={{ color: '#ff6b6b', fontWeight: 700 }}>● LIVE</span>
            ) : (
              <span>Selesai {game.result || ''}</span>
            )}
          </div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            {game.moveCount} langkah · giliran: {isLive ? turnText : '-'}
          </div>
          {lastMoves && <div style={{ opacity: 0.8, marginTop: 4 }}>{lastMoves}</div>}

          <label style={label}>Langkah berikutnya (SAN: Nf3, e4, O-O, atau koordinat: g1f3, e7e8q)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              value={moveText}
              onChange={(e) => setMoveText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy && isLive) sendMove();
              }}
              disabled={!isLive}
            />
            <button
              type="button"
              style={btn('#81b64c', busy || !isLive || !moveText.trim())}
              disabled={busy || !isLive || !moveText.trim()}
              onClick={sendMove}
            >
              Kirim
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" style={btn('#a8782a', busy || game.moveCount === 0)} disabled={busy || game.moveCount === 0} onClick={undo}>
              Undo
            </button>
            <button type="button" style={btn('#3d6b99', busy || !isLive)} disabled={busy || !isLive} onClick={() => finish('1-0')}>
              Putih menang
            </button>
            <button type="button" style={btn('#3d6b99', busy || !isLive)} disabled={busy || !isLive} onClick={() => finish('0-1')}>
              Hitam menang
            </button>
            <button type="button" style={btn('#3d6b99', busy || !isLive)} disabled={busy || !isLive} onClick={() => finish('1/2-1/2')}>
              Remis
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: 13,
            background: message.type === 'ok' ? 'rgba(129,182,76,0.18)' : 'rgba(202,52,49,0.22)',
            color: message.type === 'ok' ? '#b7e08a' : '#ff9d9b',
          }}
        >
          {message.text}
        </div>
      )}

      <LiveGameModal
        liveId={trimmedId || null}
        isOpen={showBoard && !!trimmedId}
        onClose={() => setShowBoard(false)}
        isAdmin
      />
    </div>
  );
};

export default LiveArbiterPanel;
