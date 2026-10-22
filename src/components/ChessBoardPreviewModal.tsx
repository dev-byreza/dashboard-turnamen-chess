'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Trophy,
  Swords,
  ChevronRight,
} from 'lucide-react';
import { Player, SwissMatch } from '../types/chess';
import { ChessComRecentGame } from '../utils/chessComApi';

export interface ChessBoardPreviewModalProps {
  isOpen: boolean;
  match: SwissMatch | null;
  recentGame?: ChessComRecentGame | null;
  whitePlayer?: Player | null;
  blackPlayer?: Player | null;
  onClose: () => void;
}

type PieceCode = 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';

// Parse FEN piece placement string to 8x8 array (row 0 = rank 8, row 7 = rank 1)
function parseFenToBoard(fen: string): (PieceCode | null)[][] {
  const clean = (fen || '').trim().split(' ')[0] || '';
  const rows = clean.split('/');
  const board: (PieceCode | null)[][] = [];

  for (let r = 0; r < 8; r++) {
    const rowStr = rows[r] || '';
    const row: (PieceCode | null)[] = [];
    for (const char of rowStr) {
      if (char >= '1' && char <= '8') {
        const count = parseInt(char, 10);
        for (let i = 0; i < count; i++) {
          row.push(null);
        }
      } else if (/[pnbrqkPNBRQK]/.test(char)) {
        row.push(char as PieceCode);
      }
    }
    while (row.length < 8) {
      row.push(null);
    }
    board.push(row);
  }

  return board;
}

/**
 * High-definition crisp vector SVG piece component
 */
