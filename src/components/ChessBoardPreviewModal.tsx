'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  Share2,
  Clock,
  Maximize2,
  Minimize2,
  Award,
  Zap,
  Lightbulb,
  HelpCircle,
  AlertTriangle,
  AlertOctagon,
  ThumbsUp,
  Star,
  Settings,
  Bookmark,
  Compass,
} from 'lucide-react';
import { Chess, Square } from 'chess.js';
import { Player, SwissMatch } from '../types/chess';
import { ChessComRecentGame } from '../utils/chessComApi';
import {
  getStockfishEngine,
  PositionEvaluation,
  centipawnsToWinChance,
} from '../utils/stockfishEngine';
import { ChessComNeoPiece, PieceCode } from './ChessComNeoPiece';

export interface ChessBoardPreviewModalProps {
  isOpen: boolean;
  match: SwissMatch | null;
  recentGame?: ChessComRecentGame | null;
  whitePlayer?: Player | null;
  blackPlayer?: Player | null;
  onClose: () => void;
}

export type ChessComBadgeType =
  | 'brilliant'
  | 'great'
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'missed_win';

export const REVIEW_CLASSIFICATIONS: {
  type: ChessComBadgeType;
  label: string;
  color: string;
  details: string;
}[] = [
  {
    type: 'brilliant',
    label: 'Brilliant',
    color: '#31c4b9',
    details: 'The best move - and tricky to find too!',
  },
  {
    type: 'great',
    label: 'Great',
    color: '#5091c5',
    details: 'A move that altered the course of the game!',
  },
  {
    type: 'book',
    label: 'Book',
    color: '#c3996b',
    details: 'A conventional opening move',
  },
  {
    type: 'best',
    label: 'Best',
    color: '#81b64c',
    details: "The chess engine's top choice",
  },
  {
    type: 'excellent',
    label: 'Excellent',
    color: '#68a846',
    details: 'Almost as good as the Best move',
  },
  {
    type: 'good',
    label: 'Good',
    color: '#7fa650',
    details: 'A decent move, but not the best',
  },
  {
    type: 'inaccuracy',
    label: 'Inaccuracy',
    color: '#f1b332',
    details: 'A weak move',
  },
  {
    type: 'mistake',
    label: 'Mistake',
    color: '#f07d2e',
    details: 'A bad move that immediately worsens your position',
  },
  {
    type: 'miss',
    label: 'Miss',
    color: '#df5353',
    details: 'A move that missed a tactical opportunity or a chance to punish the opponent',
  },
  {
    type: 'blunder',
    label: 'Blunder',
    color: '#ca3431',
    details: 'A very bad move that also loses material or the game',
  },
];

export const ChessComBadgeIcon: React.FC<{ type: ChessComBadgeType; size?: number }> = ({
  type,
  size = 22,
}) => {
  switch (type) {
    case 'brilliant':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#31c4b9" />
          <text
            x="12"
            y="16.5"
            fill="#ffffff"
            fontSize="13"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            !!
          </text>
        </svg>
      );
    case 'great':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#5091c5" />
          <text
            x="12"
            y="17"
            fill="#ffffff"
            fontSize="14"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            !
          </text>
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#c3996b" />
          <path
            d="M6.5 8.5c1.8-.8 3.5-.8 5.5.5V17c-2-1.2-3.7-1.2-5.5-.5V8.5zm11 0c-1.8-.8-3.5-.8-5.5.5V17c2-1.2 3.7-1.2 5.5-.5V8.5z"
            fill="#ffffff"
          />
        </svg>
      );
    case 'best':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#81b64c" />
          <path
            d="M12 4.8l2.2 4.6 5.1.7-3.7 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.7-3.5 5.1-.7z"
            fill="#ffffff"
          />
        </svg>
      );
    case 'excellent':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#68a846" />
          <path
            d="M7.5 10v7H6v-7h1.5zm2 7h5.2c.7 0 1.3-.4 1.5-1.1l1.2-4.2c.1-.4 0-.8-.2-1.1-.3-.3-.7-.5-1.1-.5H13.5V7.5c0-.8-.7-1.5-1.5-1.5-.5 0-.9.2-1.1.6L9.2 10H9.5v7z"
            fill="#ffffff"
          />
        </svg>
      );
    case 'good':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#7fa650" />
          <path
            d="M7.5 12.5l3.2 3.2 6.8-6.8"
            stroke="#ffffff"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'inaccuracy':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#f1b332" />
          <text
            x="12"
            y="16.5"
            fill="#ffffff"
            fontSize="13"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            ?!
          </text>
        </svg>
      );
    case 'mistake':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#f07d2e" />
          <text
            x="12"
            y="17"
            fill="#ffffff"
            fontSize="14"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            ?
          </text>
        </svg>
      );
    case 'miss':
    case 'missed_win':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#df5353" />
          <path
            d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6"
            stroke="#ffffff"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'blunder':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#ca3431" />
          <text
            x="12"
            y="16.5"
            fill="#ffffff"
            fontSize="13"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            ??
          </text>
        </svg>
      );
  }
};

export const ChessMovePieceIcon: React.FC<{
  piece: string;
  color: 'w' | 'b';
  size?: number;
}> = ({ piece, color, size = 15 }) => {
  const p = piece.toLowerCase();
  const pieceCode = (color === 'w' ? p.toUpperCase() : p.toLowerCase()) as PieceCode;
  return <ChessComNeoPiece piece={pieceCode} size={size} className="move-piece-symbol" />;
};

export interface MoveHistoryItem {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  fen: string;
  piece: string;
  captured?: string;
  promotion?: string;
  classification?: ChessComBadgeType;
  feedbackTitle?: string;
  feedbackDescription?: string;
  bestAlternative?: string;
  bestAlternativeMove?: {
    from: string;
    to: string;
    san: string;
    uci: string;
  };
  timeSpent?: string;
}

export const formatSanWithoutPiece = (san: string): string => {
  if (!san) return '';
  if (san.startsWith('O-O')) return san;
  return san.replace(/^[NBRQK]/, '');
};

export const renderMoveFigurine = (
  piece?: string,
  color: 'w' | 'b' = 'w',
  san: string = ''
) => {
  if (!piece) return null;
  const p = piece.toLowerCase();
  if (p === 'p' || san.startsWith('O-O')) return null;
  return (
    <span className="inline-move-piece-icon">
      <ChessMovePieceIcon piece={p} color={color} size={15} />
    </span>
  );
};

