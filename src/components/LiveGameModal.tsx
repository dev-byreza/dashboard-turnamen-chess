'use client';

import React, { useMemo } from 'react';
import { ChessBoardPreviewModal } from './ChessBoardPreviewModal';
import { LiveGameData, useLiveGame } from '../utils/useLiveGame';
import { ChessComRecentGame, formatChessTermination } from '../utils/chessComApi';
import { Player } from '../types/chess';

/**
 * Mengubah state partai live menjadi objek ChessComRecentGame supaya ChessBoardPreviewModal
 * dapat dipakai apa adanya (papan, daftar langkah, bar evaluasi, panah engine).
 */
export function liveGameToRecentGame(g: LiveGameData): ChessComRecentGame {
  const finished = g.status === 'finished';
  const lastSan = g.moves[g.moves.length - 1] || '';
  const mated = lastSan.includes('#');

  let whiteResult = '';
  let blackResult = '';
  if (finished) {
    if (g.result === '1-0') {
      whiteResult = 'win';
      blackResult = mated ? 'checkmated' : 'lose';
    } else if (g.result === '0-1') {
      blackResult = 'win';
      whiteResult = mated ? 'checkmated' : 'lose';
    } else {
      whiteResult = 'draw';
      blackResult = 'draw';
    }
  }

  const tournamentScore: '1-0' | '0-1' | '0.5-0.5' =
    g.result === '1-0' ? '1-0' : g.result === '0-1' ? '0-1' : '0.5-0.5';

  return {
    // Awalan "live:" menjaga kunci cache analisis tetap unik dan bukan ID partai Chess.com
    url: `live:${g.id}`,
    pgn: g.pgn,
    fen: g.fen,
    termination: finished ? formatChessTermination(whiteResult, blackResult) : 'Partai sedang berlangsung',
    timeClass: 'rapid',
    timeControl: '',
    endTime: Math.floor((g.updatedAt || Date.now()) / 1000),
    white: { username: g.whiteName, rating: 0, result: whiteResult },
    black: { username: g.blackName, rating: 0, result: blackResult },
    tournamentScore,
    matchedWhiteUser: g.whiteName,
    matchedBlackUser: g.blackName,
  };
}

export interface LiveGameModalProps {
  liveId: string | null;
  isOpen: boolean;
  onClose: () => void;
  whitePlayer?: Player | null;
  blackPlayer?: Player | null;
  isAdmin?: boolean;
  /** Jeda polling (ms). Default 2000. */
  pollMs?: number;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.7)',
  color: '#fff',
  fontFamily: 'inherit',
};

const cardStyle: React.CSSProperties = {
  background: '#262522',
  border: '1px solid #3d3b37',
  borderRadius: 10,
  padding: '20px 24px',
  textAlign: 'center',
  minWidth: 260,
};

export const LiveGameModal: React.FC<LiveGameModalProps> = ({
  liveId,
  isOpen,
  onClose,
  whitePlayer,
  blackPlayer,
  isAdmin = false,
  pollMs = 2000,
}) => {
  const { game, error } = useLiveGame(isOpen ? liveId : null, { intervalMs: pollMs });
  const recentGame = useMemo(() => (game ? liveGameToRecentGame(game) : null), [game]);

  if (!isOpen) return null;

  if (!game || !recentGame) {
    return (
      <div style={overlayStyle} role="dialog" aria-modal="true">
        <div style={cardStyle}>
          <p style={{ margin: '0 0 12px' }}>
            {error === 'NOT_FOUND'
              ? 'Partai live tidak ditemukan.'
              : error
              ? `Gagal memuat partai live: ${error}`
              : 'Memuat partai live...'}
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#81b64c',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChessBoardPreviewModal
      key={game.id}
      isOpen={isOpen}
      match={null}
      recentGame={recentGame}
      whitePlayer={whitePlayer}
      blackPlayer={blackPlayer}
      onClose={onClose}
      isAdmin={isAdmin}
      isLive={game.status === 'live'}
    />
  );
};

export default LiveGameModal;