const ChessPieceIcon: React.FC<{ piece: PieceCode }> = ({ piece }) => {
  const isWhite = piece === piece.toUpperCase();
  const type = piece.toLowerCase();

  // Primary colors
  const fill = isWhite ? '#ffffff' : '#272522';
  const stroke = isWhite ? '#1e1e1e' : '#111111';
  const highlight = isWhite ? '#e8ebed' : '#45423e';

  switch (type) {
    case 'k': // King
      return (
        <svg viewBox="0 0 45 45" className="chess-piece-svg">
          {/* Base */}
          <path d="M11.5 37h22v3.5h-22z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          {/* Body */}
          <path
            d="M12 36c0-4 3.5-7 7.5-8.5C16.5 26 15 23 15 20c0-4.5 3.5-8 7.5-8s7.5 3.5 7.5 8c0 3-1.5 6-4.5 7.5 4 1.5 7.5 4.5 7.5 8.5H12z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Cross */}
          <path d="M22.5 6.5v5M20 9h5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          {/* Inner ring */}
          <circle cx="22.5" cy="20" r="3.5" fill={highlight} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'q': // Queen
      return (
        <svg viewBox="0 0 45 45" className="chess-piece-svg">
          <path d="M11 37h23v3.5H11z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path
            d="M12 36.5c1-6 4-9 7-11-2-1-3-3.5-3-6 0-3.5 3-6.5 6.5-6.5S29 16 29 19.5c0 2.5-1 5-3 6 3 2 6 5 7 11H12z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Crown points */}
          <circle cx="12" cy="14" r="2" fill={fill} stroke={stroke} strokeWidth="1" />
          <circle cx="17" cy="11" r="2" fill={fill} stroke={stroke} strokeWidth="1" />
          <circle cx="22.5" cy="9.5" r="2.2" fill={fill} stroke={stroke} strokeWidth="1" />
          <circle cx="28" cy="11" r="2" fill={fill} stroke={stroke} strokeWidth="1" />
          <circle cx="33" cy="14" r="2" fill={fill} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'r': // Rook
      return (
        <svg viewBox="0 0 45 45" className="chess-piece-svg">
          <path d="M12 37.5h21v3H12z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M14 37l1.5-18h14L31 37H14z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M13 18.5h19v-5H13v5z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          {/* Crenellations */}
          <path d="M13 13.5v-3.5h4v2h4v-2h3v2h4v-2h4v3.5H13z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M17 23h11" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'b': // Bishop
      return (
        <svg viewBox="0 0 45 45" className="chess-piece-svg">
          <path d="M13 37.5h19v3H13z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path
            d="M14 37c0-5 3.5-9 6-12-2.5-2.5-3.5-5.5-3.5-8.5 0-4.5 3-8 6-8s6 3.5 6 8c0 3-1 6-3.5 8.5 2.5 3 6 7 6 12H14z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Top jewel */}
          <circle cx="22.5" cy="6.5" r="1.8" fill={fill} stroke={stroke} strokeWidth="1" />
          {/* Slit */}
          <path d="M21 13l5 5" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'n': // Knight
      return (
        <svg viewBox="0 0 45 45" className="chess-piece-svg">
          <path d="M13 37.5h19v3H13z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path
            d="M13.5 37c.5-5 2.5-9 5.5-12 0-3-2-5-2-8 0-4 3-7.5 7-7.5 3 0 4 2 5 4 1 2 4 4.5 4 7 0 3-2 5-2 7 2 2 3.5 6 4 9.5H13.5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Eye & Mane details */}
          <circle cx="20" cy="16" r="1.5" fill={isWhite ? '#111' : '#fff'} />
          <path d="M24 13c1 1 2 2 2 4" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M20 25c2 1 5 1 7-1" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'p': // Pawn
    default:
      return (
        <svg viewBox="0 0 45 45" className="chess-piece-svg">
          <path d="M14 37.5h17v3H14z" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path
            d="M16 37c0-4 2.5-7.5 4.5-10.5-1.5-1-2.5-2.5-2.5-4.5 0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5c0 2-1 3.5-2.5 4.5 2 3 4.5 6.5 4.5 10.5H16z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Head */}
          <circle cx="22.5" cy="14" r="5" fill={fill} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
  }
};

export const ChessBoardPreviewModal: React.FC<ChessBoardPreviewModalProps> = ({
  isOpen,
  match,
  recentGame,
  whitePlayer,
  blackPlayer,
  onClose,
}) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [boardTheme, setBoardTheme] = useState<'classic-green' | 'warm-wood'>('classic-green');
  const [copiedFen, setCopiedFen] = useState<boolean>(false);
  const [copiedPgn, setCopiedPgn] = useState<boolean>(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  // Resolve FEN & PGN from match or recentGame
  const fen = match.chessComFen || recentGame?.fen || '';
  const pgn = match.chessComPgn || recentGame?.pgn || '';
  const gameUrl = match.chessComUrl || recentGame?.url || '';
  const termination =
    match.chessComTermination ||
    recentGame?.termination ||
    (match.result === '1-0'
      ? 'Putih Menang'
      : match.result === '0-1'
      ? 'Hitam Menang'
      : match.result === '0.5-0.5'
      ? 'Remis'
      : 'Selesai');

  // Fallback FEN if none (standard start board, though Chess.com will supply final FEN)
  const displayFen = fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const boardMatrix = parseFenToBoard(displayFen);

  // Handle board orientation
  const displayedBoard = isFlipped
    ? boardMatrix.slice().reverse().map((r) => r.slice().reverse())
    : boardMatrix;

  const files = isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = isFlipped ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];

  const handleCopyFen = async () => {
    try {
      await navigator.clipboard.writeText(displayFen);
      setCopiedFen(true);
      setTimeout(() => setCopiedFen(false), 2000);
    } catch (err) {
      console.error('Failed to copy FEN:', err);
    }
  };

  const handleCopyPgn = async () => {
    if (!pgn) return;
    try {
      await navigator.clipboard.writeText(pgn);
      setCopiedPgn(true);
      setTimeout(() => setCopiedPgn(false), 2000);
    } catch (err) {
      console.error('Failed to copy PGN:', err);
    }
  };

  const analysisUrl = `https://www.chess.com/analysis?fen=${encodeURIComponent(displayFen)}`;

  return (
    <div className="chesscom-modal-backdrop" onClick={onClose}>
      <div
        className="chesscom-modal-content chessboard-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="chesscom-modal-header">
          <div className="chesscom-brand-tag">
            <span className="chesscom-pawn-icon">♟</span>
            <span>PREVIEW POSISI AKHIR BIDAK (CHESS.COM)</span>
          </div>
          <button
            onClick={onClose}
            className="chesscom-close-btn"
            title="Tutup (Esc)"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="chesscom-modal-body chessboard-modal-body">
          {/* Match Info Banner */}
          <div className="board-preview-match-banner">
            <div className="board-preview-round-tag">
              <span>Meja {match.boardNumber} • Ronde {match.round}</span>
            </div>

            <div className="board-preview-players">
              {/* White Player */}
              <div className="board-preview-player-col white-col">
                <div className="player-avatar-mini white-avatar">
                  {whitePlayer?.avatar ? (
                    <img src={whitePlayer.avatar} alt={whitePlayer.name} referrerPolicy="no-referrer" />
                  ) : (
                    <span>♔</span>
                  )}
                </div>
                <div className="player-info-meta">
                  <span className="player-name-text">{whitePlayer?.name || 'Pemain Putih'}</span>
                  {whitePlayer?.chessComUsername && (
                    <span className="player-chesscom-handle">@{whitePlayer.chessComUsername}</span>
                  )}
                </div>
              </div>

              {/* Score / Result badge in middle */}
              <div className="board-preview-score-badge">
                <div className="score-numbers">{match.result || '-'}</div>
                <div className="score-desc">{termination}</div>
              </div>

              {/* Black Player */}
              <div className="board-preview-player-col black-col">
                <div className="player-avatar-mini black-avatar">
                  {blackPlayer?.avatar ? (
                    <img src={blackPlayer.avatar} alt={blackPlayer.name} referrerPolicy="no-referrer" />
                  ) : (
                    <span>♚</span>
                  )}
                </div>
                <div className="player-info-meta">
                  <span className="player-name-text">{blackPlayer?.name || 'Pemain Hitam'}</span>
                  {blackPlayer?.chessComUsername && (
                    <span className="player-chesscom-handle">@{blackPlayer.chessComUsername}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chessboard View Container */}
          <div className="chessboard-preview-viewport">
            <div className={`chessboard-board-wrapper ${boardTheme}`}>
              <div className="chessboard-grid-table">
                {displayedBoard.map((row, rIdx) => (
                  <div key={`rank-${rIdx}`} className="chessboard-rank-row">
                    {row.map((piece, cIdx) => {
                      const isDark = (rIdx + cIdx) % 2 === 1;
                      const showRankCoord = cIdx === 0;
                      const showFileCoord = rIdx === 7;

                      return (
                        <div
                          key={`sq-${rIdx}-${cIdx}`}
                          className={`chessboard-square ${isDark ? 'dark-sq' : 'light-sq'}`}
                        >
                          {/* Rank coordinate label (left side) */}
                          {showRankCoord && (
                            <span className="coord-label rank-coord">{ranks[rIdx]}</span>
                          )}

                          {/* File coordinate label (bottom side) */}
                          {showFileCoord && (
                            <span className="coord-label file-coord">{files[cIdx]}</span>
                          )}

                          {/* Piece rendered if square occupied */}
                          {piece && <ChessPieceIcon piece={piece} />}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Board Controls Bar */}
            <div className="chessboard-toolbar">
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                className="btn-toolbar-control"
                title="Putar sudut pandang papan (Putih / Hitam)"
              >
                <RotateCcw size={14} />
                <span>{isFlipped ? 'Orientasi: Hitam' : 'Orientasi: Putih'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setBoardTheme(boardTheme === 'classic-green' ? 'warm-wood' : 'classic-green')
                }
                className="btn-toolbar-control"
                title="Ganti warna petak papan"
              >
                <span>{boardTheme === 'classic-green' ? '🎨 Tema Hijau' : '🪵 Tema Kayu'}</span>
              </button>
            </div>
          </div>

          {/* FEN Box & Quick Copy */}
          <div className="fen-display-card">
            <div className="fen-label-row">
              <span className="fen-title">Posisi FEN (Forsyth-Edwards Notation):</span>
              <button
                type="button"
                onClick={handleCopyFen}
                className="btn-copy-fen"
                title="Salin notasi FEN ke papan klip"
              >
                {copiedFen ? (
                  <>
                    <Check size={13} className="text-green-500" />
                    <span style={{ color: '#2b8a3e', fontWeight: 700 }}>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Salin FEN</span>
                  </>
                )}
              </button>
            </div>
            <code className="fen-code-block">{displayFen}</code>
          </div>

          {/* Actions Footer */}
          <div className="chesscom-modal-footer chessboard-modal-footer">
            {pgn && (
              <button
                type="button"
                onClick={handleCopyPgn}
                className="chesscom-action-btn secondary"
                title="Salin seluruh langkah permainan (PGN)"
              >
                {copiedPgn ? (
                  <>
                    <Check size={14} />
                    <span>PGN Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Salin PGN</span>
                  </>
                )}
              </button>
            )}

            <a
              href={analysisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="chesscom-action-btn secondary"
              title="Buka posisi akhir ini di papan analisa Chess.com"
            >
              <span>Analisa Posisi</span>
              <ExternalLink size={13} />
            </a>

            {gameUrl && (
              <a
                href={gameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="chesscom-action-btn primary"
                title="Tonton replay game pertandingan di Chess.com"
              >
                <span>Tonton di Chess.com</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