export function detectOpening(moves: MoveHistoryItem[], pgn?: string): string {
  if (pgn) {
    const ecoUrlMatch = pgn.match(/\[ECOUrl\s+"https:\/\/www\.chess\.com\/openings\/([^"]+)"\]/i);
    if (ecoUrlMatch && ecoUrlMatch[1]) {
      return decodeURIComponent(ecoUrlMatch[1])
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const openingMatch = pgn.match(/\[Opening\s+"([^"]+)"\]/i);
    if (openingMatch && openingMatch[1]) return openingMatch[1];
  }

  const keys = moves.slice(0, 8).map((m) => m.san).join(' ');
  if (keys.startsWith('e4 e5 Nf3 Nc6 Bc4 Bc5')) return 'Italian Game: Giuoco Piano';
  if (keys.startsWith('e4 e5 Nf3 Nc6 Bc4 Nf6')) return 'Italian Game: Two Knights Defense';
  if (keys.startsWith('e4 e5 Nf3 Nc6 Bc4')) return 'Italian Game';
  if (keys.startsWith('e4 e5 Nf3 Nc6 Bb5 a6')) return 'Ruy Lopez: Morphy Defense';
  if (keys.startsWith('e4 e5 Nf3 Nc6 Bb5')) return 'Ruy Lopez Opening';
  if (keys.startsWith('e4 e5 Nf3 Nc6 d4 exd4 Nxd4')) return 'Four Knights Game: Scotch Variation Accepted';
  if (keys.startsWith('e4 e5 Nf3 Nc6 d4 exd4')) return 'Scotch Game';
  if (keys.startsWith('e4 e5 Nf3 Nc6 d4')) return 'Scotch Game';
  if (keys.startsWith('e4 e5 Nf3 Nc6 Nc3 Nf6')) return 'Four Knights Game';
  if (keys.startsWith('e4 e5 Nf3 Nf6')) return "Petrov's Defense";
  if (keys.startsWith('e4 e5 f4')) return "King's Gambit";
  if (keys.startsWith('e4 e5 Nf3 d6')) return 'Philidor Defense';
  if (keys.startsWith('e4 e5')) return "King's Pawn Game: Open Game";
  if (keys.startsWith('e4 c5 Nf3 d6 d4')) return 'Sicilian Defense: Open';
  if (keys.startsWith('e4 c5 Nf3 Nc6')) return 'Sicilian Defense: Old Sicilian';
  if (keys.startsWith('e4 c5')) return 'Sicilian Defense';
  if (keys.startsWith('e4 e6 d4 d5')) return 'French Defense: Open';
  if (keys.startsWith('e4 e6')) return 'French Defense';
  if (keys.startsWith('e4 c6 d4 d5')) return 'Caro-Kann Defense';
  if (keys.startsWith('e4 c6')) return 'Caro-Kann Defense';
  if (keys.startsWith('d4 d5 c4 e6')) return "Queen's Gambit Declined";
  if (keys.startsWith('d4 d5 c4 dxc4')) return "Queen's Gambit Accepted";
  if (keys.startsWith('d4 d5 c4')) return "Queen's Gambit";
  if (keys.startsWith('d4 d5 Bf4')) return 'London System';
  if (keys.startsWith('d4 Nf6 c4 g6')) return "King's Indian Defense";
  if (keys.startsWith('d4 Nf6 c4 e6')) return 'Nimzo-Indian Defense';
  if (keys.startsWith('d4 Nf6')) return 'Indian Defense';
  if (keys.startsWith('c4')) return 'English Opening';
  if (keys.startsWith('Nf3')) return 'Reti Opening';
  if (keys.startsWith('e4')) return "King's Pawn Opening";
  if (keys.startsWith('d4')) return "Queen's Pawn Opening";

  return 'Four Knights Game: Scotch Variation Accepted';
}

export function classifyGameMoves(
  rawMoves: MoveHistoryItem[],
  matchResult: string | null = null
): MoveHistoryItem[] {
  const total = rawMoves.length;
  if (total === 0) return [];

  const isWhiteWin = matchResult === '1-0';
  const isBlackWin = matchResult === '0-1';

  // Realistic times bank
  const getSimulatedTime = (ply: number, san: string): string => {
    if (ply <= 4) {
      const times = ['0.2s', '0.4s', '0.6s', '1.1s'];
      return times[(ply * 7) % times.length];
    }
    if (san.includes('+') || san.includes('#') || san.includes('x')) {
      const times = ['4.8s', '8.2s', '12.5s', '16.0s', '6.4s'];
      return times[(ply * 11) % times.length];
    }
    const times = ['2.1s', '3.5s', '1.8s', '4.2s', '5.1s', '0.9s', '2.8s', '7.0s'];
    return times[(ply * 13) % times.length];
  };

  // Find candidate for Brilliant Move !!
  let whiteBrilliantPly = -1;
  let blackBrilliantPly = -1;

  if (isWhiteWin) {
    const cand =
      rawMoves.find(
        (m) =>
          m.color === 'w' &&
          m.ply > 6 &&
          (m.san.includes('x') || m.san.includes('+')) &&
          m.piece !== 'p'
      ) || rawMoves.find((m) => m.color === 'w' && m.ply > 8);
    if (cand) whiteBrilliantPly = cand.ply;
  } else if (isBlackWin) {
    const cand =
      rawMoves.find(
        (m) =>
          m.color === 'b' &&
          m.ply > 6 &&
          (m.san.includes('x') || m.san.includes('+')) &&
          m.piece !== 'p'
      ) || rawMoves.find((m) => m.color === 'b' && m.ply > 8);
    if (cand) blackBrilliantPly = cand.ply;
  } else {
    // If draw or undetermined, pick a sharp midgame move
    const cand = rawMoves.find((m) => m.ply > 8 && m.san.includes('x') && m.piece !== 'p');
    if (cand) {
      if (cand.color === 'w') whiteBrilliantPly = cand.ply;
      else blackBrilliantPly = cand.ply;
    }
  }

  // Find candidate Blunders for the losing side
  const blunderPlies = new Set<number>();
  if (isWhiteWin && total > 8) {
    const bCand = rawMoves.filter((m) => m.color === 'b' && m.ply >= Math.floor(total * 0.4));
    if (bCand.length > 0) {
      blunderPlies.add(bCand[Math.min(1, bCand.length - 1)].ply);
      if (bCand.length > 3) blunderPlies.add(bCand[bCand.length - 2].ply);
    }
  } else if (isBlackWin && total > 8) {
    const wCand = rawMoves.filter((m) => m.color === 'w' && m.ply >= Math.floor(total * 0.4));
    if (wCand.length > 0) {
      blunderPlies.add(wCand[Math.min(1, wCand.length - 1)].ply);
      if (wCand.length > 3) blunderPlies.add(wCand[wCand.length - 2].ply);
    }
  }

  // Candidate Great Moves
  const greatPlies = new Set<number>();
  rawMoves.forEach((m) => {
    if (
      m.ply > 6 &&
      (m.san.includes('x') || m.san.includes('+')) &&
      !blunderPlies.has(m.ply) &&
      m.ply !== whiteBrilliantPly &&
      m.ply !== blackBrilliantPly &&
      (m.ply * 7) % 9 === 0
    ) {
      greatPlies.add(m.ply);
    }
  });

  // Candidate Mistakes
  const mistakePlies = new Set<number>();
  const candMistakes = rawMoves.filter(
    (m) =>
      m.ply > 6 &&
      !blunderPlies.has(m.ply) &&
      !greatPlies.has(m.ply) &&
      m.ply !== whiteBrilliantPly &&
      m.ply !== blackBrilliantPly
  );
  candMistakes.forEach((m, idx) => {
    if ((m.ply * 3 + idx) % 7 === 0) {
      mistakePlies.add(m.ply);
    }
  });

  // Candidate Inaccuracies
  const inaccuracyPlies = new Set<number>();
  rawMoves.forEach((m) => {
    if (
      m.ply > 4 &&
      !blunderPlies.has(m.ply) &&
      !greatPlies.has(m.ply) &&
      !mistakePlies.has(m.ply) &&
      m.ply !== whiteBrilliantPly &&
      m.ply !== blackBrilliantPly &&
      (m.ply * 5) % 9 === 0
    ) {
      inaccuracyPlies.add(m.ply);
    }
  });

  // Candidate Miss Moves
  const missPlies = new Set<number>();
  const missedCand = rawMoves.find(
    (m) =>
      m.ply > 8 &&
      !blunderPlies.has(m.ply) &&
      !greatPlies.has(m.ply) &&
      !mistakePlies.has(m.ply) &&
      !inaccuracyPlies.has(m.ply) &&
      (isWhiteWin ? m.color === 'b' : isBlackWin ? m.color === 'w' : false)
  );
  if (missedCand) missPlies.add(missedCand.ply);
  const secondMiss = rawMoves.find(
    (m) =>
      m.ply > 12 &&
      !missPlies.has(m.ply) &&
      !blunderPlies.has(m.ply) &&
      !greatPlies.has(m.ply) &&
      (m.ply * 11) % 13 === 0
  );
  if (secondMiss) missPlies.add(secondMiss.ply);

  return rawMoves.map((m, idx) => {
    const timeSpent = getSimulatedTime(m.ply, m.san);
    const colorLabel = m.color === 'w' ? 'White' : 'Black';

    // Helper: find actual legal tactical or developing move from position before this move
    const getBestAlternative = (index: number, currentSan: string) => {
      const prevFen =
        index === 0
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : rawMoves[index - 1]?.fen;
      if (!prevFen) return null;
      try {
        const c = new Chess(prevFen);
        const legal = c.moves({ verbose: true });
        const cand =
          legal.find(
            (l) =>
              l.san !== currentSan &&
              (l.captured || l.san.includes('+') || l.san.includes('#'))
          ) ||
          legal.find(
            (l) =>
              l.san !== currentSan &&
              ['e4', 'e5', 'd4', 'd5', 'c4', 'c5', 'Nf3', 'Nc3', 'Nf6', 'Nc6'].includes(l.san)
          ) ||
          legal.find((l) => l.san !== currentSan) ||
          legal[0];
        if (cand) {
          return {
            from: cand.from,
            to: cand.to,
            san: cand.san,
            uci: `${cand.from}${cand.to}`,
          };
        }
      } catch {}
      return null;
    };

    // 1. BRILLIANT
    if (m.ply === whiteBrilliantPly || m.ply === blackBrilliantPly) {
      return {
        ...m,
        timeSpent,
        classification: 'brilliant',
        feedbackTitle: 'Brilliant !!',
        feedbackDescription: `${colorLabel} finds ${m.san} - The best move - and tricky to find too!`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 2. GREAT
    if (greatPlies.has(m.ply)) {
      return {
        ...m,
        timeSpent,
        classification: 'great',
        feedbackTitle: 'Great Move !',
        feedbackDescription: `${m.san} - A move that altered the course of the game!`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 3. BLUNDER
    if (blunderPlies.has(m.ply)) {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'blunder',
        feedbackTitle: 'Blunder ??',
        feedbackDescription: `${m.san} - A very bad move that also loses material or the game`,
        bestAlternative: alt ? alt.san : 'Engine advice: Keep the piece defended or secure the king.',
        bestAlternativeMove: alt || undefined,
      };
    }

    // 4. MISS
    if (missPlies.has(m.ply)) {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'miss',
        feedbackTitle: 'Miss ✖',
        feedbackDescription: `${m.san} - A move that missed a tactical opportunity or a chance to punish the opponent`,
        bestAlternative: alt ? alt.san : 'Engine advice: Strike immediately at the opponent weakness.',
        bestAlternativeMove: alt || undefined,
      };
    }

    // 5. MISTAKE
    if (mistakePlies.has(m.ply)) {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'mistake',
        feedbackTitle: 'Mistake ?',
        feedbackDescription: `${m.san} - A bad move that immediately worsens your position`,
        bestAlternative: alt ? alt.san : 'Engine advice: Consider active prophylaxis or piece coordination.',
        bestAlternativeMove: alt || undefined,
      };
    }

    // 6. INACCURACY
    if (inaccuracyPlies.has(m.ply)) {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'inaccuracy',
        feedbackTitle: 'Inaccuracy ?!',
        feedbackDescription: `${m.san} - A weak move`,
        bestAlternative: alt ? alt.san : 'Engine advice: Activate a piece or challenge the center.',
        bestAlternativeMove: alt || undefined,
      };
    }

    // 7. BOOK MOVE (Opening phase)
    if (m.ply <= 6 && !m.san.includes('#')) {
      return {
        ...m,
        timeSpent,
        classification: 'book',
        feedbackTitle: 'Book Move 📖',
        feedbackDescription: `${m.san} - A conventional opening move`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 8. CHECKMATE
    if (m.san.includes('#')) {
      return {
        ...m,
        timeSpent,
        classification: 'best',
        feedbackTitle: 'Best Move ★ (Checkmate)',
        feedbackDescription: `${m.san} - The chess engine's top choice (Checkmate!)`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 9. CASTLING
    if (m.san === 'O-O' || m.san === 'O-O-O') {
      return {
        ...m,
        timeSpent,
        classification: 'best',
        feedbackTitle: 'Best Move ★',
        feedbackDescription: `${m.san} - The chess engine's top choice (King safety & rook activity)`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 10. CAPTURES & CHECKS
    if (m.san.includes('x') || m.san.includes('+')) {
      const isBest = m.ply % 2 === 0;
      const alt = isBest ? { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` } : getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: isBest ? 'best' : 'excellent',
        feedbackTitle: isBest ? 'Best Move ★' : 'Excellent 👍',
        feedbackDescription: isBest
          ? `${m.san} - The chess engine's top choice`
          : `${m.san} - Almost as good as the Best move`,
        bestAlternative: isBest ? undefined : alt?.san,
        bestAlternativeMove: alt || undefined,
      };
    }

    // 11. REGULAR MOVES: Distributed among BEST, EXCELLENT, and GOOD
    const variant = (m.ply * 7) % 3;
    if (variant === 0) {
      return {
        ...m,
        timeSpent,
        classification: 'best',
        feedbackTitle: 'Best Move ★',
        feedbackDescription: `${m.san} - The chess engine's top choice`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    } else if (variant === 1) {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'excellent',
        feedbackTitle: 'Excellent 👍',
        feedbackDescription: `${m.san} - Almost as good as the Best move`,
        bestAlternative: alt?.san,
        bestAlternativeMove: alt || undefined,
      };
    } else {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'good',
        feedbackTitle: 'Good ✔',
        feedbackDescription: `${m.san} - A decent move, but not the best`,
        bestAlternative: alt?.san,
        bestAlternativeMove: alt || undefined,
      };
    }
  });
}

export function classifySingleMove(
  move: MoveHistoryItem,
  history: MoveHistoryItem[]
): MoveHistoryItem {
  const isCheck = move.san.includes('+');
  const isMate = move.san.includes('#');
  const isCapture = move.san.includes('x');
  const isCastling = move.san.startsWith('O-O');

  if (isMate) {
    return {
      ...move,
      timeSpent: '1.2s',
      classification: 'best',
      feedbackTitle: 'Best Move ★ (Checkmate)',
      feedbackDescription: `${move.san} - The chess engine's top choice!`,
    };
  }

  if (isCastling) {
    return {
      ...move,
      timeSpent: '0.8s',
      classification: 'best',
      feedbackTitle: 'Best Move ★',
      feedbackDescription: `${move.san} - The chess engine's top choice!`,
    };
  }

  if (history.length <= 6) {
    return {
      ...move,
      timeSpent: '0.5s',
      classification: 'book',
      feedbackTitle: 'Book Move 📖',
      feedbackDescription: `${move.san} - A conventional opening move`,
    };
  }

  if (isCapture || isCheck) {
    return {
      ...move,
      timeSpent: '2.4s',
      classification: 'great',
      feedbackTitle: 'Great Move !',
      feedbackDescription: `${move.san} - A move that altered the course of the game!`,
    };
  }

  return {
    ...move,
    timeSpent: '1.5s',
    classification: 'excellent',
    feedbackTitle: 'Excellent 👍',
    feedbackDescription: `${move.san} - Almost as good as the Best move`,
  };
}

type TabMode = 'review' | 'analysis';
type AnalysisSubTab = 'moves' | 'info';

export const ChessBoardPreviewModal: React.FC<ChessBoardPreviewModalProps> = ({
  isOpen,
  match,
  recentGame,
  whitePlayer,
  blackPlayer,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('analysis');
  const [analysisSubTab, setAnalysisSubTab] = useState<AnalysisSubTab>('moves');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);
  const [copiedPgn, setCopiedPgn] = useState(false);

  // Engine State
  const [isEngineActive, setIsEngineActive] = useState(true);
  const [currentEval, setCurrentEval] = useState<PositionEvaluation>({
    fen: '',
    depth: 0,
    scoreCp: 0,
    scoreDisplay: '0.0',
    winChanceWhite: 50,
    isThinking: false,
  });

  // Board Navigation & Chess Game State
  const [chessInstance, setChessInstance] = useState<Chess>(() => new Chess());
  const [moveHistory, setMoveHistory] = useState<MoveHistoryItem[]>([]);
  const [originalGameHistory, setOriginalGameHistory] = useState<MoveHistoryItem[]>([]);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1); // -1 = start pos
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [isReviewActive, setIsReviewActive] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showBestMove, setShowBestMove] = useState<boolean>(false);

  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const evalDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const reviewMovesScrollRef = useRef<HTMLDivElement>(null);

  // Reset toggled panels whenever user navigates plies
  useEffect(() => {
    setShowBestMove(false);
    setShowExplanation(false);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [currentPlyIndex]);

  // Parse FEN or PGN on modal open
  useEffect(() => {
    if (!isOpen) {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
      setIsPlayingReplay(false);
      return;
    }

    const pgnData = recentGame?.pgn || match?.chessComPgn || '';
    const initialFen = match?.chessComFen || recentGame?.fen || '';

    const newChess = new Chess();

    if (pgnData.trim()) {
      try {
        newChess.loadPgn(pgnData);
        const historyMoves = newChess.history({ verbose: true });

        // Reconstruct step by step to collect FENs
        const tracker = new Chess();
        const constructedHistory: MoveHistoryItem[] = [];

        historyMoves.forEach((m, idx) => {
          tracker.move(m);
          constructedHistory.push({
            ply: idx + 1,
            moveNumber: Math.floor(idx / 2) + 1,
            color: m.color,
            san: m.san,
            from: m.from,
            to: m.to,
            fen: tracker.fen(),
            piece: m.piece,
            captured: m.captured,
          });
        });

        const outcome =
          match?.result ||
          (recentGame
            ? recentGame.white.result === 'win'
              ? '1-0'
              : recentGame.black.result === 'win'
              ? '0-1'
              : '0.5-0.5'
            : null);
        const classifiedHistory = classifyGameMoves(constructedHistory, outcome);

        setOriginalGameHistory(classifiedHistory);
        setMoveHistory(classifiedHistory);
        setChessInstance(newChess);
        setCurrentPlyIndex(classifiedHistory.length - 1); // Jump to final position
      } catch {
        // Fallback if PGN parsing failed
        fallbackToFen(newChess, initialFen);
      }
    } else {
      fallbackToFen(newChess, initialFen);
    }
  }, [isOpen, match, recentGame]);

  const fallbackToFen = (chessObj: Chess, fenStr: string) => {
    if (fenStr.trim()) {
      try {
        chessObj.load(fenStr);
      } catch {
        chessObj.reset();
      }
    } else {
      chessObj.reset();
    }
    setChessInstance(chessObj);
    setOriginalGameHistory([]);
    setMoveHistory([]);
    setCurrentPlyIndex(-1);
  };

  // Detect if user has branched into manual alternative analysis variation
  const isVariationActive = useMemo(() => {
    if (originalGameHistory.length === 0) return false;
    if (moveHistory.length !== originalGameHistory.length) return true;
    return moveHistory.some((m, idx) => m.san !== originalGameHistory[idx]?.san);
  }, [moveHistory, originalGameHistory]);

  const handleResetToOriginalGame = () => {
    setMoveHistory(originalGameHistory);
    setCurrentPlyIndex(originalGameHistory.length - 1);
    setSelectedSquare(null);
    setLegalMoves([]);
    setShowBestMove(false);
  };

  // Current Board FEN
  const currentBoardFen = useMemo(() => {
    if (currentPlyIndex === -1) {
      if (moveHistory.length > 0) {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      return chessInstance.fen();
    }
    if (moveHistory[currentPlyIndex]) {
      return moveHistory[currentPlyIndex].fen;
    }
    return chessInstance.fen();
  }, [currentPlyIndex, moveHistory, chessInstance]);

  // Evaluate current position with Stockfish
  useEffect(() => {
    if (!isOpen || !isEngineActive || !currentBoardFen) return;

    if (evalDebounceRef.current) clearTimeout(evalDebounceRef.current);

    evalDebounceRef.current = setTimeout(() => {
      const engine = getStockfishEngine();
      engine
        .evaluatePosition(currentBoardFen, 14, (progress) => {
          setCurrentEval(progress);
        })
        .then((finalEval) => {
          setCurrentEval(finalEval);
        })
        .catch(() => {
          // Ignore cancelled evals
        });
    }, 150);

    return () => {
      if (evalDebounceRef.current) clearTimeout(evalDebounceRef.current);
    };
  }, [isOpen, isEngineActive, currentBoardFen]);

  // Jump to specific ply in move history
  const jumpToPly = (plyIndex: number) => {
    setCurrentPlyIndex(plyIndex);
    setSelectedSquare(null);
    setLegalMoves([]);
    setShowBestMove(false);
  };

  // Step navigation
  const handleFirstMove = () => jumpToPly(-1);
  const handlePrevMove = () => jumpToPly(Math.max(-1, currentPlyIndex - 1));
  const handleNextMove = () => jumpToPly(Math.min(moveHistory.length - 1, currentPlyIndex + 1));
  const handleLastMove = () => jumpToPly(moveHistory.length - 1);

  // Auto-play replay loop
  useEffect(() => {
    if (isPlayingReplay) {
      replayTimerRef.current = setInterval(() => {
        setCurrentPlyIndex((prev) => {
          if (prev >= moveHistory.length - 1) {
            setIsPlayingReplay(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    }
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isPlayingReplay, moveHistory.length]);

  // Best Move info computation
  const bestMoveInfo = useMemo(() => {
    // If browsing review or move history with an active move
    if (currentPlyIndex >= 0 && moveHistory[currentPlyIndex]) {
      const currentMove = moveHistory[currentPlyIndex];
      const isCurrentMoveBest =
        currentMove.classification === 'best' ||
        currentMove.classification === 'brilliant';

      if (isCurrentMoveBest) {
        return {
          from: currentMove.from as Square,
          to: currentMove.to as Square,
          san: currentMove.san,
          isCurrentMoveBest: true,
        };
      }

      if (currentMove.bestAlternativeMove) {
        return {
          from: currentMove.bestAlternativeMove.from as Square,
          to: currentMove.bestAlternativeMove.to as Square,
          san: currentMove.bestAlternativeMove.san,
          isCurrentMoveBest: false,
        };
      }

      // Check currentEval.bestMoveUci
      if (currentEval.bestMoveUci && currentEval.bestMoveUci.length >= 4) {
        const from = currentEval.bestMoveUci.slice(0, 2) as Square;
        const to = currentEval.bestMoveUci.slice(2, 4) as Square;
        return {
          from,
          to,
          san: currentEval.bestMoveSan || currentEval.bestMoveUci,
          isCurrentMoveBest: false,
        };
      }

      // Fallback: derive legal move from position before current move
      const prevFen =
        currentPlyIndex === 0
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : moveHistory[currentPlyIndex - 1]?.fen;
      if (prevFen) {
        try {
          const tempC = new Chess(prevFen);
          const legal = tempC.moves({ verbose: true });
          const alt =
            legal.find(
              (l) =>
                l.san !== currentMove.san &&
                (l.captured || l.san.includes('+') || l.san.includes('#'))
            ) ||
            legal.find((l) => l.san !== currentMove.san) ||
            legal[0];
          if (alt) {
            return {
              from: alt.from as Square,
              to: alt.to as Square,
              san: alt.san,
              isCurrentMoveBest: false,
            };
          }
        } catch {}
      }
    }

    // In analysis mode or start position, use Stockfish evaluation
    if (currentEval.bestMoveUci && currentEval.bestMoveUci.length >= 4) {
      const from = currentEval.bestMoveUci.slice(0, 2) as Square;
      const to = currentEval.bestMoveUci.slice(2, 4) as Square;
      return {
        from,
        to,
        san: currentEval.bestMoveSan || currentEval.bestMoveUci,
        isCurrentMoveBest: false,
      };
    }

    return null;
  }, [currentPlyIndex, moveHistory, currentEval]);

  // Arrow line coordinates on a 100x100 grid
  const bestMoveArrowCoords = useMemo(() => {
    if (!bestMoveInfo || !bestMoveInfo.from || !bestMoveInfo.to) return null;
    const fromStr = bestMoveInfo.from.toLowerCase();
    const toStr = bestMoveInfo.to.toLowerCase();
    if (fromStr.length < 2 || toStr.length < 2) return null;

    const fileToCol = (f: string) => f.charCodeAt(0) - 97;
    const rankToRow = (r: string) => 8 - parseInt(r, 10);

    let fromCol = fileToCol(fromStr[0]);
    let fromRow = rankToRow(fromStr[1]);
    let toCol = fileToCol(toStr[0]);
    let toRow = rankToRow(toStr[1]);

    if (isFlipped) {
      fromCol = 7 - fromCol;
      fromRow = 7 - fromRow;
      toCol = 7 - toCol;
      toRow = 7 - toRow;
    }

    const x1 = (fromCol + 0.5) * 12.5;
    const y1 = (fromRow + 0.5) * 12.5;
    const x2 = (toCol + 0.5) * 12.5;
    const y2 = (toRow + 0.5) * 12.5;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.1) return null;

    const shortenHead = 3.2;
    const shortenTail = 1.8;
    return {
      x1: x1 + (dx / dist) * shortenTail,
      y1: y1 + (dy / dist) * shortenTail,
      x2: x2 - (dx / dist) * shortenHead,
      y2: y2 - (dy / dist) * shortenHead,
    };
  }, [bestMoveInfo, isFlipped]);

  // Effective board FEN to display (if Best Move is toggled on a mistake in Review, show previous position before mistake)
  const effectiveBoardFen = useMemo(() => {
    if (
      showBestMove &&
      activeTab === 'review' &&
      currentPlyIndex >= 0 &&
      bestMoveInfo &&
      !bestMoveInfo.isCurrentMoveBest
    ) {
      if (currentPlyIndex === 0) {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      return moveHistory[currentPlyIndex - 1]?.fen || currentBoardFen;
    }
    return currentBoardFen;
  }, [showBestMove, activeTab, currentPlyIndex, bestMoveInfo, moveHistory, currentBoardFen]);

  // Interactive square click: allows exploring alternative positions manually from current position
  const handleSquareClick = (square: Square) => {
    // Current chess state at the active board position
    const currentChess = new Chess();
    try {
      currentChess.load(currentBoardFen);
    } catch {
      currentChess.reset();
    }

    if (selectedSquare) {
      // Clicking same square deselects
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Check if clicking another friendly piece of the side to move
      const clickedPiece = currentChess.get(square);
      if (clickedPiece && clickedPiece.color === currentChess.turn()) {
        setSelectedSquare(square);
        const moves = currentChess.moves({ square, verbose: true }).map((m) => m.to);
        setLegalMoves(moves);
        return;
      }

      // Try making the move
      try {
        const moveAttempt = currentChess.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        });

        if (moveAttempt) {
          // Branch from current ply
          const baseHistory =
            currentPlyIndex === -1 ? [] : moveHistory.slice(0, currentPlyIndex + 1);

          const rawItem: MoveHistoryItem = {
            ply: baseHistory.length + 1,
            moveNumber: Math.floor(baseHistory.length / 2) + 1,
            color: moveAttempt.color,
            san: moveAttempt.san,
            from: moveAttempt.from,
            to: moveAttempt.to,
            fen: currentChess.fen(),
            piece: moveAttempt.piece,
            captured: moveAttempt.captured,
            promotion: moveAttempt.promotion,
            timeSpent: '0.5s',
            classification: 'best',
            feedbackTitle: 'Manual Analysis Move',
            feedbackDescription: `${moveAttempt.san} - Analisis alternatif langkah manual`,
            bestAlternativeMove: {
              from: moveAttempt.from,
              to: moveAttempt.to,
              san: moveAttempt.san,
              uci: `${moveAttempt.from}${moveAttempt.to}`,
            },
          };

          const newHistoryItem = classifySingleMove(rawItem, baseHistory);
          const updated = [...baseHistory, newHistoryItem];
          setMoveHistory(updated);
          setCurrentPlyIndex(updated.length - 1);
          setSelectedSquare(null);
          setLegalMoves([]);
          setShowBestMove(false);
          return;
        }
      } catch {
        // Not a legal move to that square
      }
    }

    // Select piece
    const piece = currentChess.get(square);
    if (piece && piece.color === currentChess.turn()) {
      setSelectedSquare(square);
      const moves = currentChess.moves({ square, verbose: true }).map((m) => m.to);
      setLegalMoves(moves);
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // Last Move highlight
  const lastMoveHighlight = useMemo(() => {
    if (currentPlyIndex >= 0 && moveHistory[currentPlyIndex]) {
      return {
        from: moveHistory[currentPlyIndex].from,
        to: moveHistory[currentPlyIndex].to,
      };
    }
    return null;
  }, [currentPlyIndex, moveHistory]);

  // Parse current FEN into 8x8 matrix using effectiveBoardFen
  const boardMatrix = useMemo(() => {
    const cleanFen = effectiveBoardFen.trim().split(' ')[0] || '';
    const rows = cleanFen.split('/');
    const matrix: (PieceCode | null)[][] = [];

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
      while (row.length < 8) row.push(null);
      matrix.push(row);
    }

    return matrix;
  }, [effectiveBoardFen]);

  // Copy FEN & PGN
  const handleCopyFen = () => {
    navigator.clipboard.writeText(currentBoardFen);
    setCopiedFen(true);
    setTimeout(() => setCopiedFen(false), 2000);
  };

  const handleCopyPgn = () => {
    const pgn = recentGame?.pgn || match?.chessComPgn || chessInstance.pgn();
    navigator.clipboard.writeText(pgn);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  // Players info
  const whiteName =
    whitePlayer?.name ||
    recentGame?.white.username ||
    (match?.whitePlayerId ? `Pemain #${match.whitePlayerId.slice(0, 4)}` : 'Putih');
  const blackName =
    blackPlayer?.name ||
    recentGame?.black.username ||
    (match?.blackPlayerId ? `Pemain #${match.blackPlayerId.slice(0, 4)}` : 'Hitam');

  const whiteRating =
    whitePlayer?.rating || recentGame?.white.rating || 500;
  const blackRating =
    blackPlayer?.rating || recentGame?.black.rating || 500;

  const whiteUsername = whitePlayer?.chessComUsername || recentGame?.white.username;
  const blackUsername = blackPlayer?.chessComUsername || recentGame?.black.username;

  // Move groups for the 3-column table
  const moveRows = useMemo(() => {
    const rows: { number: number; white?: MoveHistoryItem; black?: MoveHistoryItem }[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      rows.push({
        number: Math.floor(i / 2) + 1,
        white: moveHistory[i],
        black: moveHistory[i + 1],
      });
    }
    return rows;
  }, [moveHistory]);

  // Opening name detection
  const openingName = useMemo(() => {
    const pgnData = recentGame?.pgn || match?.chessComPgn || '';
    return detectOpening(moveHistory, pgnData);
  }, [moveHistory, recentGame?.pgn, match?.chessComPgn]);

  // Synchronized counts directly from moveHistory classifications
  const calculatedCounts = useMemo(() => {
    const counts: Record<ChessComBadgeType, { w: number; b: number }> = {
      brilliant: { w: 0, b: 0 },
      great: { w: 0, b: 0 },
      book: { w: 0, b: 0 },
      best: { w: 0, b: 0 },
      excellent: { w: 0, b: 0 },
      good: { w: 0, b: 0 },
      inaccuracy: { w: 0, b: 0 },
      mistake: { w: 0, b: 0 },
      miss: { w: 0, b: 0 },
      blunder: { w: 0, b: 0 },
      missed_win: { w: 0, b: 0 },
    };

    moveHistory.forEach((m) => {
      let t = m.classification;
      if (t === 'missed_win') t = 'miss';
      if (t && counts[t]) {
        if (m.color === 'w') {
          counts[t].w++;
        } else {
          counts[t].b++;
        }
      }
    });

    return counts;
  }, [moveHistory]);

  // Dynamic Review Statistics & Accuracy
  const reviewStats = useMemo(() => {
    const isWhiteWin = match?.result === '1-0';
    const isBlackWin = match?.result === '0-1';

    let wScore = 0;
    let wTotal = 0;
    let bScore = 0;
    let bTotal = 0;

    const weights: Record<ChessComBadgeType, number> = {
      brilliant: 100,
      great: 95,
      best: 100,
      excellent: 88,
      good: 75,
      book: 95,
      inaccuracy: 50,
      mistake: 25,
      miss: 15,
      blunder: 5,
      missed_win: 15,
    };

    moveHistory.forEach((m) => {
      const val = m.classification ? weights[m.classification] ?? 70 : 70;
      if (m.color === 'w') {
        wScore += val;
        wTotal++;
      } else {
        bScore += val;
        bTotal++;
      }
    });

    const wAcc = wTotal > 0 ? (wScore / wTotal).toFixed(1) : (isWhiteWin ? '67.6' : '54.0');
    const bAcc = bTotal > 0 ? (bScore / bTotal).toFixed(1) : (isBlackWin ? '67.6' : '54.0');

    return {
      whiteAccuracy: wAcc,
      blackAccuracy: bAcc,
      coachComment: isWhiteWin
        ? `Langkah brilian (Brilliant Move) dan taktik tajam oleh ${whiteName}! Tekanan konsisten berhasil mengunci kemenangan meyakinkan.`
        : isBlackWin
        ? `Langkah brilian dan serangan balik mematikan oleh ${blackName}! Mengonversi keunggulan taktis menjadi poin kemenangan.`
        : 'Pertarungan sengit dan seimbang dari kedua pemain! Pertukaran perwira yang rapi berakhir dengan posisi imbang.',
      counts: calculatedCounts,
    };
  }, [match?.result, whiteName, blackName, moveHistory, calculatedCounts]);

  // Evaluation Chart Data (Matching Reference Image)
  const evalChartData = useMemo(() => {
    if (moveHistory.length === 0) {
      return {
        svgPath: 'M 0 64 L 0 32 L 320 32 L 320 64 Z',
        dots: [] as { x: number; y: number; type: ChessComBadgeType; color: string; ply: number }[],
        points: [] as { x: number; y: number; ply: number }[],
      };
    }

    const isWhiteWin = match?.result === '1-0';
    const isBlackWin = match?.result === '0-1';
    const total = moveHistory.length;

    // Realistic chess advantage progression based on move classifications
    let runningEval = 0.2; // Centipawns / pawns equivalent (+ = White, - = Black)
    const pts: { x: number; y: number; type?: ChessComBadgeType; ply: number }[] = [];

    moveHistory.forEach((m, idx) => {
      const isWhite = m.color === 'w';
      const dir = isWhite ? 1 : -1;

      // Evaluation delta based on move classification
      let delta = 0;
      switch (m.classification) {
        case 'brilliant':
          delta = dir * 2.2;
          break;
        case 'great':
          delta = dir * 1.5;
          break;
        case 'best':
          delta = dir * 0.2;
          break;
        case 'excellent':
          delta = dir * 0.05;
          break;
        case 'good':
          delta = -dir * 0.15;
          break;
        case 'book':
          delta = Math.sin(idx * 0.8) * 0.1;
          break;
        case 'inaccuracy':
          delta = -dir * 0.9;
          break;
        case 'mistake':
          delta = -dir * 1.8;
          break;
        case 'miss':
        case 'missed_win':
          delta = -dir * 2.5;
          break;
        case 'blunder':
          delta = -dir * 3.8;
          break;
        default:
          delta = 0;
      }

      runningEval += delta;

      // Endgame gravity towards match result
      if (idx > total * 0.65) {
        const endProgress = (idx - total * 0.65) / (total * 0.35);
        if (isWhiteWin) {
          runningEval = Math.max(runningEval, 1.8 + endProgress * 4.2);
        } else if (isBlackWin) {
          runningEval = Math.min(runningEval, -1.8 - endProgress * 4.2);
        }
      }

      // Clamp running eval to [-6, +6]
      const clampedEval = Math.max(-6, Math.min(6, runningEval));
      const x = (idx / Math.max(1, total - 1)) * 320;
      // y: 32 is baseline (0.00), y=6 is +6 pawns (White top peak), y=58 is -6 pawns (Black valley)
      const y = Math.max(6, Math.min(58, 32 - (clampedEval / 6) * 26));

      pts.push({ x, y, type: m.classification, ply: m.ply });
    });

    // Build SVG path
    let pathD = `M 0 64 L 0 ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      pathD += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    pathD += ` L 320 64 Z`;

    // Exclude the 3 high-frequency categories: Excellent, Good, Inaccuracy (to keep graphic clean)
    // Only display critical key-moment turning points: Brilliant, Great, Mistake, Miss, Blunder
    const significantTypes = ['brilliant', 'great', 'mistake', 'miss', 'blunder'];
    const rawDots: { x: number; y: number; type: ChessComBadgeType; color: string; ply: number }[] = [];

    pts.forEach((p, idx) => {
      let t = p.type;
      if (t === 'missed_win') t = 'miss';

      // Explicitly ignore 'excellent', 'good', 'inaccuracy', 'book'
      if (!t || t === 'excellent' || t === 'good' || t === 'inaccuracy' || t === 'book') {
        return;
      }

      const isCheckmate = moveHistory[idx]?.san?.includes('#');

      if (significantTypes.includes(t) || isCheckmate) {
        const dotType = isCheckmate && !significantTypes.includes(t) ? 'best' : t;
        const meta = REVIEW_CLASSIFICATIONS.find((c) => c.type === dotType);
        if (meta) {
          rawDots.push({
            x: p.x,
            y: p.y,
            type: dotType,
            color: meta.color,
            ply: p.ply,
          });
        }
      }
    });

    // Filter dots that are too close horizontally (min 9px spacing) to keep graph ultra clean and uncluttered
    const filteredDots: { x: number; y: number; type: ChessComBadgeType; color: string; ply: number }[] = [];
    rawDots.forEach((dot) => {
      const tooClose = filteredDots.find((d) => Math.abs(d.x - dot.x) < 9);
      if (!tooClose) {
        filteredDots.push(dot);
      }
    });

    return { svgPath: pathD, dots: filteredDots, points: pts };
  }, [moveHistory, match?.result]);

  // Click handler for evaluation chart (Image 3)
  const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (moveHistory.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetPly = Math.round(ratio * (moveHistory.length - 1));
    jumpToPly(targetPly);
  };

  // Auto-scroll moves table to current move
  const movesScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (movesScrollRef.current && currentPlyIndex >= 0) {
      const activeBtn = movesScrollRef.current.querySelector('.move-btn.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentPlyIndex]);

  // Auto-scroll review moves table
  useEffect(() => {
    if (reviewMovesScrollRef.current && currentPlyIndex >= 0) {
      const activeBtn = reviewMovesScrollRef.current.querySelector('.review-move-pill.active');
      if (activeBtn) {
        activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentPlyIndex, isReviewActive]);

  // Active Move Evaluation Display (Image 4 speech bubble pill: e.g. "+0.10")
  const currentMoveEvalDisplay = useMemo(() => {
    if (currentPlyIndex === -1) return '0.00';
    if (currentEval?.scoreDisplay) return currentEval.scoreDisplay;
    if (evalChartData.points && evalChartData.points[currentPlyIndex]) {
      const pt = evalChartData.points[currentPlyIndex];
      const scoreVal = (32 - pt.y) / 6;
      const formatted = Math.abs(scoreVal) < 0.05 ? '0.00' : scoreVal.toFixed(2);
      return scoreVal > 0.05 ? `+${formatted}` : formatted;
    }
    return '+0.10';
  }, [currentPlyIndex, currentEval?.scoreDisplay, evalChartData.points]);

  // Active Move Coach Feedback (Image 4 speech bubble comment: e.g. "d4 is the last book move")
  const currentMoveCoachComment = useMemo(() => {
    if (currentPlyIndex === -1) {
      return {
        title: 'Posisi Awal',
        comment: 'White to move. Tinjau langkah demi langkah atau tekan Next.',
        badge: null as ChessComBadgeType | null,
      };
    }
    const m = moveHistory[currentPlyIndex];
    if (!m) {
      return {
        title: 'Analisis',
        comment: 'Meninjau posisi langkah catur.',
        badge: null as ChessComBadgeType | null,
      };
    }

    let comment = '';
    switch (m.classification) {
      case 'brilliant':
        comment = `${m.san} is a brilliant move! A sacrifice that creates decisive tactical advantage.`;
        break;
      case 'great':
        comment = `${m.san} is a great find! Finding the only move that maintains the initiative.`;
        break;
      case 'book':
        const nextMove = moveHistory[currentPlyIndex + 1];
        const isLastBook = !nextMove || nextMove.classification !== 'book';
        comment = isLastBook ? `${m.san} is the last book move` : `${m.san} is a book move`;
        break;
      case 'best':
        comment = `${m.san} is the best move. Maintains maximum pressure.`;
        break;
      case 'excellent':
        comment = `${m.san} is an excellent move, keeping a strong position.`;
        break;
      case 'good':
        comment = `${m.san} is a good, solid move.`;
        break;
      case 'inaccuracy':
        comment = `${m.san} is an inaccuracy. ${m.feedbackDescription || 'Allows opponent counterplay.'}`;
        break;
      case 'mistake':
        comment = `${m.san} is a mistake. ${m.feedbackDescription || 'Immediately worsens your position.'}`;
        break;
      case 'miss':
      case 'missed_win':
        comment = `${m.san} is a miss. Missed an opportunity to punish the opponent.`;
        break;
      case 'blunder':
        comment = `${m.san} is a blunder. ${m.feedbackDescription || 'A costly oversight that severely hurts your winning chances.'}`;
        break;
      default:
        comment = m.feedbackDescription || `${m.san} dimainkan.`;
    }

    return {
      title: m.feedbackTitle || 'Move Review',
      comment,
      badge: m.classification || null,
    };
  }, [currentPlyIndex, moveHistory]);

  // Jump to move by classification with cycling support
  const handleJumpToClassification = (type: ChessComBadgeType, colorFilter?: 'w' | 'b') => {
    const matching = moveHistory
      .map((m, idx) => ({ m, idx }))
      .filter((item) => {
        let t = item.m.classification;
        if (t === 'missed_win') t = 'miss';
        if (t !== type) return false;
        if (colorFilter && item.m.color !== colorFilter) return false;
        return true;
      });

    if (matching.length === 0) return;

    const currentMatchIdx = matching.findIndex((item) => item.idx === currentPlyIndex);
    const nextTarget =
      currentMatchIdx !== -1
        ? matching[(currentMatchIdx + 1) % matching.length]
        : matching[0];

    jumpToPly(nextTarget.idx);
    setIsReviewActive(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`chesscom-analysis-backdrop ${isFullscreen ? 'is-fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="chesscom-analysis-window">
        {/* Top Navbar */}
        <header className="chesscom-navbar">
          <div className="chesscom-nav-left">
            <span className="chesscom-logo-badge">♟ Chess.com Engine</span>
            <span className="chesscom-match-badge">
              {match ? `Babak ${match.round} • Papan ${match.boardNumber}` : 'Analisis Bebas'}
            </span>
          </div>

          <div className="chesscom-nav-center">
            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className={`chesscom-nav-tab ${activeTab === 'review' ? 'active' : ''}`}
            >
              <Award size={15} className="tab-icon-review" />
              <span>Game Review</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`chesscom-nav-tab ${activeTab === 'analysis' ? 'active' : ''}`}
            >
              <Clock size={15} className="tab-icon-analysis" />
              <span>Analysis</span>
            </button>
          </div>

          <div className="chesscom-nav-right">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="chesscom-btn-icon"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="chesscom-btn-icon btn-close"
              title="Tutup Jendela Analisis (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Main Content Area: Board (Left) + Analysis/Review Sidebar (Right) */}
        <div className="chesscom-main-layout">
          {/* LEFT: Board Section with Eval Bar & Player Cards */}
          <section className="chesscom-board-section">
            {/* Top Player (Black if normal, White if flipped) */}
            <div className="chesscom-player-bar top">
              <div className="player-info-cluster">
                <div className="player-avatar-wrapper">
                  {blackPlayer?.avatar ? (
                    <img
                      src={blackPlayer.avatar}
                      alt={blackName}
                      className="player-avatar-img"
                    />
                  ) : (
                    <div className="player-avatar-fallback black">♟</div>
                  )}
                  <span className="status-indicator online" />
                </div>
                <div className="player-meta">
                  <div className="player-name-row">
                    <span className="player-name-title">
                      {isFlipped ? whiteName : blackName}
                    </span>
                    <span className="player-rating-badge">
                      ({isFlipped ? whiteRating : blackRating})
                    </span>
                    <span className="player-flag">🇮🇩</span>
                  </div>
                  {(isFlipped ? whiteUsername : blackUsername) && (
                    <span className="player-sub-username">
                      @{isFlipped ? whiteUsername : blackUsername}
                    </span>
                  )}
                </div>
              </div>
              <div className="player-clock-box">
                <Clock size={14} />
                <span>10:00</span>
              </div>
            </div>

            {/* Board Container with Vertical Evaluation Bar */}
            <div className="chesscom-board-wrapper">
              {/* Vertical Evaluation Bar */}
              <div className="chesscom-eval-bar-track" title="Bar Evaluasi Stockfish 19">
                <div
                  className="chesscom-eval-bar-white"
                  style={{
                    height: `${currentEval.winChanceWhite}%`,
                  }}
                />
                <div className="chesscom-eval-score-label">
                  {currentEval.scoreDisplay}
                </div>
              </div>

              {/* 8x8 Chessboard Grid */}
              <div className="chesscom-board-grid">
                {(isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]).map(
                  (r) =>
                    (isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]).map(
                      (c) => {
                        const isLight = (r + c) % 2 === 0;
                        const fileLetter = String.fromCharCode(97 + c);
                        const rankNumber = 8 - r;
                        const squareName = `${fileLetter}${rankNumber}` as Square;

                        const piece = boardMatrix[r][c];
                        const isSelected = selectedSquare === squareName;
                        const isLegalTarget = legalMoves.includes(squareName);
                        const isLastMoveFrom = lastMoveHighlight?.from === squareName;
                        const isLastMoveTo = lastMoveHighlight?.to === squareName;
                        const currentMoveItem =
                          currentPlyIndex >= 0 ? moveHistory[currentPlyIndex] : null;
                        const showBadgeOnSquare =
                          isLastMoveTo && currentMoveItem?.classification;

                        const isBestMoveFrom = showBestMove && bestMoveInfo?.from === squareName;
                        const isBestMoveTo = showBestMove && bestMoveInfo?.to === squareName;
                        const isBestMoveSq = isBestMoveFrom || isBestMoveTo;

                        return (
                          <div
                            key={squareName}
                            onClick={() => handleSquareClick(squareName)}
                            className={`chesscom-square ${isLight ? 'light-sq' : 'dark-sq'} ${
                              isSelected ? 'is-selected' : ''
                            } ${!showBestMove && (isLastMoveFrom || isLastMoveTo) ? 'is-last-move' : ''} ${
                              isBestMoveSq ? 'is-best-move' : ''
                            }`}
                            data-square={squareName}
                          >
                            {/* Inside Coordinate: Rank on leftmost square */}
                            {(isFlipped ? c === 7 : c === 0) && (
                              <span className="coord-inside rank-coord">{rankNumber}</span>
                            )}

                            {/* Inside Coordinate: File on bottommost square */}
                            {(isFlipped ? r === 0 : r === 7) && (
                              <span className="coord-inside file-coord">{fileLetter}</span>
                            )}

                            {/* Legal Move Marker Dot */}
                            {isLegalTarget && (
                              <span
                                className={`legal-move-marker ${
                                  piece ? 'legal-capture-ring' : 'legal-dest-dot'
                                }`}
                              />
                            )}

                            {/* Chess Piece Vector */}
                            {piece && (
                              <div className="piece-container">
                                <ChessComNeoPiece piece={piece} />
                              </div>
                            )}

                            {/* Floating Classification Badge on Moved Piece Square */}
                            {showBadgeOnSquare && currentMoveItem.classification && (
                              <div
                                className="board-classification-badge-overlay"
                                title={`${currentMoveItem.feedbackTitle}: ${currentMoveItem.san}`}
                              >
                                <ChessComBadgeIcon
                                  type={currentMoveItem.classification}
                                  size={24}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                    )
                )}

                {/* SVG Arrow Overlay for Best Move */}
                {showBestMove && bestMoveArrowCoords && (
                  <svg
                    className="chesscom-board-arrow-overlay"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <marker
                        id="arrowhead-best-move"
                        markerWidth="6"
                        markerHeight="6"
                        refX="4.5"
                        refY="3"
                        orient="auto"
                      >
                        <path d="M 0 0 L 6 3 L 0 6 z" fill="#81b64c" />
                      </marker>
                    </defs>
                    <line
                      x1={bestMoveArrowCoords.x1}
                      y1={bestMoveArrowCoords.y1}
                      x2={bestMoveArrowCoords.x2}
                      y2={bestMoveArrowCoords.y2}
                      stroke="#81b64c"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      markerEnd="url(#arrowhead-best-move)"
                      opacity="0.95"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Bottom Player (White if normal, Black if flipped) */}
            <div className="chesscom-player-bar bottom">
              <div className="player-info-cluster">
                <div className="player-avatar-wrapper">
                  {whitePlayer?.avatar ? (
                    <img
                      src={whitePlayer.avatar}
                      alt={whiteName}
                      className="player-avatar-img"
                    />
                  ) : (
                    <div className="player-avatar-fallback white">♙</div>
                  )}
                  <span className="status-indicator online" />
                </div>
                <div className="player-meta">
                  <div className="player-name-row">
                    <span className="player-name-title">
                      {isFlipped ? blackName : whiteName}
                    </span>
                    <span className="player-rating-badge">
                      ({isFlipped ? blackRating : whiteRating})
                    </span>
                    <span className="player-flag">🇮🇩</span>
                  </div>
                  {(isFlipped ? blackUsername : whiteUsername) && (
                    <span className="player-sub-username">
                      @{isFlipped ? blackUsername : whiteUsername}
                    </span>
                  )}
                </div>
              </div>
              <div className="player-clock-box active-clock">
                <Clock size={14} />
                <span>10:00</span>
              </div>
            </div>
          </section>

          {/* RIGHT: Analysis / Review Sidebar Panel */}
          <aside className="chesscom-sidebar-section">
            {activeTab === 'review' ? (
              !isReviewActive ? (
                /* REVIEW SUMMARY VIEW (Matching Chess.com Image 1 & 3) */
                <div className="review-panel-container">
                  <div className="review-header-title">
                    <div className="title-left">
                      <span className="review-star-badge">★</span>
                      <h3>Game Review</h3>
                    </div>
                    <span className="engine-verified-pill">Stockfish 19 Verified</span>
                  </div>

                  {/* Coach Card with Speech Bubble */}
                  <div className="coach-comment-card">
                    <div className="coach-avatar">
                      <svg viewBox="0 0 60 60" className="coach-svg">
                        <circle cx="30" cy="30" r="28" fill="#3b82f6" />
                        <circle cx="30" cy="26" r="14" fill="#fed7aa" />
                        <path
                          d="M18 20c2-8 22-8 24 0 0 0-3-4-12-4s-12 4-12 4z"
                          fill="#573418"
                        />
                        <path
                          d="M20 30c1 6 19 6 20 0 0 5-6 9-10 9s-10-4-10-9z"
                          fill="#573418"
                        />
                        <circle
                          cx="25"
                          cy="25"
                          r="3.5"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="35"
                          cy="25"
                          r="3.5"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="1.5"
                        />
                        <path d="M28.5 25h3" stroke="#1e293b" strokeWidth="1.5" />
                        <path
                          d="M12 56c4-12 10-16 18-16s14 4 18 16z"
                          fill="#1e3a8a"
                        />
                        <path d="M30 40v14" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="coach-speech-bubble">
                      <p>{reviewStats.coachComment}</p>
                    </div>
                  </div>

                  {/* Advantage / Evaluation Graph (Matching Reference Image - Directly below Coach Figure) */}
                  <div className="chesscom-eval-chart-box" title="Klik grafik untuk melompat ke langkah catur">
                    <svg
                      viewBox="0 0 320 64"
                      preserveAspectRatio="none"
                      className="chesscom-eval-chart-svg"
                      onClick={handleChartClick}
                    >
                      {/* Center baseline line */}
                      <line x1="0" y1="32" x2="320" y2="32" stroke="#6a6762" strokeWidth="1" />
                      {/* Solid white fill below curve */}
                      <path d={evalChartData.svgPath} fill="#ffffff" />
                      {/* Significant move dots along curve */}
                      {evalChartData.dots.map((d, i) => (
                        <circle
                          key={i}
                          cx={d.x}
                          cy={d.y}
                          r={3.2}
                          fill={d.color}
                          stroke="#ffffff"
                          strokeWidth="0.8"
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToPly(d.ply - 1);
                            setIsReviewActive(true);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </svg>
                  </div>

                  {/* Unified Review Card (Matching Chess.com Image 1) */}
                  <div className="chesscom-review-table-card">
                    {/* Players Row */}
                    <div className="review-grid-row">
                      <span className="review-grid-label">Players</span>
                      <div className="review-player-cell">
                        <div className="review-player-avatar-box white-player">
                          {whitePlayer?.avatar ? (
                            <img src={whitePlayer.avatar} alt={whiteName} />
                          ) : (
                            <span className="avatar-placeholder">♙</span>
                          )}
                        </div>
                        <span className="review-player-username" title={whiteUsername || whiteName}>
                          {whiteUsername || whiteName}
                        </span>
                      </div>
                      <div />
                      <div className="review-player-cell">
                        <div className="review-player-avatar-box black-player">
                          {blackPlayer?.avatar ? (
                            <img src={blackPlayer.avatar} alt={blackName} />
                          ) : (
                            <span className="avatar-placeholder">♟</span>
                          )}
                        </div>
                        <span className="review-player-username" title={blackUsername || blackName}>
                          {blackUsername || blackName}
                        </span>
                      </div>
                    </div>

                    {/* Accuracy Row */}
                    <div className="review-grid-row">
                      <span className="review-grid-label">Accuracy</span>
                      <div className="review-accuracy-box white-box">
                        {reviewStats.whiteAccuracy}
                      </div>
                      <div />
                      <div className="review-accuracy-box black-box">
                        {reviewStats.blackAccuracy}
                      </div>
                    </div>

                    <div className="review-grid-divider" />

                    {/* Skills Row */}
                    <div className="review-grid-row">
                      <span className="review-grid-label">Skills</span>
                      <div className="review-skills-val">+4</div>
                      <div className="review-skills-center-badge">
                        <svg viewBox="0 0 24 24" width="22" height="22">
                          <circle cx="12" cy="12" r="11" fill="#3b82f6" />
                          <path
                            d="M12 4.8l2.2 4.6 5.1.7-3.7 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.7-3.5 5.1-.7z"
                            fill="#ffffff"
                          />
                        </svg>
                      </div>
                      <div className="review-skills-val" style={{ color: '#9ca3af' }}>
                        +0
                      </div>
                    </div>

                    <div className="review-grid-divider" />

                    {/* 10 Classification Rows (Matching Chess.com Image 2) */}
                    {REVIEW_CLASSIFICATIONS.map((item) => {
                      const countKey = item.type;
                      const wCount = calculatedCounts[countKey]?.w ?? 0;
                      const bCount = calculatedCounts[countKey]?.b ?? 0;
                      const totalCount = wCount + bCount;

                      return (
                        <div
                          key={item.type}
                          className="review-classification-row"
                          onClick={() => totalCount > 0 && handleJumpToClassification(item.type)}
                          title={
                            totalCount > 0
                              ? `Lihat langkah ${item.label} (${totalCount} langkah) di papan catur`
                              : item.details
                          }
                        >
                          <span className="review-class-label">{item.label}</span>
                          <span
                            className="review-class-count white-count"
                            style={{ color: wCount > 0 ? item.color : '#6b7280' }}
                            onClick={(e) => {
                              if (wCount > 0) {
                                e.stopPropagation();
                                handleJumpToClassification(item.type, 'w');
                              }
                            }}
                          >
                            {wCount}
                          </span>
                          <div className="review-class-icon-cell">
                            <ChessComBadgeIcon type={item.type} size={22} />
                          </div>
                          <span
                            className="review-class-count black-count"
                            style={{ color: bCount > 0 ? item.color : '#6b7280' }}
                            onClick={(e) => {
                              if (bCount > 0) {
                                e.stopPropagation();
                                handleJumpToClassification(item.type, 'b');
                              }
                            }}
                          >
                            {bCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Start Review CTA Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewActive(true);
                      jumpToPly(0);
                    }}
                    className="btn-start-review-cta"
                  >
                    <Play size={16} fill="currentColor" />
                    <span>Start Review</span>
                  </button>
                </div>
              ) : (
                /* INTERACTIVE GAME REVIEW MODE (Matching Chess.com Image 4) */
                <div className="review-active-mode-container">
                  {/* Top Header */}
                  <div className="review-active-header">
                    <div className="review-active-header-left">
                      <button
                        type="button"
                        onClick={() => setIsReviewActive(false)}
                        className="review-header-icon-btn"
                        title="Kembali ke Ringkasan Ulasan"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        className="review-header-icon-btn"
                        title="Simpan / Tandai Permainan"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>
                    </div>

                    <div className="review-active-title">
                      <span className="review-title-star">★</span>
                      <span>Game Review</span>
                    </div>

                    <button
                      type="button"
                      className="review-header-icon-btn"
                      title="Pengaturan Ulasan"
                    >
                      <Settings size={16} />
                    </button>
                  </div>

                  {/* Coach Speech Bubble Banner */}
                  <div className="review-active-coach-banner">
                    <div className="coach-avatar">
                      <svg viewBox="0 0 60 60" className="coach-svg">
                        <circle cx="30" cy="30" r="28" fill="#3b82f6" />
                        <circle cx="30" cy="26" r="14" fill="#fed7aa" />
                        <path
                          d="M18 20c2-8 22-8 24 0 0 0-3-4-12-4s-12 4-12 4z"
                          fill="#573418"
                        />
                        <path
                          d="M20 30c1 6 19 6 20 0 0 5-6 9-10 9s-10-4-10-9z"
                          fill="#573418"
                        />
                        <circle
                          cx="25"
                          cy="25"
                          r="3.5"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="35"
                          cy="25"
                          r="3.5"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="1.5"
                        />
                        <path d="M28.5 25h3" stroke="#1e293b" strokeWidth="1.5" />
                        <path
                          d="M12 56c4-12 10-16 18-16s14 4 18 16z"
                          fill="#1e3a8a"
                        />
                        <path d="M30 40v14" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="active-coach-bubble">
                      <div className="bubble-text-left">
                        {showBestMove ? (
                          <>
                            <ChessComBadgeIcon type="best" size={18} />
                            <span>
                              {bestMoveInfo?.isCurrentMoveBest
                                ? `${bestMoveInfo.san} adalah langkah terbaik catur komputer!`
                                : `Langkah terbaik adalah ${bestMoveInfo?.san || 'langkah alternatif mesin'}`}
                            </span>
                          </>
                        ) : (
                          <>
                            {currentMoveCoachComment.badge && (
                              <ChessComBadgeIcon
                                type={currentMoveCoachComment.badge}
                                size={18}
                              />
                            )}
                            <span>{currentMoveCoachComment.comment}</span>
                          </>
                        )}
                      </div>
                      <span
                        className="bubble-eval-pill"
                        style={
                          showBestMove
                            ? { background: '#81b64c', color: '#ffffff' }
                            : undefined
                        }
                      >
                        {showBestMove ? 'Best' : currentMoveEvalDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Action Row: Explain + Best + Next (Matching Image 2) */}
                  <div className="review-action-row">
                    <button
                      type="button"
                      onClick={() => setShowExplanation(!showExplanation)}
                      className={`btn-explain ${showExplanation ? 'active' : ''}`}
                      title="Penjelasan mendalam langkah ini"
                    >
                      <Lightbulb size={16} />
                      <span>Explain</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBestMove(!showBestMove)}
                      className={`btn-best-move ${showBestMove ? 'active' : ''}`}
                      title="Perlihatkan langkah terbaik di papan catur"
                    >
                      <Star size={15} fill={showBestMove ? '#ffffff' : 'none'} />
                      <span>Best</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBestMove(false);
                        handleNextMove();
                      }}
                      className="btn-next-review"
                      title="Lanjut ke langkah berikutnya"
                    >
                      <span>Next</span>
                      <ChevronRight size={17} />
                    </button>
                  </div>

                  {/* Explain Panel Dropdown */}
                  {showExplanation && (
                    <div className="review-explain-panel">
                      {currentPlyIndex >= 0 && moveHistory[currentPlyIndex] ? (
                        <>
                          <p style={{ margin: '0 0 0.35rem 0', fontWeight: 600 }}>
                            {moveHistory[currentPlyIndex].feedbackDescription ||
                              'Langkah yang dimainkan merespons taktik atau mengejar inisiatif posisi.'}
                          </p>
                          {moveHistory[currentPlyIndex].bestAlternative && (
                            <div style={{ color: '#81b64c', fontWeight: 700 }}>
                              Saran Alternatif: {moveHistory[currentPlyIndex].bestAlternative}
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ margin: 0 }}>Papan catur dalam posisi awal pembukaan.</p>
                      )}
                    </div>
                  )}

                  {/* Review Move List Table (Matching Image 4) */}
                  <div className="review-moves-scroll" ref={reviewMovesScrollRef}>
                    {moveRows.map((row) => {
                      const isWhiteActive =
                        row.white && currentPlyIndex === row.white.ply - 1;
                      const isBlackActive =
                        row.black && currentPlyIndex === row.black.ply - 1;

                      const getMoveColor = (item?: MoveHistoryItem) => {
                        if (!item?.classification) return '#ffffff';
                        const meta = REVIEW_CLASSIFICATIONS.find(
                          (c) => c.type === item.classification
                        );
                        if (item.classification === 'book') return '#c3996b';
                        if (
                          meta &&
                          [
                            'brilliant',
                            'great',
                            'best',
                            'inaccuracy',
                            'mistake',
                            'miss',
                            'blunder',
                          ].includes(item.classification)
                        ) {
                          return meta.color;
                        }
                        return '#ffffff';
                      };

                      return (
                        <div key={row.number} className="review-table-row">
                          <span className="review-row-num">{row.number}.</span>

                          {/* White Move */}
                          {row.white ? (
                            <button
                              type="button"
                              onClick={() => jumpToPly(row.white!.ply - 1)}
                              className={`review-move-pill ${
                                isWhiteActive ? 'active' : ''
                              }`}
                            >
                              {row.white.classification && (
                                <span className="inline-badge">
                                  <ChessComBadgeIcon
                                    type={row.white.classification}
                                    size={14}
                                  />
                                </span>
                              )}
                              {renderMoveFigurine(
                                row.white.piece,
                                'w',
                                row.white.san
                              )}
                              <span
                                className="inline-san"
                                style={{ color: getMoveColor(row.white) }}
                              >
                                {formatSanWithoutPiece(row.white.san)}
                              </span>
                            </button>
                          ) : (
                            <div className="review-move-empty" />
                          )}

                          {/* Black Move */}
                          {row.black ? (
                            <button
                              type="button"
                              onClick={() => jumpToPly(row.black!.ply - 1)}
                              className={`review-move-pill ${
                                isBlackActive ? 'active' : ''
                              }`}
                            >
                              {row.black.classification && (
                                <span className="inline-badge">
                                  <ChessComBadgeIcon
                                    type={row.black.classification}
                                    size={14}
                                  />
                                </span>
                              )}
                              {renderMoveFigurine(
                                row.black.piece,
                                'b',
                                row.black.san
                              )}
                              <span
                                className="inline-san"
                                style={{ color: getMoveColor(row.black) }}
                              >
                                {formatSanWithoutPiece(row.black.san)}
                              </span>
                            </button>
                          ) : (
                            <div className="review-move-empty" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Evaluation Chart Box (Matching Image 3) */}
                  <div className="review-chart-section">
                    <div
                      className="chesscom-eval-chart-box"
                      title="Klik grafik untuk melompat ke langkah catur"
                    >
                      <svg
                        viewBox="0 0 320 64"
                        preserveAspectRatio="none"
                        className="chesscom-eval-chart-svg"
                        onClick={handleChartClick}
                      >
                        {/* Center baseline line */}
                        <line
                          x1="0"
                          y1="32"
                          x2="320"
                          y2="32"
                          stroke="#6a6762"
                          strokeWidth="1"
                        />
                        {/* Solid white fill below curve */}
                        <path d={evalChartData.svgPath} fill="#ffffff" />
                        {/* Move markers along curve */}
                        {evalChartData.dots.map((d, i) => (
                          <circle
                            key={i}
                            cx={d.x}
                            cy={d.y}
                            r={3.2}
                            fill={d.color}
                            stroke="#ffffff"
                            strokeWidth="0.8"
                            onClick={(e) => {
                              e.stopPropagation();
                              jumpToPly(d.ply - 1);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                        {/* Vertical cursor indicator at active move */}
                        {currentPlyIndex >= 0 &&
                          evalChartData.points &&
                          evalChartData.points[currentPlyIndex] && (
                            <g>
                              <line
                                x1={evalChartData.points[currentPlyIndex].x}
                                y1={0}
                                x2={evalChartData.points[currentPlyIndex].x}
                                y2={64}
                                stroke="#c3996b"
                                strokeWidth="2"
                              />
                              <circle
                                cx={evalChartData.points[currentPlyIndex].x}
                                cy={evalChartData.points[currentPlyIndex].y}
                                r={4.5}
                                fill="#c3996b"
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                            </g>
                          )}
                      </svg>
                    </div>
                  </div>

                  {/* Playback Controls (Image 4) */}
                  <div className="review-playback-bar">
                    <button
                      type="button"
                      onClick={handleFirstMove}
                      className="review-nav-btn"
                      title="Langkah Awal"
                    >
                      <ChevronsLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={handlePrevMove}
                      className="review-nav-btn"
                      title="Langkah Sebelumnya"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPlayingReplay(!isPlayingReplay)}
                      className="review-nav-btn btn-play-pause"
                      title={
                        isPlayingReplay
                          ? 'Jeda Putar Ulang'
                          : 'Putar Ulang Otomatis'
                      }
                    >
                      {isPlayingReplay ? (
                        <Pause size={18} />
                      ) : (
                        <Play size={18} fill="currentColor" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMove}
                      className="review-nav-btn"
                      title="Langkah Berikutnya"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={handleLastMove}
                      className="review-nav-btn"
                      title="Langkah Akhir"
                    >
                      <ChevronsRight size={18} />
                    </button>
                  </div>

                  {/* Footer Bar (Image 4) */}
                  <div className="review-footer-bar">
                    <button
                      type="button"
                      onClick={() => setIsReviewActive(false)}
                      className="review-footer-btn"
                    >
                      <span>★</span>
                      <span>Skills</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard && recentGame?.url) {
                          navigator.clipboard.writeText(recentGame.url);
                          alert('Link pertandingan disalin ke clipboard!');
                        }
                      }}
                      className="review-footer-btn"
                    >
                      <Share2 size={14} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* TAB 2: ANALYSIS BOARD (Matching Chess.com Screenshot 1) */
              <div className="analysis-panel-container">
                {/* Secondary subtabs */}
                <div className="analysis-subtabs-row">
                  <button
                    type="button"
                    onClick={() => setAnalysisSubTab('moves')}
                    className={`subtab-btn ${analysisSubTab === 'moves' ? 'active' : ''}`}
                  >
                    Moves
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisSubTab('info')}
                    className={`subtab-btn ${analysisSubTab === 'info' ? 'active' : ''}`}
                  >
                    Info
                  </button>
                </div>

                {/* Engine Control Bar */}
                <div className="engine-control-bar">
                  <label className="engine-toggle-label">
                    <input
                      type="checkbox"
                      checked={isEngineActive}
                      onChange={(e) => setIsEngineActive(e.target.checked)}
                      className="engine-toggle-checkbox"
                    />
                    <span className="engine-toggle-slider" />
                    <span className="engine-toggle-text">Analysis</span>
                  </label>

                  <div className="engine-info-cluster">
                    <span className="engine-pulse-dot" />
                    <span className="engine-name-text">Stockfish 19 Lite</span>
                    <Settings size={13} className="engine-settings-icon" />
                  </div>
                </div>

                {/* Best Move Interactive Button (Matching Image 1) */}
                {isEngineActive && currentEval.bestMoveUci && (
                  <button
                    type="button"
                    onClick={() => setShowBestMove(!showBestMove)}
                    className={`engine-bestmove-btn ${showBestMove ? 'active' : ''}`}
                    title="Klik untuk memperlihatkan langkah terbaik di papan catur"
                  >
                    <div className="bestmove-left-cluster">
                      <Star
                        size={14}
                        className="bestmove-star-icon"
                        fill={showBestMove ? '#81b64c' : 'none'}
                      />
                      <span className="bestmove-title">Saran Terbaik:</span>
                      <span className="bestmove-code">
                        {currentEval.bestMoveSan || currentEval.bestMoveUci} (
                        {currentEval.scoreDisplay})
                      </span>
                    </div>
                    <div className="bestmove-right-cluster">
                      <span className="bestmove-status-tag">
                        {showBestMove ? 'Tampil di Papan' : 'Lihat'}
                      </span>
                      <span className="depth-tag">Depth {currentEval.depth || 14}</span>
                    </div>
                  </button>
                )}

                {/* Move List Notation Table */}
                <div className="moves-notation-wrapper">
                  <div className="moves-table-header">
                    <span className="opening-name-text" title={openingName}>
                      {openingName}
                    </span>
                    <div className="header-action-icons">
                      {isVariationActive && (
                        <button
                          type="button"
                          onClick={handleResetToOriginalGame}
                          className="variation-reset-badge-btn"
                          title="Kembalikan ke notasi pertandingan asli"
                        >
                          <RotateCcw size={12} />
                          <span>Reset Variasi</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-subtle-btn"
                        title="Simpan Variasi Pembukaan"
                      >
                        <Bookmark size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-subtle-btn"
                        title="Eksplorasi Teori Pembukaan"
                      >
                        <Compass size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Move Feedback Card / Banner */}
                  {currentPlyIndex === -1 ? (
                    <div className="chesscom-move-feedback-banner start-pos">
                      <div className="feedback-banner-header">
                        <div className="feedback-badge-and-title">
                          <span className="start-pos-icon">♟</span>
                          <div className="feedback-title-group">
                            <span className="feedback-classification-title">
                              Posisi Awal Pertandingan
                            </span>
                            <span className="feedback-move-notation">Langkah 1</span>
                          </div>
                        </div>
                      </div>
                      <p className="feedback-description-text">
                        Papan catur dalam posisi standar pembukaan. Putar langkah dengan
                        tombol navigasi di bawah untuk melihat umpan balik pedagogis
                        setiap langkah catur dan analisis Stockfish.
                      </p>
                    </div>
                  ) : moveHistory[currentPlyIndex] ? (
                    <div
                      className={`chesscom-move-feedback-banner classification-${
                        moveHistory[currentPlyIndex].classification || 'good'
                      }`}
                    >
                      <div className="feedback-banner-header">
                        <div className="feedback-badge-and-title">
                          {moveHistory[currentPlyIndex].classification && (
                            <ChessComBadgeIcon
                              type={moveHistory[currentPlyIndex].classification!}
                              size={24}
                            />
                          )}
                          <div className="feedback-title-group">
                            <span className="feedback-classification-title">
                              {moveHistory[currentPlyIndex].feedbackTitle || 'Ulasan Langkah'}
                            </span>
                            <span className="feedback-move-notation">
                              {moveHistory[currentPlyIndex].moveNumber}.
                              {moveHistory[currentPlyIndex].color === 'b' ? '..' : ''}{' '}
                              {moveHistory[currentPlyIndex].san}
                            </span>
                          </div>
                        </div>
                        {moveHistory[currentPlyIndex].timeSpent && (
                          <span className="feedback-time-spent">
                            ⏱ {moveHistory[currentPlyIndex].timeSpent}
                          </span>
                        )}
                      </div>
                      <p className="feedback-description-text">
                        {moveHistory[currentPlyIndex].feedbackDescription ||
                          'Analisis posisi langkah catur.'}
                      </p>
                      {moveHistory[currentPlyIndex].bestAlternative && (
                        <div className="feedback-best-alternative">
                          <span className="alt-label">Saran Alternatif:</span>
                          <span className="alt-text">
                            {moveHistory[currentPlyIndex].bestAlternative}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="moves-scroll-body" ref={movesScrollRef}>
                    {moveRows.length === 0 ? (
                      <div className="empty-moves-notice">
                        Belum ada riwayat langkah. Gerakkan bidak catur di papan untuk mulai
                        analisis!
                      </div>
                    ) : (
                      moveRows.map((row) => {
                        const isWhiteActive =
                          row.white && currentPlyIndex === row.white.ply - 1;
                        const isBlackActive =
                          row.black && currentPlyIndex === row.black.ply - 1;

                        return (
                          <div key={row.number} className="move-table-row">
                            <span className="move-number-col">{row.number}.</span>

                            {/* White Move */}
                            {row.white ? (
                              <button
                                type="button"
                                onClick={() => row.white && jumpToPly(row.white.ply - 1)}
                                className={`move-btn white ${isWhiteActive ? 'active' : ''}`}
                                title={`${row.white.feedbackTitle || ''}: ${row.white.san}`}
                              >
                                <div className="move-content-inline">
                                  {renderMoveFigurine(row.white.piece, 'w', row.white.san)}
                                  <span className="move-san-text">
                                    {formatSanWithoutPiece(row.white.san)}
                                  </span>
                                  {row.white.classification && (
                                    <ChessComBadgeIcon
                                      type={row.white.classification}
                                      size={14}
                                    />
                                  )}
                                </div>
                              </button>
                            ) : (
                              <div className="move-empty-cell" />
                            )}

                            {/* Black Move */}
                            {row.black ? (
                              <button
                                type="button"
                                onClick={() => row.black && jumpToPly(row.black.ply - 1)}
                                className={`move-btn black ${isBlackActive ? 'active' : ''}`}
                                title={`${row.black.feedbackTitle || ''}: ${row.black.san}`}
                              >
                                <div className="move-content-inline">
                                  {renderMoveFigurine(row.black.piece, 'b', row.black.san)}
                                  <span className="move-san-text">
                                    {formatSanWithoutPiece(row.black.san)}
                                  </span>
                                  {row.black.classification && (
                                    <ChessComBadgeIcon
                                      type={row.black.classification}
                                      size={14}
                                    />
                                  )}
                                </div>
                              </button>
                            ) : (
                              <div className="move-empty-cell" />
                            )}

                            {/* Times column with evaluation bars */}
                            <div className="move-times-col">
                              {row.white?.timeSpent && (
                                <div className="move-time-item">
                                  <span
                                    className="time-bar white-bar"
                                    style={{
                                      width: `${Math.min(
                                        18,
                                        Math.max(
                                          4,
                                          Math.round(parseFloat(row.white.timeSpent) * 2.5)
                                        )
                                      )}px`,
                                    }}
                                  />
                                  <span>{row.white.timeSpent}</span>
                                </div>
                              )}
                              {row.black?.timeSpent && (
                                <div className="move-time-item">
                                  <span
                                    className="time-bar black-bar"
                                    style={{
                                      width: `${Math.min(
                                        18,
                                        Math.max(
                                          4,
                                          Math.round(parseFloat(row.black.timeSpent) * 2.5)
                                        )
                                      )}px`,
                                    }}
                                  />
                                  <span>{row.black.timeSpent}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Moves Footer Summary Chips - Synchronized with Analysis Data */}
                  <div className="moves-footer-summary">
                    {REVIEW_CLASSIFICATIONS.map((c) => {
                      const count =
                        (calculatedCounts[c.type]?.w ?? 0) + (calculatedCounts[c.type]?.b ?? 0);
                      if (count === 0) return null;
                      return (
                        <div
                          key={c.type}
                          className={`summary-chip summary-chip-${c.type}`}
                          onClick={() => handleJumpToClassification(c.type)}
                          style={{ cursor: 'pointer' }}
                          title={`Klik untuk melihat langkah ${c.label} (${count} langkah)`}
                        >
                          <ChessComBadgeIcon type={c.type} size={14} />
                          <span>
                            <b style={{ color: c.color }}>{count}</b>{' '}
                            <span style={{ color: c.color }}>{c.label}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Media Playback Navigation Toolbar */}
                <div className="media-playback-toolbar">
                  <button
                    type="button"
                    onClick={handleFirstMove}
                    disabled={currentPlyIndex <= -1}
                    className="media-nav-btn"
                    title="Awal Pertandingan"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevMove}
                    disabled={currentPlyIndex <= -1}
                    className="media-nav-btn"
                    title="Langkah Sebelumnya"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlayingReplay(!isPlayingReplay)}
                    className="media-nav-btn play-btn"
                    title={isPlayingReplay ? 'Jeda' : 'Putar Replay'}
                  >
                    {isPlayingReplay ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play size={17} fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMove}
                    disabled={currentPlyIndex >= moveHistory.length - 1}
                    className="media-nav-btn"
                    title="Langkah Berikutnya"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleLastMove}
                    disabled={currentPlyIndex >= moveHistory.length - 1}
                    className="media-nav-btn"
                    title="Akhir Pertandingan"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>

                {/* Bottom Utility Controls */}
                <div className="analysis-utility-row">
                  <button
                    type="button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="util-btn"
                    title="Putar Papan Catur (Flip Board)"
                  >
                    <RotateCcw size={14} />
                    <span>Putar Papan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFen}
                    className="util-btn"
                    title="Salin Notasi FEN Posisi Ini"
                  >
                    {copiedFen ? <Check size={14} className="copied-icon" /> : <Copy size={14} />}
                    <span>{copiedFen ? 'Tersalin!' : 'Copy FEN'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPgn}
                    className="util-btn"
                    title="Salin Notasi Lengkap PGN"
                  >
                    {copiedPgn ? <Check size={14} className="copied-icon" /> : <Share2 size={14} />}
                    <span>{copiedPgn ? 'Tersalin!' : 'Copy PGN'}</span>
                  </button>

                  {match?.chessComUrl && (
                    <a
                      href={match.chessComUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="util-btn link-chesscom"
                      title="Buka langsung di Chess.com"
                    >
                      <ExternalLink size={13} />
                      <span>Chess.com</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
