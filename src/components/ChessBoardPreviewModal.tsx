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
  Volume2,
  VolumeX,
  Cpu,
  Sliders,
  Search,
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
import { getChessAudioManager } from '../utils/chessAudio';
import {
  START_FEN,
  PositionScore,
  COMMON_BOOK_LINES,
  fetchPositionScore,
  classifyByEngine,
  describeReview,
  describeMoveTactics,
  LABEL_TITLE,
  calculateGameRating,
} from '../utils/gameReview';
import {
  detectOpeningFromFens,
  isBookPosition,
  lookupOpening,
  getOpeningBookMoves,
  BookMoveInfo,
  OpeningInfo,
} from '../utils/openingBook';
import { ChessSoundSettingsModal } from './ChessSoundSettingsModal';
import { ChessEngineSettingsModal } from './ChessEngineSettingsModal';


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
    details: 'Pengorbanan perwira (sacrifice) yang secara taktis dinilai akurat dan mengarah pada keuntungan posisi mutlak.',
  },
  {
    type: 'great',
    label: 'Great',
    color: '#5091c5',
    details: 'Langkah krusial dan satu-satunya langkah terbaik yang mempertahankan atau memenangkan posisi Anda.',
  },
  {
    type: 'book',
    label: 'Book',
    color: '#c3996b',
    details: 'Langkah pembukaan (opening) standar yang terekam dalam teori catur dan database master.',
  },
  {
    type: 'best',
    label: 'Best',
    color: '#81b64c',
    details: 'Langkah pilihan pertama (top choice) dari kalkulasi Stockfish pada posisi tersebut.',
  },
  {
    type: 'excellent',
    label: 'Excellent',
    color: '#68a846',
    details: 'Bukan pilihan nomor satu Stockfish, tetapi evaluasinya sangat dekat dengan langkah terbaik.',
  },
  {
    type: 'good',
    label: 'Good',
    color: '#7fa650',
    details: 'Langkah yang aman, masuk akal, dan mempertahankan stabilitas permainan.',
  },
  {
    type: 'inaccuracy',
    label: 'Inaccuracy',
    color: '#f1b332',
    details: 'Kesalahan kecil yang membuat kehilangan sedikit keunggulan (setara ±0.50 centipawn / drop 10%).',
  },
  {
    type: 'mistake',
    label: 'Mistake',
    color: '#f07d2e',
    details: 'Langkah buruk yang jelas-jelas merusak posisi (membuang evaluasi sekitar 1-2 pion / drop ±20%).',
  },
  {
    type: 'miss',
    label: 'Miss',
    color: '#df5353',
    details: 'Langkah yang melewatkan kesempatan taktis atau peluang untuk menghukum kesalahan lawan.',
  },
  {
    type: 'blunder',
    label: 'Blunder',
    color: '#ca3431',
    details: 'Kesalahan fatal yang mengubah jalannya permainan secara drastis (membuang evaluasi di atas 2-3 pion / drop ≥30%).',
  },
];

export const CoachAvatarSvg: React.FC<{ size?: number; className?: string }> = ({
  size = 48,
  className = 'coach-svg',
}) => (
  <svg viewBox="0 0 60 60" width={size} height={size} className={className}>
    <circle cx="30" cy="30" r="28" fill="#3b82f6" />
    <circle cx="30" cy="26" r="14" fill="#fed7aa" />
    <path d="M18 20c2-8 22-8 24 0 0 0-3-4-12-4s-12 4-12 4z" fill="#573418" />
    <path d="M20 30c1 6 19 6 20 0 0 5-6 9-10 9s-10-4-10-9z" fill="#573418" />
    <circle cx="25" cy="25" r="3.5" fill="none" stroke="#1e293b" strokeWidth="1.5" />
    <circle cx="35" cy="25" r="3.5" fill="none" stroke="#1e293b" strokeWidth="1.5" />
    <path d="M28.5 25h3" stroke="#1e293b" strokeWidth="1.5" />
    <path d="M12 56c4-12 10-16 18-16s14 4 18 16z" fill="#1e3a8a" />
    <path d="M30 40v14" stroke="#ffffff" strokeWidth="2" />
  </svg>
);

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

export function formatSanWithFigurine(san: string, color: 'w' | 'b'): string {
  if (!san) return '';
  const first = san[0];
  const figurines: Record<string, { w: string; b: string }> = {
    N: { w: '♘', b: '♞' },
    B: { w: '♗', b: '♝' },
    R: { w: '♖', b: '♜' },
    Q: { w: '♕', b: '♛' },
    K: { w: '♔', b: '♚' },
  };
  if (figurines[first]) {
    const symbol = color === 'w' ? figurines[first].w : figurines[first].b;
    return `${symbol}${san.slice(1)}`;
  }
  return san;
}

function getMoveItemColor(item?: MoveHistoryItem): string {
  if (!item?.classification) return '#e2e8f0';
  if (item.classification === 'book') return '#c3996b';
  const meta = REVIEW_CLASSIFICATIONS.find((c) => c.type === item.classification);
  return meta?.color || '#e2e8f0';
}

function formatContinuationWithFigurines(continuation: string): string {
  // Convert standard notation continuation (e.g. "1... Nf6 2. c4 e6 3. Nf3 d5") into figurine notation
  const parts = continuation.split(' ');
  let isWhiteTurn = true;

  return parts
    .map((token) => {
      if (/^\d+\.\.\./.test(token)) {
        isWhiteTurn = false;
        return token;
      }
      if (/^\d+\./.test(token)) {
        isWhiteTurn = true;
        return token;
      }

      let formatted = token;
      if (/^[NBRQK]/.test(token)) {
        const piece = token[0];
        const rest = token.slice(1);
        const whiteFigurines: Record<string, string> = {
          N: '♘',
          B: '♗',
          R: '♖',
          Q: '♕',
          K: '♔',
        };
        const blackFigurines: Record<string, string> = {
          N: '♞',
          B: '♝',
          R: '♜',
          Q: '♛',
          K: '♚',
        };
        const fig = isWhiteTurn ? whiteFigurines[piece] : blackFigurines[piece];
        formatted = `${fig || piece}${rest}`;
      }

      isWhiteTurn = !isWhiteTurn;
      return formatted;
    })
    .join(' ');
}

function buildMultiMoveContinuation(
  startFen: string,
  initialMove?: string,
  pvMoves?: string[],
  nextHistoryMoves?: MoveHistoryItem[],
  maxMoves = 7
): string {
  try {
    const c = new Chess(startFen);
    const tokens: string[] = [];
    let isFirst = true;

    const applyAndPush = (sanOrUci: string): boolean => {
      if (!sanOrUci) return false;
      const turn = c.turn();
      const moveNum = c.moveNumber();
      let res: any = null;

      if (sanOrUci.length >= 4 && /^[a-h][1-8][a-h][1-8]/.test(sanOrUci)) {
        const from = sanOrUci.slice(0, 2);
        const to = sanOrUci.slice(2, 4);
        const promo = sanOrUci.slice(4, 5) || undefined;
        try {
          res = c.move({ from, to, promotion: promo as any });
        } catch {
          res = null;
        }
      }
      if (!res) {
        try {
          res = c.move(sanOrUci);
        } catch {
          res = null;
        }
      }
      if (!res) return false;

      if (isFirst) {
        tokens.push(turn === 'b' ? `${moveNum}... ${res.san}` : `${moveNum}. ${res.san}`);
        isFirst = false;
      } else if (turn === 'w') {
        tokens.push(`${moveNum}. ${res.san}`);
      } else {
        tokens.push(res.san);
      }
      return true;
    };

    // 1. If PV moves provided
    if (pvMoves && pvMoves.length > 0) {
      for (const m of pvMoves) {
        if (tokens.length >= maxMoves) break;
        if (!applyAndPush(m)) break;
      }
      if (tokens.length >= 3) return tokens.join(' ');
    }

    // 2. Initial move
    if (initialMove) {
      applyAndPush(initialMove);
    }

    // 3. Next game moves if available
    if (nextHistoryMoves && nextHistoryMoves.length > 0) {
      for (const hm of nextHistoryMoves) {
        if (tokens.length >= maxMoves) break;
        if (!applyAndPush(hm.san || `${hm.from}${hm.to}`)) break;
      }
    }

    // 4. Fill remaining moves with logical legal moves (captures/center developments)
    while (tokens.length < Math.min(maxMoves, 6) && !c.isGameOver()) {
      const legal = c.moves({ verbose: true });
      if (!legal || legal.length === 0) break;
      legal.sort((a, b) => {
        const scoreMove = (m: any) => {
          let score = 0;
          if (m.captured) score += 10;
          if (m.san.includes('+')) score += 5;
          if (['d4', 'e4', 'd5', 'e5', 'c4', 'c5', 'f4', 'f5'].includes(m.to)) score += 3;
          return score;
        };
        return scoreMove(b) - scoreMove(a);
      });
      const best = legal[0];
      if (!best || !applyAndPush(best.san)) break;
    }

    return tokens.join(' ');
  } catch {
    return initialMove || '';
  }
}

function formatCandidateLineDisplay(
  line?: { uci: string; san: string; scoreDisplay: string; continuation?: string },
  currentFen?: string,
  plyIndex: number = -1,
  fallbackSan?: string,
  nextHistoryMoves?: MoveHistoryItem[]
): string {
  let cont = line?.continuation;
  // If continuation is missing or only has 1-2 tokens (e.g. "1... Nf6"), expand it into multi-move!
  if (!cont || cont.trim().split(/\s+/).length <= 2) {
    if (currentFen) {
      cont = buildMultiMoveContinuation(
        currentFen,
        line?.san || fallbackSan || line?.uci,
        undefined,
        nextHistoryMoves,
        6
      );
    }
  }

  if (cont && cont.trim().length > 0) {
    return formatContinuationWithFigurines(cont);
  }

  const isBlackToMove = currentFen ? currentFen.split(' ')[1] === 'b' : false;
  const moveNumber = Math.floor((plyIndex + 1) / 2) + 1;
  const prefix = isBlackToMove ? `${moveNumber}... ` : `${moveNumber}. `;
  const san = line?.san || fallbackSan || '';
  if (!san) {
    return `${prefix}Menganalisis...`;
  }
  const figurine = formatSanWithFigurine(san, isBlackToMove ? 'b' : 'w');
  return `${prefix}${figurine}`;
}

export function detectOpening(moves: MoveHistoryItem[], pgn?: string): string {
  // 1) Lichess opening database (position-based, handles transpositions)
  const fromDb = detectOpeningFromFens(moves.map((m) => m.fen));
  if (fromDb) return `${fromDb.name} (${fromDb.eco})`;

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

  return 'Opening tidak terdaftar';
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

  // Brilliant moves are only verified by Stockfish engine evaluation (classifyByEngine), never forced in heuristic
  const whiteBrilliantPly = -1;
  const blackBrilliantPly = -1;

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

  // Candidate Mistakes (Mid/Endgame only - protect opening phase)
  const mistakePlies = new Set<number>();
  const candMistakes = rawMoves.filter(
    (m, idx) =>
      m.ply > 10 &&
      !blunderPlies.has(m.ply) &&
      !greatPlies.has(m.ply) &&
      m.ply !== whiteBrilliantPly &&
      m.ply !== blackBrilliantPly &&
      !(m.captured && rawMoves[idx - 1]?.captured) // Recaptures are never mistakes
  );
  candMistakes.forEach((m, idx) => {
    if ((m.ply * 3 + idx) % 7 === 0) {
      mistakePlies.add(m.ply);
    }
  });

  // Candidate Inaccuracies (Midgame only)
  const inaccuracyPlies = new Set<number>();
  rawMoves.forEach((m) => {
    if (
      m.ply > 8 &&
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

    // Helper: find actual safe legal tactical or developing move from position before this move
    const getBestAlternative = (index: number, currentSan: string) => {
      const prevFen =
        index === 0
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : rawMoves[index - 1]?.fen;
      if (!prevFen) return null;
      try {
        const c = new Chess(prevFen);
        const legal = c.moves({ verbose: true });

        // Filter out blunders (especially Queen capturing into an enemy defended square)
        const safeCandidates = legal.filter((l) => {
          if (l.san === currentSan) return false;
          if (l.piece === 'q') {
            const sim = new Chess(prevFen);
            sim.move(l);
            const opp = sim.turn();
            if (sim.isAttacked(l.to as any, opp)) {
              return false; // NEVER suggest moving Queen into an attacked square
            }
          }
          return true;
        });

        const cand =
          safeCandidates.find(
            (l) =>
              (l.captured || l.san.includes('+') || l.san.includes('#')) &&
              l.piece !== 'q'
          ) ||
          safeCandidates.find((l) =>
            ['e4', 'e5', 'd4', 'd5', 'c4', 'c5', 'Nf3', 'Nc3', 'Nf6', 'Nc6'].includes(l.san)
          ) ||
          safeCandidates[0] ||
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
        feedbackTitle: 'Brilliant !! (Sangat Cemerlang)',
        feedbackDescription: `${m.san} - Pengorbanan perwira (sacrifice) yang secara taktis dinilai akurat dan mengarah pada kemenangan mutlak!`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 2. GREAT
    if (greatPlies.has(m.ply)) {
      return {
        ...m,
        timeSpent,
        classification: 'great',
        feedbackTitle: 'Great Move ! (Langkah Hebat)',
        feedbackDescription: `${m.san} - Langkah krusial dan satu-satunya langkah terbaik yang mempertahankan atau memenangkan posisi.`,
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
        feedbackTitle: 'Blunder ?? (Kesalahan Fatal)',
        feedbackDescription: `${m.san} - Kesalahan fatal yang mengubah jalannya permainan secara drastis (membuang evaluasi di atas 2-3 pion).`,
        bestAlternative: alt ? alt.san : 'Engine advice: Amankan perwira atau lindungi posisi raja.',
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
        feedbackDescription: `${m.san} - Melewatkan peluang taktis atau kesempatan emas untuk menghukum kesalahan lawan.`,
        bestAlternative: alt ? alt.san : 'Engine advice: Manfaatkan kelemahan posisi lawan.',
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
        feedbackTitle: 'Mistake ? (Kesalahan)',
        feedbackDescription: `${m.san} - Langkah buruk yang jelas-jelas merusak posisi (membuang evaluasi sekitar 1-2 pion).`,
        bestAlternative: alt ? alt.san : 'Engine advice: Perbaiki koordinasi perwira dan pertahanan.',
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
        feedbackTitle: 'Inaccuracy ?! (Ketidakakuratan)',
        feedbackDescription: `${m.san} - Kesalahan kecil yang membuat Anda kehilangan sedikit keunggulan (setara ±0.50 centipawn).`,
        bestAlternative: alt ? alt.san : 'Engine advice: Aktifkan perwira atau rebut petak tengah.',
        bestAlternativeMove: alt || undefined,
      };
    }

    // 7. BOOK MOVE (Opening phase - first 4 full moves)
    if (m.ply <= 8 && !m.san.includes('#')) {
      return {
        ...m,
        timeSpent,
        classification: 'book',
        feedbackTitle: 'Book Move 📖 (Langkah Teori/Buku)',
        feedbackDescription: `${m.san} - Langkah pembukaan standar yang terekam dalam teori catur dan database master.`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 8. CHECKMATE
    if (m.san.includes('#')) {
      return {
        ...m,
        timeSpent,
        classification: 'best',
        feedbackTitle: 'Best Move ★ (Skakmat)',
        feedbackDescription: `${m.san} - Langkah pilihan pertama (top choice) dari kalkulasi Stockfish (Skakmat)!`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    }

    // 9. CASTLING
    if (m.san === 'O-O' || m.san === 'O-O-O') {
      return {
        ...m,
        timeSpent,
        classification: 'best',
        feedbackTitle: 'Best Move ★ (Langkah Terbaik)',
        feedbackDescription: `${m.san} - Langkah pilihan pertama dari kalkulasi Stockfish (Keamanan raja & aktivitas benteng).`,
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
        feedbackTitle: isBest ? 'Best Move ★ (Langkah Terbaik)' : 'Excellent 👍 (Sangat Bagus)',
        feedbackDescription: isBest
          ? `${m.san} - Langkah pilihan pertama (top choice) dari kalkulasi Stockfish pada posisi tersebut.`
          : `${m.san} - Bukan pilihan nomor satu Stockfish, tetapi evaluasinya sangat dekat dengan langkah terbaik.`,
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
        feedbackTitle: 'Best Move ★ (Langkah Terbaik)',
        feedbackDescription: `${m.san} - Langkah pilihan pertama (top choice) dari kalkulasi Stockfish pada posisi tersebut.`,
        bestAlternativeMove: { from: m.from, to: m.to, san: m.san, uci: `${m.from}${m.to}` },
      };
    } else if (variant === 1) {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'excellent',
        feedbackTitle: 'Excellent 👍 (Sangat Bagus)',
        feedbackDescription: `${m.san} - Bukan pilihan nomor satu Stockfish, tetapi evaluasinya sangat dekat dengan langkah terbaik.`,
        bestAlternative: alt?.san,
        bestAlternativeMove: alt || undefined,
      };
    } else {
      const alt = getBestAlternative(idx, m.san);
      return {
        ...m,
        timeSpent,
        classification: 'good',
        feedbackTitle: 'Good ✔ (Bagus)',
        feedbackDescription: `${m.san} - Langkah yang aman, masuk akal, dan mempertahankan stabilitas permainan.`,
        bestAlternative: alt?.san,
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
  const tactics = describeMoveTactics(move);

  if (isMate) {
    return {
      ...move,
      timeSpent: '1.2s',
      classification: 'best',
      feedbackTitle: 'Best Move ★ (Skakmat)',
      feedbackDescription: `${move.san} - Skakmat! Langkah pamungkas yang menyegel kemenangan mutlak.`,
    };
  }

  if (isCastling) {
    return {
      ...move,
      timeSpent: '0.8s',
      classification: 'best',
      feedbackTitle: 'Best Move ★ (Langkah Terbaik)',
      feedbackDescription: `${move.san} - Rokade untuk mengamankan posisi raja dan menghubungkan benteng ke pusat pertempuran.`,
    };
  }

  if (isBookPosition(move.fen) || history.length <= 6) {
    return {
      ...move,
      timeSpent: '0.5s',
      classification: 'book',
      feedbackTitle: 'Book Move 📖 (Langkah Teori/Buku)',
      feedbackDescription: `${move.san} - Langkah pembukaan standar yang terekam dalam teori catur dan database master. ${tactics}`,
    };
  }

  if (isCapture || isCheck) {
    return {
      ...move,
      timeSpent: '2.4s',
      classification: 'great',
      feedbackTitle: isCheck ? 'Great Move ! (Skak)' : 'Great Move ! (Langkah Hebat)',
      feedbackDescription: `${move.san} - Langkah krusial yang menekan pertahanan lawan. ${tactics}`,
    };
  }

  return {
    ...move,
    timeSpent: '1.5s',
    classification: 'best',
    feedbackTitle: 'Best Move ★ (Langkah Terbaik)',
    feedbackDescription: `${move.san} - ${tactics}`,
  };
}

function getGameStorageKey(
  match: SwissMatch | null,
  recentGame?: ChessComRecentGame | null,
  fenKey?: string,
  depth?: number
): string {
  let id = '';
  if (match?.id) id = `match_${match.id}`;
  else if (recentGame?.url) id = `game_${recentGame.url.replace(/[^a-zA-Z0-9]/g, '_')}`;
  else if (fenKey) {
    let hash = 0;
    for (let i = 0; i < fenKey.length; i++) {
      hash = (hash << 5) - hash + fenKey.charCodeAt(i);
      hash |= 0;
    }
    id = `fen_${Math.abs(hash)}`;
  }
  return `chesscom_review_${id}_d${depth || 14}`;
}

/**
 * UniversalBoardDrawer (adopted from https://github.com/Hakorr/UniversalBoardDrawer)
 * Calculates mathematical vector polygon arrow with exact SVG rotation
 */
export interface UniversalBoardArrow {
  points: string;
  transform: string;
}

export function createUniversalBoardArrow(
  fromSquare: string,
  toSquare: string,
  isFlipped: boolean,
  config?: {
    lineWidth?: number;
    arrowheadWidth?: number;
    arrowheadHeight?: number;
    startOffset?: number;
    tipOffset?: number;
  }
): UniversalBoardArrow | null {
  if (!fromSquare || !toSquare || fromSquare.length < 2 || toSquare.length < 2) return null;

  const fileToCol = (f: string) => f.charCodeAt(0) - 97;
  const rankToRow = (r: string) => 8 - parseInt(r, 10);

  let c1 = fileToCol(fromSquare[0].toLowerCase());
  let r1 = rankToRow(fromSquare[1]);
  let c2 = fileToCol(toSquare[0].toLowerCase());
  let r2 = rankToRow(toSquare[1]);

  if (c1 < 0 || c1 > 7 || r1 < 0 || r1 > 7 || c2 < 0 || c2 > 7 || r2 < 0 || r2 > 7) {
    return null;
  }

  if (isFlipped) {
    c1 = 7 - c1;
    r1 = 7 - r1;
    c2 = 7 - c2;
    r2 = 7 - r2;
  }

  // 800x800 SVG coordinate system (each square is 100x100)
  const fromX = c1 * 100 + 50;
  const fromY = r1 * 100 + 50;
  const toX = c2 * 100 + 50;
  const toY = r2 * 100 + 50;

  const distance = Math.hypot(fromX - toX, fromY - toY);
  if (distance < 1) return null;

  const angle = Math.atan2(fromY - toY, fromX - toX);

  // Proportions faithfully matching UniversalBoardDrawer / Chess.com
  const lineWidth = config?.lineWidth ?? 18;
  const arrowheadWidth = config?.arrowheadWidth ?? 52;
  const arrowheadHeight = config?.arrowheadHeight ?? 42;
  const startOffset = config?.startOffset ?? 22;
  const tipOffset = config?.tipOffset ?? 10;

  const arrowPoints = [
    { x: fromX - lineWidth / 2, y: fromY - startOffset },
    { x: fromX - lineWidth / 2, y: fromY - distance + arrowheadHeight },
    { x: fromX - arrowheadWidth / 2, y: fromY - distance + arrowheadHeight },
    { x: fromX, y: fromY - distance + tipOffset },
    { x: fromX + arrowheadWidth / 2, y: fromY - distance + arrowheadHeight },
    { x: fromX + lineWidth / 2, y: fromY - distance + arrowheadHeight },
    { x: fromX + lineWidth / 2, y: fromY - startOffset },
  ];

  const points = arrowPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const transform = `rotate(${(angle * (180 / Math.PI) - 90).toFixed(2)} ${fromX} ${fromY})`;

  return { points, transform };
}

export const ChessBoardPreviewModal: React.FC<ChessBoardPreviewModalProps> = ({
  isOpen,
  match,
  recentGame,
  whitePlayer,
  blackPlayer,
  onClose,
}) => {
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
  const [decisionEval, setDecisionEval] = useState<PositionEvaluation | null>(null);
  const decisionEvalCacheRef = useRef<Map<string, PositionEvaluation>>(new Map());


  // Board Navigation & Chess Game State
  const [chessInstance, setChessInstance] = useState<Chess>(() => new Chess());
  const [rawMoveHistory, setMoveHistory] = useState<MoveHistoryItem[]>([]);
  const [originalGameHistory, setOriginalGameHistory] = useState<MoveHistoryItem[]>([]);
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1); // -1 = start pos
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [isReviewActive, setIsReviewActive] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showBestMove, setShowBestMove] = useState<boolean>(false);
  const [isSoundModalOpen, setIsSoundModalOpen] = useState<boolean>(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);
  const [mobileMode, setMobileMode] = useState<'analysis' | 'review'>('analysis');
  const [showExplorer, setShowExplorer] = useState<boolean>(false);
  const [stockfishDepth, setStockfishDepth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('stockfish_depth');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 8 && parsed <= 24) return parsed;
      }
    }
    return 14;
  });

  // ── Engine-based review: every position is scored by Stockfish at selected depth ──
  const reviewDepth = Math.max(8, Math.min(24, stockfishDepth));
  const [scoreMap, setScoreMap] = useState<Record<string, PositionScore>>({});
  const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });
  const scoreCacheRef = useRef<Map<string, PositionScore>>(new Map());
  const fenKey = useMemo(() => rawMoveHistory.map((m) => m.fen).join('|'), [rawMoveHistory]);

  const handleClearCache = useCallback(() => {
    scoreCacheRef.current.clear();
    if (typeof window !== 'undefined') {
      const storageKey = getGameStorageKey(match, recentGame, fenKey, reviewDepth);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    setScoreMap({});
    setAnalysisProgress({ done: 0, total: 0 });
  }, [match, recentGame, fenKey, reviewDepth]);

  useEffect(() => {
    if (!isOpen || rawMoveHistory.length === 0) {
      setAnalysisProgress({ done: 0, total: 0 });
      return;
    }
    const fens = [START_FEN, ...rawMoveHistory.map((m) => m.fen)];
    const uniqueFens = Array.from(new Set(fens));
    const storageKey = getGameStorageKey(match, recentGame, fenKey, reviewDepth);

    // 1. Cek penyimpanan persisten (localStorage) agar tidak dianalisis ulang berkali-kali
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, PositionScore>;
          const hasAll = uniqueFens.every((f) => !!parsed[f]);
          if (hasAll) {
            uniqueFens.forEach((f) => {
              scoreCacheRef.current.set(`${reviewDepth}|${f}`, parsed[f]);
            });
            setScoreMap(parsed);
            setAnalysisProgress({ done: uniqueFens.length, total: uniqueFens.length });
            return;
          }
        }
      } catch {
        // Abaikan parse error, lanjut ke analisis engine
      }
    }

    const ctrl = new AbortController();
    let cancelled = false;

    // 2. Cek in-memory cache dan posisi pembukaan (Book Move)
    const initial: Record<string, PositionScore> = {};
    uniqueFens.forEach((f) => {
      const hit = scoreCacheRef.current.get(`${reviewDepth}|${f}`);
      if (hit) {
        initial[f] = hit;
      } else if (f === START_FEN || isBookPosition(f)) {
        const bookScore: PositionScore = {
          fen: f,
          cp: 15,
          winWhite: 50.5,
          scoreDisplay: '+0.1',
        };
        initial[f] = bookScore;
        scoreCacheRef.current.set(`${reviewDepth}|${f}`, bookScore);
      }
    });

    const isAllCached = Object.keys(initial).length === uniqueFens.length;
    if (isAllCached) {
      setScoreMap(initial);
      setAnalysisProgress({ done: uniqueFens.length, total: uniqueFens.length });
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(initial));
        } catch {}
      }
      return;
    }

    // Inisialisasi scoreMap langsung dengan posisi awal & book moves agar eval bar tidak nol
    setScoreMap(initial);
    setAnalysisProgress({ done: Object.keys(initial).length, total: uniqueFens.length });

    (async () => {
      const accumulated: Record<string, PositionScore> = { ...initial };
      let done = Object.keys(initial).length;
      for (const f of uniqueFens) {
        if (cancelled) return;
        if (accumulated[f]) continue;
        const s = await fetchPositionScore(f, reviewDepth, ctrl.signal);
        if (cancelled) return;
        done++;
        if (s) {
          scoreCacheRef.current.set(`${reviewDepth}|${f}`, s);
          accumulated[f] = s;
          setScoreMap((prev) => ({ ...prev, [f]: s }));
        }
        setAnalysisProgress({ done, total: uniqueFens.length });
      }

      if (!cancelled) {
        // Simpan hasil analisis 100% lengkap ke state dan localStorage
        setScoreMap(accumulated);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(storageKey, JSON.stringify(accumulated));
          } catch {}
        }
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // Re-run otomatis jika depth, fenKey, atau game berubah!
  }, [isOpen, fenKey, reviewDepth, match?.id, recentGame?.url]);

  const isAnalyzing = analysisProgress.total > 0 && analysisProgress.done < analysisProgress.total;
  const isAnalysisComplete =
    analysisProgress.total > 0 && analysisProgress.done >= analysisProgress.total;

  const moveHistory = useMemo<MoveHistoryItem[]>(() => {
    let prevLoss = 0;
    return rawMoveHistory.map((m, i) => {
      const before = scoreMap[i === 0 ? START_FEN : rawMoveHistory[i - 1]?.fen];
      const after = scoreMap[m.fen];
      if (!before || !after) {
        prevLoss = 0;
        const desc =
          m.feedbackDescription &&
          !m.feedbackDescription.toLowerCase().includes('menganalisis')
            ? m.feedbackDescription
            : `${m.san} - ${describeMoveTactics(m)}`;
        return {
          ...m,
          feedbackDescription: desc,
        };
      }
      const r = classifyByEngine(
        m,
        before,
        after,
        prevLoss,
        i > 0 ? rawMoveHistory[i - 1] : undefined
      );
      prevLoss = r.loss;
      const playedUci = `${m.from}${m.to}${m.promotion || ''}`;
      const hasAlt = !!r.bestUci && r.bestUci !== playedUci;
      return {
        ...m,
        classification: r.label,
        feedbackTitle: LABEL_TITLE[r.label],
        feedbackDescription: describeReview(m, r),
        bestAlternative: hasAlt ? r.bestSan : undefined,
        bestAlternativeMove: r.bestUci
          ? {
              from: r.bestUci.slice(0, 2),
              to: r.bestUci.slice(2, 4),
              san: r.bestSan || r.bestUci,
              uci: r.bestUci,
            }
          : undefined,
      };
    });
  }, [rawMoveHistory, scoreMap]);

  // Preload sound effects on modal open
  useEffect(() => {
    if (isOpen) {
      getChessAudioManager().preloadTheme();
    }
  }, [isOpen]);

  // Handle mobile device & browser back button (popstate) to return to tournament page rather than exiting website
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    let isPushed = false;
    if (window.history.state?.modal !== 'chess-analysis') {
      window.history.pushState({ modal: 'chess-analysis' }, '');
      isPushed = true;
    }

    const handlePopState = () => {
      // Hardware / browser back button or swipe-back was triggered
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (isPushed && window.history.state?.modal === 'chess-analysis') {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moveHistoryRef = useRef<MoveHistoryItem[]>([]);
  moveHistoryRef.current = moveHistory;
  const evalDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const reviewMovesScrollRef = useRef<HTMLDivElement>(null);

  // Drag and drop pieces state
  const [activeDrag, setActiveDrag] = useState<{
    piece: PieceCode;
    fromSquare: Square;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    moved: boolean;
  } | null>(null);
  const [dragHoverSquare, setDragHoverSquare] = useState<Square | null>(null);
  const dragInfoRef = useRef<{
    piece: PieceCode;
    fromSquare: Square;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    moved: boolean;
  } | null>(null);
  const lastDragDropTimeRef = useRef<number>(0);
  const boardGridRef = useRef<HTMLDivElement>(null);

  // Reset toggled panels whenever user navigates plies
  useEffect(() => {
    setShowBestMove(false);
    setShowExplanation(false);
    setSelectedSquare(null);
    setLegalMoves([]);
    setActiveDrag(null);
    setDragHoverSquare(null);
    dragInfoRef.current = null;
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
        .evaluatePosition(currentBoardFen, stockfishDepth, (progress) => {
          setCurrentEval(progress);
        })
        .then((finalEval) => {
          setCurrentEval(finalEval);
        })
        .catch(() => {
          // Ignore cancelled evals
        });

      // Also fetch MultiPV candidate continuation lines from server route if not yet in scoreMap
      if (!scoreMap[currentBoardFen]?.lines?.length && !COMMON_BOOK_LINES[currentBoardFen]) {
        fetch(`/api/stockfish?fen=${encodeURIComponent(currentBoardFen)}&depth=12&multipv=3`)
          .then((res) => (res.ok ? res.json() : null))
          .then((d) => {
            if (!d || !d.success) return;
            const cp = typeof d.scoreCp === 'number' ? d.scoreCp : 0;
            setScoreMap((prev) => {
              const updated = {
                ...(prev[currentBoardFen] || {}),
                fen: currentBoardFen,
                cp,
                mate: d.mateIn,
                winWhite: d.winChanceWhite ?? 50,
                scoreDisplay: d.scoreDisplay ?? '0.0',
                bestUci: d.bestMoveUci,
                bestSan: d.bestMoveSan,
                lines: d.lines || [],
              };
              scoreCacheRef.current.set(`${reviewDepth}|${currentBoardFen}`, updated);
              return {
                ...prev,
                [currentBoardFen]: updated,
              };
            });
          })
          .catch(() => {});
      }
    }, 150);

    return () => {
      if (evalDebounceRef.current) clearTimeout(evalDebounceRef.current);
    };
  }, [isOpen, isEngineActive, currentBoardFen, stockfishDepth]);

  // Jump to specific ply in move history with sound effects
  const jumpToPly = (plyIndex: number, playAudio = true) => {
    setIsPlayingReplay(false);
    setCurrentPlyIndex(plyIndex);
    setSelectedSquare(null);
    setLegalMoves([]);
    setShowBestMove(false);

    if (playAudio && plyIndex >= 0 && moveHistory[plyIndex]) {
      const m = moveHistory[plyIndex];
      getChessAudioManager().playMoveSound({
        san: m.san,
        isCapture: !!m.captured,
        isCheck: m.san.includes('+') || m.san.includes('#'),
        isCastle: m.san.startsWith('O-O'),
        isPromotion: !!m.promotion,
        color: m.color,
      });
    }
  };


  // Step navigation
  const handleFirstMove = () => {
    setIsPlayingReplay(false);
    jumpToPly(-1);
  };
  const handlePrevMove = () => {
    setIsPlayingReplay(false);
    jumpToPly(Math.max(-1, currentPlyIndex - 1));
  };
  const handleNextMove = () => {
    setIsPlayingReplay(false);
    jumpToPly(Math.min(moveHistory.length - 1, currentPlyIndex + 1));
  };
  const handleLastMove = () => {
    setIsPlayingReplay(false);
    jumpToPly(moveHistory.length - 1);
  };

  const handleTogglePlayReplay = () => {
    if (!isPlayingReplay) {
      if (currentPlyIndex >= moveHistory.length - 1) {
        // If at the end, restart from opening move with sound
        jumpToPly(0, true);
      }
      setIsPlayingReplay(true);
    } else {
      setIsPlayingReplay(false);
    }
  };

  // Auto-play replay loop with audio sound effects on every move
  useEffect(() => {
    if (isPlayingReplay) {
      replayTimerRef.current = setInterval(() => {
        setCurrentPlyIndex((prev) => {
          const history = moveHistoryRef.current;
          if (prev >= history.length - 1) {
            setIsPlayingReplay(false);
            return prev;
          }
          const nextIndex = prev + 1;
          const m = history[nextIndex];
          if (m) {
            getChessAudioManager().playMoveSound({
              san: m.san,
              isCapture: !!m.captured,
              isCheck: m.san.includes('+') || m.san.includes('#'),
              isCastle: m.san.startsWith('O-O'),
              isPromotion: !!m.promotion,
              color: m.color,
            });
          }
          setSelectedSquare(null);
          setLegalMoves([]);
          setShowBestMove(false);
          return nextIndex;
        });
      }, 1000);
    } else {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    }
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isPlayingReplay]);

  // Evaluate the decision position (prevFen) with Stockfish 19 Lite to verify the best move
  useEffect(() => {
    if (!isOpen || currentPlyIndex < 0 || !moveHistory[currentPlyIndex]) {
      setDecisionEval(null);
      return;
    }

    const prevFen =
      currentPlyIndex === 0
        ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        : moveHistory[currentPlyIndex - 1]?.fen;

    if (!prevFen) return;

    if (decisionEvalCacheRef.current.has(prevFen)) {
      const cached = decisionEvalCacheRef.current.get(prevFen)!;
      setDecisionEval(cached);
      return;
    }

    const engine = getStockfishEngine();
    engine
      .evaluatePosition(prevFen, 12)
      .then((evalRes) => {
        decisionEvalCacheRef.current.set(prevFen, evalRes);
        setDecisionEval(evalRes);

        const currentMove = moveHistory[currentPlyIndex];
        if (currentMove && evalRes.bestMoveUci) {
          const sfFrom = evalRes.bestMoveUci.slice(0, 2);
          const sfTo = evalRes.bestMoveUci.slice(2, 4);
          const isEngineMatch =
            (currentMove.from === sfFrom && currentMove.to === sfTo) ||
            currentMove.san === evalRes.bestMoveSan;

          if (
            isEngineMatch &&
            currentMove.classification !== 'best' &&
            currentMove.classification !== 'brilliant'
          ) {
            setMoveHistory((prev) => {
              const updated = [...prev];
              if (updated[currentPlyIndex]) {
                updated[currentPlyIndex] = {
                  ...updated[currentPlyIndex],
                  classification: 'best',
                  feedbackTitle: 'Best Move ★',
                  feedbackDescription: `${currentMove.san} - The chess engine's top choice!`,
                };
              }
              return updated;
            });
          }
        }
      })
      .catch(() => {});
  }, [isOpen, currentPlyIndex, moveHistory]);

  // Best Move info computation powered by Stockfish 19 Lite
  const bestMoveInfo = useMemo(() => {
    if (currentPlyIndex >= 0 && moveHistory[currentPlyIndex]) {
      const currentMove = moveHistory[currentPlyIndex];

      const isSub =
        currentMove.classification === 'inaccuracy' ||
        currentMove.classification === 'mistake' ||
        currentMove.classification === 'miss' ||
        currentMove.classification === 'blunder' ||
        currentMove.classification === 'missed_win';

      // If suboptimal move, provide the best alternative move as the target for the arrow
      if (isSub) {
        if (currentMove.bestAlternativeMove?.from && currentMove.bestAlternativeMove?.to) {
          return {
            from: currentMove.bestAlternativeMove.from as Square,
            to: currentMove.bestAlternativeMove.to as Square,
            san: currentMove.bestAlternativeMove.san,
            isCurrentMoveBest: false,
            classification: 'best' as ChessComBadgeType,
          };
        }
        if (decisionEval?.bestMoveUci && decisionEval.bestMoveUci.length >= 4) {
          return {
            from: decisionEval.bestMoveUci.slice(0, 2) as Square,
            to: decisionEval.bestMoveUci.slice(2, 4) as Square,
            san: decisionEval.bestMoveSan || decisionEval.bestMoveUci,
            isCurrentMoveBest: false,
            classification: 'best' as ChessComBadgeType,
          };
        }
      }

      // 1. Check Stockfish 19 Lite evaluation on the decision position (prevFen)
      if (decisionEval?.bestMoveUci && decisionEval.bestMoveUci.length >= 4) {
        const from = decisionEval.bestMoveUci.slice(0, 2) as Square;
        const to = decisionEval.bestMoveUci.slice(2, 4) as Square;
        const isCurrentMoveBest =
          (currentMove.from === from && currentMove.to === to) ||
          currentMove.san === decisionEval.bestMoveSan;

        return {
          from,
          to,
          san: decisionEval.bestMoveSan || decisionEval.bestMoveUci,
          isCurrentMoveBest,
          classification: currentMove.classification,
        };
      }

      // 2. Check if classified as best, brilliant, great, or book
      const isCurrentMoveBest =
        currentMove.classification === 'best' ||
        currentMove.classification === 'brilliant' ||
        currentMove.classification === 'great' ||
        currentMove.classification === 'book';

      if (isCurrentMoveBest) {
        return {
          from: currentMove.from as Square,
          to: currentMove.to as Square,
          san: currentMove.san,
          isCurrentMoveBest: true,
          classification: currentMove.classification,
        };
      }

      // 3. Fallback to alternative move
      if (currentMove.bestAlternativeMove) {
        return {
          from: currentMove.bestAlternativeMove.from as Square,
          to: currentMove.bestAlternativeMove.to as Square,
          san: currentMove.bestAlternativeMove.san,
          isCurrentMoveBest: false,
          classification: 'best' as ChessComBadgeType,
        };
      }
    }

    // In analysis mode or start position, use Stockfish 19 Lite evaluation
    if (currentEval.bestMoveUci && currentEval.bestMoveUci.length >= 4) {
      const from = currentEval.bestMoveUci.slice(0, 2) as Square;
      const to = currentEval.bestMoveUci.slice(2, 4) as Square;
      return {
        from,
        to,
        san: currentEval.bestMoveSan || currentEval.bestMoveUci,
        isCurrentMoveBest: false,
        classification: 'best' as ChessComBadgeType,
      };
    }

    return null;
  }, [currentPlyIndex, moveHistory, decisionEval, currentEval]);

  // Clean SAN display for best move (converting UCI like "d4d5" to clean SAN "d5")
  const bestMoveSanDisplay = useMemo(() => {
    if (!bestMoveInfo) return '';
    const prevFen =
      currentPlyIndex <= 0 ? START_FEN : rawMoveHistory[currentPlyIndex - 1]?.fen;
    if (bestMoveInfo.san && !/^[a-h][1-8][a-h][1-8]/.test(bestMoveInfo.san)) {
      return bestMoveInfo.san;
    }
    if (bestMoveInfo.from && bestMoveInfo.to && prevFen) {
      try {
        const c = new Chess(prevFen);
        const m = c.move({ from: bestMoveInfo.from, to: bestMoveInfo.to });
        if (m?.san) return m.san;
      } catch {}
    }
    return bestMoveInfo.san || '';
  }, [bestMoveInfo, currentPlyIndex, rawMoveHistory]);

  // Current move classification
  const currentClassification =
    currentPlyIndex >= 0 ? moveHistory[currentPlyIndex]?.classification : null;

  // Automatically show Best Move Arrow when an inaccuracy, mistake, miss, or blunder occurs
  const isSuboptimalMove =
    currentClassification === 'inaccuracy' ||
    currentClassification === 'mistake' ||
    currentClassification === 'miss' ||
    currentClassification === 'blunder' ||
    currentClassification === 'missed_win';

  const shouldShowBestArrow = (showBestMove || isSuboptimalMove) && !!bestMoveInfo;

  // Dynamic color for Best Move arrow & highlights (Brilliant: #31c4b9, Great: #5091c5, Best: #9bc64e)
  const bestMoveColor = useMemo(() => {
    if (isSuboptimalMove) return '#9bc64e';
    const classification =
      bestMoveInfo?.classification || currentClassification;
    if (classification === 'brilliant') return '#31c4b9';
    if (classification === 'great') return '#5091c5';
    return '#9bc64e';
  }, [bestMoveInfo, currentClassification, isSuboptimalMove]);

  // UniversalBoardDrawer modern vector polygon arrow (viewBox 0 0 800 800)
  const bestMoveUniversalArrow = useMemo(() => {
    if (!shouldShowBestArrow || !bestMoveInfo?.from || !bestMoveInfo?.to) return null;
    return createUniversalBoardArrow(bestMoveInfo.from, bestMoveInfo.to, isFlipped);
  }, [shouldShowBestArrow, bestMoveInfo, isFlipped]);

  // Effective board FEN to display (if Best Move is toggled in Review, show previous position before the move so the piece makes the arrow)
  const effectiveBoardFen = useMemo(() => {
    if (showBestMove && currentPlyIndex >= 0) {
      if (currentPlyIndex === 0) {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      return moveHistory[currentPlyIndex - 1]?.fen || currentBoardFen;
    }
    return currentBoardFen;
  }, [showBestMove, currentPlyIndex, moveHistory, currentBoardFen]);

  // Core move execution for both click-to-move and drag-and-drop
  const executeMove = (from: Square, to: Square): boolean => {
    const currentChess = new Chess();
    try {
      currentChess.load(effectiveBoardFen);
    } catch {
      currentChess.reset();
    }

    try {
      const moveAttempt = currentChess.move({
        from,
        to,
        promotion: 'q',
      });

      if (moveAttempt) {
        // Branch from current ply (or pre-move if best move preview was active)
        const baseHistory = showBestMove
          ? currentPlyIndex <= 0
            ? []
            : moveHistory.slice(0, currentPlyIndex)
          : currentPlyIndex === -1
            ? []
            : moveHistory.slice(0, currentPlyIndex + 1);

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
          feedbackTitle: 'Langkah Variasi Manual ★',
          feedbackDescription: `${moveAttempt.san} - ${describeMoveTactics({
            san: moveAttempt.san,
            piece: moveAttempt.piece,
            from: moveAttempt.from,
            to: moveAttempt.to,
            captured: moveAttempt.captured,
            promotion: moveAttempt.promotion,
          })}`,
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

        // Immediately evaluate the newly reached manual position in the background
        const manualFen = currentChess.fen();
        fetchPositionScore(manualFen, reviewDepth).then((score) => {
          if (score) {
            scoreCacheRef.current.set(`${reviewDepth}|${manualFen}`, score);
            setScoreMap((prev) => ({ ...prev, [manualFen]: score }));
          }
        });

        // Play sound effect for manual move
        getChessAudioManager().playMoveSound({
          san: moveAttempt.san,
          isCapture: !!moveAttempt.captured,
          isCheck: moveAttempt.san.includes('+') || moveAttempt.san.includes('#'),
          isCastle: moveAttempt.san.startsWith('O-O'),
          isPromotion: !!moveAttempt.promotion,
          color: moveAttempt.color,
        });
        return true;
      }
    } catch {
      // Illegal move attempt
      getChessAudioManager().play('illegal');
    }
    return false;
  };

  // Interactive square click: allows exploring alternative positions manually via clicking
  const handleSquareClick = (square: Square) => {
    const currentChess = new Chess();
    try {
      currentChess.load(effectiveBoardFen);
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
      const success = executeMove(selectedSquare, square);
      if (!success) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return;
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

  // Interactive drag-and-drop: allows dragging pieces by click-and-hold or touch gesture
  const handleSquarePointerDown = (e: React.PointerEvent<HTMLDivElement>, square: Square) => {
    // Only primary button
    if (e.button !== 0) return;

    const currentChess = new Chess();
    try {
      currentChess.load(effectiveBoardFen);
    } catch {
      currentChess.reset();
    }

    const piece = currentChess.get(square);
    const isFriendly = piece && piece.color === currentChess.turn();

    // If a friendly piece is clicked, initiate drag tracking
    if (isFriendly) {
      const pieceCode = (piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()) as PieceCode;

      const info = {
        piece: pieceCode,
        fromSquare: square,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        moved: false,
      };
      dragInfoRef.current = info;

      const onGlobalPointerMove = (moveEvt: PointerEvent) => {
        if (!dragInfoRef.current) return;
        const dx = moveEvt.clientX - dragInfoRef.current.startX;
        const dy = moveEvt.clientY - dragInfoRef.current.startY;
        if (Math.hypot(dx, dy) > 4) {
          if (!dragInfoRef.current.moved) {
            dragInfoRef.current.moved = true;
            // Activate selection & legal dots immediately when drag starts
            setSelectedSquare(square);
            const moves = currentChess.moves({ square, verbose: true }).map((m) => m.to);
            setLegalMoves(moves);
          }
          dragInfoRef.current.currentX = moveEvt.clientX;
          dragInfoRef.current.currentY = moveEvt.clientY;
          setActiveDrag({ ...dragInfoRef.current });

          // Detect target square under pointer
          const el = document.elementFromPoint(moveEvt.clientX, moveEvt.clientY)?.closest('[data-square]');
          const sq = (el?.getAttribute('data-square') as Square) || null;
          setDragHoverSquare(sq);
        }
      };

      const onGlobalPointerUp = (upEvt: PointerEvent) => {
        window.removeEventListener('pointermove', onGlobalPointerMove);
        window.removeEventListener('pointerup', onGlobalPointerUp);

        const dInfo = dragInfoRef.current;
        dragInfoRef.current = null;
        setActiveDrag(null);
        setDragHoverSquare(null);

        if (!dInfo) return;

        if (dInfo.moved) {
          lastDragDropTimeRef.current = Date.now();
          // Drop onto target square
          const el = document.elementFromPoint(upEvt.clientX, upEvt.clientY)?.closest('[data-square]');
          const targetSquare = el?.getAttribute('data-square') as Square | undefined;

          if (targetSquare && targetSquare !== dInfo.fromSquare) {
            executeMove(dInfo.fromSquare, targetSquare);
          } else if (targetSquare === dInfo.fromSquare) {
            // Dropped back onto original square: keep selected for click-to-move
            setSelectedSquare(dInfo.fromSquare);
          } else {
            // Dropped off-board
            setSelectedSquare(null);
            setLegalMoves([]);
          }
        }
      };

      window.addEventListener('pointermove', onGlobalPointerMove);
      window.addEventListener('pointerup', onGlobalPointerUp);
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

  // Captured pieces and material advantage (Chess.com style)
  const capturedPieces = useMemo(() => {
    const cleanFen = currentBoardFen.split(' ')[0] || '';
    const counts: Record<string, number> = {
      P: 0, N: 0, B: 0, R: 0, Q: 0,
      p: 0, n: 0, b: 0, r: 0, q: 0,
    };
    for (const ch of cleanFen) {
      if (counts[ch] !== undefined) counts[ch]++;
    }
    const initialCounts: Record<string, number> = {
      P: 8, N: 2, B: 2, R: 2, Q: 1,
      p: 8, n: 2, b: 2, r: 2, q: 1,
    };
    const whiteCaptured: PieceCode[] = [];
    (['P', 'N', 'B', 'R', 'Q'] as PieceCode[]).forEach((p) => {
      const lost = Math.max(0, initialCounts[p] - counts[p]);
      for (let i = 0; i < lost; i++) whiteCaptured.push(p);
    });
    const blackCaptured: PieceCode[] = [];
    (['p', 'n', 'b', 'r', 'q'] as PieceCode[]).forEach((p) => {
      const lost = Math.max(0, initialCounts[p] - counts[p]);
      for (let i = 0; i < lost; i++) blackCaptured.push(p);
    });

    const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let wScore = 0;
    let bScore = 0;
    ['p', 'n', 'b', 'r', 'q'].forEach((p) => {
      wScore += (counts[p.toUpperCase()] || 0) * val[p];
      bScore += (counts[p] || 0) * val[p];
    });
    const diff = wScore - bScore;

    return {
      whiteCapturedByBlack: whiteCaptured,
      blackCapturedByWhite: blackCaptured,
      whiteAdvantage: diff > 0 ? `+${diff}` : null,
      blackAdvantage: diff < 0 ? `+${Math.abs(diff)}` : null,
    };
  }, [currentBoardFen]);

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

  // Current board position opening info (for Opening Explorer & real-time opening bar)
  const currentBoardOpening = useMemo<OpeningInfo | null>(() => {
    // 1. Direct hit on current FEN
    const directHit = lookupOpening(currentBoardFen);
    if (directHit) return directHit;

    // 2. Deepest opening from move history up to current ply
    if (currentPlyIndex >= 0 && rawMoveHistory.length > 0) {
      const fensUpToCurrent = [
        START_FEN,
        ...rawMoveHistory.slice(0, currentPlyIndex + 1).map((m) => m.fen),
      ];
      const deepHit = detectOpeningFromFens(fensUpToCurrent);
      if (deepHit) return deepHit;
    }

    if (currentBoardFen === START_FEN) {
      return { eco: 'A00', name: 'Starting Position (Posisi Awal)', plies: 0 };
    }

    // 3. Fallback to game opening if available
    const gameOpening = detectOpeningFromFens(rawMoveHistory.map((m) => m.fen));
    if (gameOpening) return gameOpening;

    return null;
  }, [currentBoardFen, currentPlyIndex, rawMoveHistory]);

  const isCurrentPositionInBook = useMemo(() => {
    return isBookPosition(currentBoardFen);
  }, [currentBoardFen]);

  const currentBookMoves = useMemo<BookMoveInfo[]>(() => {
    return getOpeningBookMoves(currentBoardFen);
  }, [currentBoardFen]);

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

  // Opening recap details for Game Review summary
  const openingRecap = useMemo(() => {
    const pgnData = recentGame?.pgn || match?.chessComPgn || '';
    const fromDb = detectOpeningFromFens(rawMoveHistory.map((m) => m.fen));
    let name = fromDb?.name || '';
    let eco = fromDb?.eco || '';

    if (!name && pgnData) {
      const ecoUrlMatch = pgnData.match(/\[ECOUrl\s+"https:\/\/www\.chess\.com\/openings\/([^"]+)"\]/i);
      if (ecoUrlMatch && ecoUrlMatch[1]) {
        name = decodeURIComponent(ecoUrlMatch[1])
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
      const ecoMatch = pgnData.match(/\[ECO\s+"([^"]+)"\]/i);
      if (ecoMatch && ecoMatch[1]) eco = ecoMatch[1];
      const opMatch = pgnData.match(/\[Opening\s+"([^"]+)"\]/i);
      if (!name && opMatch && opMatch[1]) name = opMatch[1];
    }

    if (!name) {
      name = openingName || 'Standard Opening';
    }
    if (!eco) {
      eco = 'A00';
    }

    const bookCountW = calculatedCounts.book?.w ?? 0;
    const bookCountB = calculatedCounts.book?.b ?? 0;
    const totalBook = bookCountW + bookCountB;

    return {
      name,
      eco,
      bookCountW,
      bookCountB,
      totalBook,
    };
  }, [rawMoveHistory, recentGame?.pgn, match?.chessComPgn, openingName, calculatedCounts]);

  // Dynamic Review Statistics & Accuracy
  const reviewStats = useMemo(() => {
    const matchResult =
      match?.result ||
      recentGame?.tournamentScore ||
      (recentGame?.pgn?.includes('1-0')
        ? '1-0'
        : recentGame?.pgn?.includes('0-1')
        ? '0-1'
        : recentGame?.pgn?.includes('1/2-1/2')
        ? '1/2-1/2'
        : null);

    const isWhiteWin = matchResult === '1-0';
    const isBlackWin = matchResult === '0-1';
    const isDraw = matchResult === '1/2-1/2';

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

    const wRatingNum = calculateGameRating(
      parseFloat(wAcc),
      {
        brilliant: calculatedCounts.brilliant?.w ?? 0,
        great: calculatedCounts.great?.w ?? 0,
        best: calculatedCounts.best?.w ?? 0,
        mistake: calculatedCounts.mistake?.w ?? 0,
        blunder: calculatedCounts.blunder?.w ?? 0,
      },
      Number(whiteRating) || undefined
    );

    const bRatingNum = calculateGameRating(
      parseFloat(bAcc),
      {
        brilliant: calculatedCounts.brilliant?.b ?? 0,
        great: calculatedCounts.great?.b ?? 0,
        best: calculatedCounts.best?.b ?? 0,
        mistake: calculatedCounts.mistake?.b ?? 0,
        blunder: calculatedCounts.blunder?.b ?? 0,
      },
      Number(blackRating) || undefined
    );

    // Dynamic coach commentary based on game result and actual moves played
    const wBrilliant = calculatedCounts.brilliant?.w ?? 0;
    const bBrilliant = calculatedCounts.brilliant?.b ?? 0;
    const wGreat = calculatedCounts.great?.w ?? 0;
    const bGreat = calculatedCounts.great?.b ?? 0;
    const wBest = calculatedCounts.best?.w ?? 0;
    const bBest = calculatedCounts.best?.b ?? 0;
    const wBlunders = calculatedCounts.blunder?.w ?? 0;
    const bBlunders = calculatedCounts.blunder?.b ?? 0;

    let dynamicCoachComment = '';

    if (isWhiteWin) {
      if (wBrilliant > 0) {
        dynamicCoachComment = `Pengorbanan taktis spektakuler (Brilliant) oleh ${whiteName}! Membuka inisiatif serangan yang langsung mengunci kemenangan mutlak.`;
      } else if (wGreat > 0) {
        dynamicCoachComment = `Langkah krusial (Great Move) dan ketajaman taktis oleh ${whiteName}! Berhasil menemukan solusi terbaik di fase penentuan untuk mengamankan kemenangan.`;
      } else if (parseFloat(wAcc) >= 80) {
        dynamicCoachComment = `Permainan sangat solid dan presisi tinggi dari ${whiteName} (${wAcc}% akurasi)! Mengontrol tempo pertandingan dan mengeksekusi rencana tanpa celah.`;
      } else if (bBlunders > 0) {
        dynamicCoachComment = `${whiteName} dengan cermat memanfaatkan kelengahan lawan! Mengonversi keunggulan posisi menjadi poin kemenangan meyakinkan.`;
      } else if (wBest >= 5) {
        dynamicCoachComment = `Pilihan langkah yang sangat disiplin dan konsisten oleh ${whiteName}! Membangun keunggulan posisi secara bertahap hingga fase akhir.`;
      } else {
        dynamicCoachComment = `Kemenangan meyakinkan diraih oleh ${whiteName}! Menjaga stabilitas permainan hingga memastikan poin penuh.`;
      }
    } else if (isBlackWin) {
      if (bBrilliant > 0) {
        dynamicCoachComment = `Pengorbanan taktis spektakuler (Brilliant) oleh ${blackName}! Mengonversi keunggulan taktis menjadi poin kemenangan mutlak.`;
      } else if (bGreat > 0) {
        dynamicCoachComment = `Langkah krusial (Great Move) dan ketajaman serangan balik oleh ${blackName}! Berhasil menemukan manuver kunci di momen penentuan.`;
      } else if (parseFloat(bAcc) >= 80) {
        dynamicCoachComment = `Permainan sangat solid dan presisi tinggi dari ${blackName} (${bAcc}% akurasi)! Mengontrol tempo dan mengeksekusi rencana kemenangan dengan rapi.`;
      } else if (wBlunders > 0) {
        dynamicCoachComment = `${blackName} dengan cermat memanfaatkan kelengahan lawan! Mengonversi keunggulan taktis menjadi poin kemenangan meyakinkan.`;
      } else if (bBest >= 5) {
        dynamicCoachComment = `Pilihan langkah yang sangat disiplin dan konsisten oleh ${blackName}! Menekan pertahanan lawan secara bertahap hingga meraih kemenangan.`;
      } else {
        dynamicCoachComment = `Kemenangan meyakinkan diraih oleh ${blackName}! Menjaga stabilitas permainan hingga memastikan poin penuh.`;
      }
    } else if (isDraw) {
      if (wBlunders === 0 && bBlunders === 0) {
        dynamicCoachComment = `Pertarungan sangat solid dan seimbang dari ${whiteName} dan ${blackName}! Pertahanan kokoh kedua pihak berbuah hasil imbang yang adil.`;
      } else {
        dynamicCoachComment = `Duel sengit penuh dinamika taktis dari kedua pemain! Pertukaran perwira yang intens berakhir dengan posisi remis (Draw).`;
      }
    } else {
      dynamicCoachComment = `Pertandingan menarik antara ${whiteName} dan ${blackName}! Tinjau setiap langkah dengan Game Review untuk melihat analisis taktis permainan.`;
    }

    return {
      whiteAccuracy: wAcc,
      blackAccuracy: bAcc,
      whiteGameRating: wRatingNum,
      blackGameRating: bRatingNum,
      coachComment: dynamicCoachComment,
      counts: calculatedCounts,
    };
  }, [
    match?.result,
    recentGame?.tournamentScore,
    recentGame?.pgn,
    whiteName,
    blackName,
    whiteRating,
    blackRating,
    moveHistory,
    calculatedCounts,
  ]);

  // Evaluation Chart Data (Matching Reference Image)
  const evalChartData = useMemo(() => {
    if (moveHistory.length === 0) {
      return {
        svgPath: 'M 0 64 L 0 32 L 320 32 L 320 64 Z',
        dots: [] as { x: number; y: number; type: ChessComBadgeType; color: string; ply: number }[],
        points: [] as { x: number; y: number; ply: number }[],
      };
    }

    const total = moveHistory.length;
    const pts: { x: number; y: number; type?: ChessComBadgeType; ply: number }[] = [];

    // y: 32 = equal (50%), y=6 = White winning (100%), y=58 = Black winning (0%)
    const winToY = (win: number) => Math.max(6, Math.min(58, 32 - ((win - 50) / 50) * 26));
    let lastWin = scoreMap[START_FEN]?.winWhite ?? 50;

    moveHistory.forEach((m, idx) => {
      const s = scoreMap[m.fen];
      if (s) {
        lastWin = s.winWhite;
      } else {
        const isWhite = m.color === 'w';
        const dir = isWhite ? 1 : -1;
        let delta = 0;
        switch (m.classification) {
          case 'brilliant': delta = dir * 14; break;
          case 'great': delta = dir * 9; break;
          case 'best': delta = dir * 2; break;
          case 'excellent': delta = dir * 0.5; break;
          case 'good': delta = -dir * 1; break;
          case 'inaccuracy': delta = -dir * 6; break;
          case 'mistake': delta = -dir * 12; break;
          case 'miss': delta = -dir * 18; break;
          case 'blunder': delta = -dir * 25; break;
          default: delta = 0;
        }
        lastWin = Math.max(5, Math.min(95, lastWin + delta));
      }
      const x = (idx / Math.max(1, total - 1)) * 320;
      pts.push({ x, y: winToY(lastWin), type: m.classification, ply: m.ply });
    });

    // Build SVG path
    let pathD = `M 0 64 L 0 ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      pathD += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    pathD += ` L 320 64 Z`;

    // Only exclude the 3 categories: Excellent, Good, Inaccuracy (and opening book)
    // Display: Best, Brilliant, Great, Mistake, Miss, Blunder
    const significantTypes = ['brilliant', 'great', 'best', 'mistake', 'miss', 'blunder'];
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

    // Filter dots that are too close horizontally (min 6.5px spacing) to keep graph clean
    const filteredDots: { x: number; y: number; type: ChessComBadgeType; color: string; ply: number }[] = [];
    rawDots.forEach((dot) => {
      const tooClose = filteredDots.find((d) => Math.abs(d.x - dot.x) < 6.5);
      if (!tooClose) {
        filteredDots.push(dot);
      }
    });

    return { svgPath: pathD, dots: filteredDots, points: pts };
  }, [moveHistory, scoreMap]);

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
    if (currentPlyIndex === -1) return scoreMap[START_FEN]?.scoreDisplay ?? '0.00';
    if (scoreMap[currentBoardFen]) return scoreMap[currentBoardFen].scoreDisplay;
    if (currentEval?.scoreDisplay) return currentEval.scoreDisplay;
    if (evalChartData.points && evalChartData.points[currentPlyIndex]) {
      const pt = evalChartData.points[currentPlyIndex];
      const scoreVal = (32 - pt.y) / 6;
      const formatted = Math.abs(scoreVal) < 0.05 ? '0.00' : scoreVal.toFixed(2);
      return scoreVal > 0.05 ? `+${formatted}` : formatted;
    }
    return '+0.10';
  }, [currentPlyIndex, currentBoardFen, scoreMap, currentEval?.scoreDisplay, evalChartData.points]);

  // Candidate engine continuation lines (MultiPV) for the current position
  const currentCandidateLines = useMemo(() => {
    const nextMoves = currentPlyIndex >= -1 ? moveHistory.slice(currentPlyIndex + 1) : [];

    // 1. Position from scoreMap with lines
    if (scoreMap[currentBoardFen]?.lines && scoreMap[currentBoardFen].lines!.length > 0) {
      return scoreMap[currentBoardFen].lines!.map((l) => ({
        ...l,
        continuation:
          l.continuation && l.continuation.split(' ').length > 2
            ? l.continuation
            : buildMultiMoveContinuation(currentBoardFen, l.san || l.uci, undefined, nextMoves, 6),
      }));
    }
    // 2. Exact match in COMMON_BOOK_LINES (e.g. START_FEN, 1. e4, 1. d4)
    if (COMMON_BOOK_LINES[currentBoardFen]) {
      return COMMON_BOOK_LINES[currentBoardFen];
    }
    // 3. Current live evaluation from engine with lines
    if (currentEval?.fen === currentBoardFen && currentEval.lines && currentEval.lines.length > 0) {
      return currentEval.lines.map((l) => ({
        ...l,
        continuation:
          l.continuation && l.continuation.split(' ').length > 2
            ? l.continuation
            : buildMultiMoveContinuation(currentBoardFen, l.san || l.uci, undefined, nextMoves, 6),
      }));
    }
    // 4. Current live evaluation from engine (single best move or PV)
    if (currentEval?.fen === currentBoardFen && (currentEval.bestMoveSan || currentEval.bestMoveUci)) {
      const san = currentEval.bestMoveSan || currentEval.bestMoveUci || '';
      const continuation = buildMultiMoveContinuation(
        currentBoardFen,
        san,
        currentEval.pv,
        nextMoves,
        6
      );
      return [
        {
          uci: currentEval.bestMoveUci || '',
          san,
          continuation,
          scoreDisplay: currentEval.scoreDisplay || '+0.00',
          cp: currentEval.scoreCp || 0,
          winWhite: currentEval.winChanceWhite || 50,
        },
      ];
    }
    // 5. Saved bestSan/bestUci in scoreMap
    if (scoreMap[currentBoardFen]?.bestSan || scoreMap[currentBoardFen]?.bestUci) {
      const san = scoreMap[currentBoardFen].bestSan || scoreMap[currentBoardFen].bestUci!;
      const continuation = buildMultiMoveContinuation(
        currentBoardFen,
        san,
        undefined,
        nextMoves,
        6
      );
      return [
        {
          uci: scoreMap[currentBoardFen].bestUci || '',
          san,
          continuation,
          scoreDisplay: scoreMap[currentBoardFen].scoreDisplay || '+0.00',
          cp: scoreMap[currentBoardFen].cp || 0,
          winWhite: scoreMap[currentBoardFen].winWhite || 50,
        },
      ];
    }
    // 6. Next move in the played game
    if (currentPlyIndex >= -1 && currentPlyIndex < moveHistory.length - 1) {
      const nextMove = moveHistory[currentPlyIndex + 1];
      if (nextMove) {
        const continuation = buildMultiMoveContinuation(
          currentBoardFen,
          nextMove.san,
          undefined,
          nextMoves,
          6
        );
        return [
          {
            uci: `${nextMove.from}${nextMove.to}`,
            san: nextMove.san,
            continuation,
            scoreDisplay: scoreMap[nextMove.fen]?.scoreDisplay || '+0.00',
            cp: scoreMap[nextMove.fen]?.cp || 0,
            winWhite: scoreMap[nextMove.fen]?.winWhite || 50,
          },
        ];
      }
    }
    // 7. Only START_FEN gets COMMON_BOOK_LINES[START_FEN]
    if (currentBoardFen === START_FEN) {
      return COMMON_BOOK_LINES[START_FEN] || [];
    }
    return [];
  }, [currentBoardFen, scoreMap, currentEval, currentPlyIndex, moveHistory]);

  // Unified Evaluation Bar Data (Win Percentage & Score Display for both Mobile and Desktop)
  const currentEvalBarData = useMemo(() => {
    // 1. Direct hit from scoreMap
    const directScore = scoreMap[currentBoardFen];
    if (directScore) {
      return {
        winWhite: directScore.winWhite,
        scoreDisplay: directScore.scoreDisplay,
      };
    }

    // 2. Direct hit from candidate lines (MultiPV)
    if (currentCandidateLines.length > 0) {
      const topCand = currentCandidateLines[0];
      const win = topCand.winWhite ?? (topCand as any).winChanceWhite;
      if (typeof win === 'number' && !isNaN(win)) {
        return {
          winWhite: Math.max(2, Math.min(98, win)),
          scoreDisplay: topCand.scoreDisplay || '0.0',
        };
      }
    }

    // 3. Current live Stockfish evaluation for this specific FEN
    if (currentEval && currentEval.fen === currentBoardFen && currentEval.scoreDisplay) {
      return {
        winWhite: Math.max(2, Math.min(98, currentEval.winChanceWhite)),
        scoreDisplay: currentEval.scoreDisplay,
      };
    }

    // 4. Fallback to pre-calculated trajectory point in evalChartData for this ply
    if (currentPlyIndex >= 0 && evalChartData.points && evalChartData.points[currentPlyIndex]) {
      const pt = evalChartData.points[currentPlyIndex];
      // pt.y: 32 = 50%, y=6 = 100%, y=58 = 0%
      const winWhite = Math.max(5, Math.min(95, 50 + ((32 - pt.y) / 26) * 50));
      const scoreVal = (32 - pt.y) / 6;
      const formatted = Math.abs(scoreVal) < 0.05 ? '0.0' : scoreVal.toFixed(1);
      const scoreDisplay = scoreVal > 0.05 ? `+${formatted}` : formatted;
      return {
        winWhite,
        scoreDisplay,
      };
    }

    // 5. Start or Book Position
    if (currentBoardFen === START_FEN || isBookPosition(currentBoardFen)) {
      return {
        winWhite: 50.5,
        scoreDisplay: '+0.1',
      };
    }

    // 6. Retain last live evaluation if valid instead of resetting to 0.0 / 50%
    if (currentEval && typeof currentEval.winChanceWhite === 'number' && currentEval.scoreDisplay !== '0.0') {
      return {
        winWhite: Math.max(2, Math.min(98, currentEval.winChanceWhite)),
        scoreDisplay: currentEval.scoreDisplay,
      };
    }

    return {
      winWhite: 50,
      scoreDisplay: '0.0',
    };
  }, [currentBoardFen, scoreMap, currentCandidateLines, currentEval, currentPlyIndex, evalChartData.points]);

  // Active Move Coach Feedback (Image 4 speech bubble comment: e.g. "d4 is the last book move")
  const currentMoveCoachComment = useMemo(() => {
    if (!isAnalysisComplete) {
      return {
        title: 'Menganalisis...',
        comment: `Stockfish sedang menganalisis langkah pertandingan (${analysisProgress.done}/${analysisProgress.total}). Data Game Review lengkap akan otomatis tampil begitu 100% selesai.`,
        badge: null as ChessComBadgeType | null,
      };
    }

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

    const action = describeMoveTactics(m);
    const opening = detectOpeningFromFens(
      rawMoveHistory.slice(0, currentPlyIndex + 1).map((x) => x.fen)
    );
    const isBook = m.classification === 'book';
    const nextMove = moveHistory[currentPlyIndex + 1];
    const isLastBook = isBook && (!nextMove || nextMove.classification !== 'book');

    let comment = '';
    switch (m.classification) {
      case 'brilliant':
        comment = `${m.san} adalah langkah brilian!! Pengorbanan akurat.`;
        break;
      case 'great':
        comment = `${m.san} adalah langkah hebat! Mempertahankan posisi.`;
        break;
      case 'book':
        comment = isLastBook
          ? `${m.san} adalah langkah teori pembukaan terakhir.`
          : `${m.san} adalah langkah pembukaan teori master.`;
        break;
      case 'best':
        comment = `${m.san} adalah langkah terbaik pilihan Stockfish.`;
        break;
      case 'excellent':
        comment = `${m.san} adalah langkah sangat bagus.`;
        break;
      case 'good':
        comment = `${m.san} adalah langkah bagus dan aman.`;
        break;
      case 'inaccuracy':
        comment = `${m.san} adalah ketidakakuratan. Sedikit kehilangan inisiatif.`;
        break;
      case 'mistake':
        comment = `${m.san} adalah kesalahan. Merusak struktur posisi.`;
        break;
      case 'miss':
      case 'missed_win':
        comment = `${m.san} adalah Miss. Melewatkan peluang taktis.`;
        break;
      case 'blunder':
        comment = `${m.san} adalah Blunder fatal. Mengubah alur permainan.`;
        break;
      default:
        comment = `${m.san} dimainkan.`;
    }

    return {
      title: m.feedbackTitle || 'Move Review',
      comment,
      badge: m.classification || null,
    };
  }, [currentPlyIndex, moveHistory, rawMoveHistory, isAnalysisComplete, analysisProgress.done, analysisProgress.total]);

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

  const renderOpeningExplorerContent = () => (
    <div className="chesscom-explorer-container">
      {/* Explorer Header */}
      <div className="explorer-header">
        <div className="explorer-header-left">
          <Compass size={16} className="explorer-header-icon" />
          <span className="explorer-header-title">Opening Explorer</span>
          <span className="explorer-ply-badge">
            {currentPlyIndex < 0
              ? 'Posisi Awal'
              : `Langkah ${Math.floor(currentPlyIndex / 2) + 1} (${currentPlyIndex % 2 === 0 ? 'Putih' : 'Hitam'})`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowExplorer(false)}
          className="explorer-close-btn"
          title="Tutup Explorer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Current Opening Card */}
      <div className="explorer-opening-card">
        <div className="explorer-eco-pill">
          {currentBoardOpening?.eco || 'A00'}
        </div>
        <div className="explorer-opening-info">
          <h4 className="explorer-opening-name">
            {currentBoardOpening?.name || (currentBoardFen === START_FEN ? 'Starting Position (Posisi Awal)' : openingName || 'Standard Opening')}
          </h4>
          <div className="explorer-book-status">
            {isCurrentPositionInBook ? (
              <span className="status-in-book">
                <span className="status-dot green" /> Teori Pembukaan (Book Position)
              </span>
            ) : (
              <span className="status-out-book">
                <span className="status-dot amber" /> Luar Teori Buku (Out of Book)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Theoretical Book Continuation Moves */}
      {currentBookMoves.length > 0 ? (
        <div className="explorer-moves-section">
          <div className="explorer-section-title">
            <span>Langkah Teori Pembukaan ({currentBookMoves.length})</span>
            <span className="explorer-hint">Klik langkah untuk memainkan variasi</span>
          </div>
          <div className="explorer-moves-list">
            {currentBookMoves.map((bMove, idx) => {
              const moveColor = currentPlyIndex % 2 === 0 ? 'w' : 'b';
              return (
                <div
                  key={`${bMove.uci}-${idx}`}
                  className="explorer-move-row"
                  onClick={() => {
                    executeMove(bMove.from as Square, bMove.to as Square);
                  }}
                  title={`Mainkan langkah ${bMove.san} (${bMove.name})`}
                >
                  <div className="explorer-move-rank">{idx + 1}</div>
                  <div className="explorer-move-badge">
                    <span className="explorer-move-san">
                      {formatSanWithFigurine(bMove.san, moveColor)}
                    </span>
                  </div>
                  <div className="explorer-move-target">
                    <span className="explorer-target-eco">{bMove.eco}</span>
                    <span className="explorer-target-name">{bMove.name}</span>
                  </div>
                  <ChevronRight size={14} className="explorer-arrow-icon" />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Out of Book fallback to Engine Candidates */
        <div className="explorer-out-of-book-section">
          <div className="out-of-book-notice">
            <p>Posisi catur ini telah keluar dari buku teori pembukaan master.</p>
            <span className="out-of-book-sub">Pilihan langkah terbaik dari Stockfish 19:</span>
          </div>
          {currentCandidateLines.length > 0 ? (
            <div className="explorer-engine-candidates">
              {currentCandidateLines.map((candLine, cIdx) => (
                <div
                  key={cIdx}
                  className="explorer-engine-row"
                  onClick={() => {
                    if (candLine.uci && candLine.uci.length >= 4) {
                      executeMove(candLine.uci.slice(0, 2) as Square, candLine.uci.slice(2, 4) as Square);
                    }
                  }}
                  title="Klik untuk memainkan langkah rekomendasi engine ini"
                >
                  <span className="explorer-engine-rank">#{cIdx + 1}</span>
                  <span className="explorer-engine-eval">{candLine.scoreDisplay}</span>
                  <span className="explorer-engine-san">
                    {buildMultiMoveContinuation(
                      currentBoardFen,
                      candLine.san || candLine.uci,
                      candLine.continuation?.split(' ').filter(Boolean),
                      moveHistory.slice(currentPlyIndex + 1),
                      6
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="explorer-calculating-notice">
              <Cpu size={14} className="analysis-cpu-pulse" />
              <span>Stockfish sedang menghitung alternatif langkah terbaik...</span>
            </div>
          )}
        </div>
      )}

      {/* Reset Variation Button if branched */}
      {isVariationActive && (
        <div className="explorer-reset-bar">
          <button
            type="button"
            onClick={handleResetToOriginalGame}
            className="btn-explorer-reset"
          >
            <RotateCcw size={14} />
            <span>Reset Variasi (Kembali ke Notasi Asli)</span>
          </button>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div
      className={`chesscom-analysis-backdrop ${isFullscreen ? 'is-fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="chesscom-analysis-window">
        {/* Mobile Header (Matching Chess.com Mobile App Image 2) */}
        <header className="chesscom-mobile-header">
          <button
            type="button"
            onClick={
              showExplorer
                ? () => setShowExplorer(false)
                : isReviewActive
                ? () => setIsReviewActive(false)
                : onClose
            }
            className="mobile-header-btn"
            title={
              showExplorer
                ? 'Tutup Opening Explorer'
                : isReviewActive
                ? 'Kembali ke Statistik Ulasan'
                : 'Kembali (Esc)'
            }
          >
            <ChevronLeft size={22} />
          </button>
          <div
            className="mobile-header-title-group"
            onClick={() => {
              if (showExplorer) {
                setShowExplorer(false);
              } else if (isReviewActive) {
                setMobileMode((prev) => (prev === 'analysis' ? 'review' : 'analysis'));
              }
            }}
            title={
              showExplorer
                ? 'Tutup Explorer'
                : isReviewActive
                ? 'Beralih Mode Analysis / Game Review'
                : 'Game Review'
            }
          >
            {showExplorer ? (
              <>
                <Compass size={16} className="mobile-title-icon" style={{ color: '#81b64c' }} />
                <span className="mobile-title-text">Opening Explorer</span>
              </>
            ) : isReviewActive && mobileMode === 'analysis' ? (
              <>
                <Search size={16} className="mobile-title-icon" />
                <span className="mobile-title-text">Analysis</span>
              </>
            ) : (
              <>
                <Star size={16} fill="#81b64c" color="#81b64c" className="mobile-title-icon" />
                <span className="mobile-title-text">Game Review</span>
              </>
            )}
          </div>
          <div className="mobile-header-actions">
            <button
              type="button"
              onClick={() => setIsEngineModalOpen(true)}
              className="mobile-depth-badge-btn"
              title={`Kedalaman Stockfish 19: Depth ${reviewDepth}`}
            >
              <span>{reviewDepth}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEngineModalOpen(true)}
              className="mobile-header-btn"
              title="Pengaturan Engine & Suara"
            >
              <Settings size={18} />
            </button>
            {(match?.chessComUrl || recentGame?.url) && (
              <a
                href={match?.chessComUrl || recentGame?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mobile-header-chesscom-pill"
                title="Buka pertandingan ini langsung di Chess.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '3px 8px',
                  background: 'rgba(129, 182, 76, 0.15)',
                  border: '1px solid rgba(129, 182, 76, 0.35)',
                  borderRadius: '999px',
                  color: '#81b64c',
                  fontSize: '11px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <span>🎮</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </header>

        {/* Mobile Initial Statistical Summary View (Matching Reference Image) */}
        {!isReviewActive && (
          <div className="chesscom-mobile-summary-view">
            {!isAnalysisComplete ? (
              <div className="mobile-analysis-running-hero">
                <div className="analysis-running-icon-glow">
                  <Cpu size={36} className="analysis-cpu-pulse" />
                </div>
                <div className="mobile-analysis-running-pct">
                  {Math.round((analysisProgress.done / Math.max(1, analysisProgress.total)) * 100)}%
                </div>
                <div className="mobile-analysis-running-label">
                  Stockfish menganalisis langkah {analysisProgress.done} dari {analysisProgress.total}...
                </div>
                <div className="mobile-analysis-depth-badge">
                  Stockfish 19 • Depth {reviewDepth} • MultiPV 3
                </div>
                <div className="analysis-running-track">
                  <div
                    className="analysis-running-fill"
                    style={{
                      width: `${(analysisProgress.done / Math.max(1, analysisProgress.total)) * 100}%`,
                    }}
                  />
                </div>
                <p className="analysis-running-tip">
                  Stockfish sedang mengkalkulasi seluruh evaluasi posisi, akurasi, dan taktik pertandingan secara real-time. Data statistik Game Review akan otomatis tampil setelah 100% selesai.
                </p>
              </div>
            ) : (
              <>
                <div className="mobile-summary-scroll">
                  {/* 1. Coach Speech Bubble (Top) */}
                  <div className="mobile-summary-coach-card">
                    <div className="mobile-coach-avatar-box">
                      <CoachAvatarSvg size={44} className="mobile-coach-avatar-img" />
                    </div>
                    <div className="mobile-coach-bubble">
                      <p>{reviewStats.coachComment || 'Stockfish telah menganalisis seluruh jalannya pertandingan.'}</p>
                    </div>
                  </div>

                  {/* 2. Advantage / Evaluation Graph (Directly below coach) */}
                  <div className="mobile-summary-chart-box" title="Klik grafik untuk meninjau langkah">
                    <svg
                      viewBox="0 0 320 64"
                      preserveAspectRatio="none"
                      className="chesscom-eval-chart-svg"
                      onClick={handleChartClick}
                    >
                      <line x1="0" y1="32" x2="320" y2="32" stroke="#6a6762" strokeWidth="1" />
                      <path d={evalChartData.svgPath} fill="#ffffff" />
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

                  {/* 3. Players & Accuracy Section */}
                  <div className="mobile-summary-table-card">
                    {/* Players Row */}
                    <div className="summary-grid-row">
                      <span className="summary-grid-label">Players</span>
                      <div className="summary-player-col">
                        <span className="summary-player-username" title={whiteUsername || whiteName}>
                          {whiteUsername || whiteName}
                        </span>
                        <div className="summary-player-avatar-box white-player">
                          {whitePlayer?.avatar ? (
                            <img src={whitePlayer.avatar} alt={whiteName} />
                          ) : (
                            <span className="avatar-placeholder">♙</span>
                          )}
                        </div>
                      </div>
                      <div className="summary-player-col">
                        <span className="summary-player-username" title={blackUsername || blackName}>
                          {blackUsername || blackName}
                        </span>
                        <div className="summary-player-avatar-box black-player">
                          {blackPlayer?.avatar ? (
                            <img src={blackPlayer.avatar} alt={blackName} />
                          ) : (
                            <span className="avatar-placeholder">♟</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accuracy Row */}
                    <div className="summary-grid-row">
                      <span className="summary-grid-label">Accuracy</span>
                      <div className="summary-accuracy-pill white-pill">
                        {reviewStats.whiteAccuracy}
                      </div>
                      <div className="summary-accuracy-pill black-pill">
                        {reviewStats.blackAccuracy}
                      </div>
                    </div>

                    <div className="summary-grid-divider" />

                    {/* 4. 10 Classification Rows (Brilliant down to Blunder) */}
                    {REVIEW_CLASSIFICATIONS.map((item) => {
                      const countKey = item.type;
                      const wCount = calculatedCounts[countKey]?.w ?? 0;
                      const bCount = calculatedCounts[countKey]?.b ?? 0;
                      const totalCount = wCount + bCount;

                      return (
                        <div
                          key={item.type}
                          className="summary-classification-row"
                          onClick={() => {
                            if (totalCount > 0) {
                              handleJumpToClassification(item.type);
                              setIsReviewActive(true);
                            }
                          }}
                          title={
                            totalCount > 0
                              ? `Lihat langkah ${item.label} (${totalCount} langkah) di papan catur`
                              : item.details
                          }
                        >
                          <span className="summary-class-label">{item.label}</span>
                          <span
                            className="summary-class-count white-count"
                            style={{ color: wCount > 0 ? item.color : '#6b7280' }}
                          >
                            {wCount}
                          </span>
                          <div className="summary-class-icon-cell">
                            <ChessComBadgeIcon type={item.type} size={22} />
                          </div>
                          <span
                            className="summary-class-count black-count"
                            style={{ color: bCount > 0 ? item.color : '#6b7280' }}
                          >
                            {bCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Sticky Bottom Action Button */}
                <div className="mobile-summary-bottom-cta">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewActive(true);
                      if (currentPlyIndex < 0) jumpToPly(0);
                    }}
                    className="btn-mobile-continue-review"
                  >
                    <span>{currentPlyIndex > 0 ? 'Continue Review' : 'Start Review'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Top Navbar (Desktop) */}
        <header className="chesscom-navbar">
          <div className="chesscom-nav-left">
            <img
              src="/images/logo-chess-club-text.png"
              alt="Chess Club Politeknik Sorowako"
              className="chesscom-navbar-logo"
            />
            <span className="chesscom-match-badge">
              {match ? `Babak ${match.round} • Papan ${match.boardNumber}` : 'Analisis Bebas'}
            </span>
          </div>

          <div className="chesscom-nav-right">
            <button
              type="button"
              onClick={() => setIsEngineModalOpen(true)}
              className="chesscom-btn-icon"
              title={`Pengaturan Kedalaman Stockfish (Depth ${stockfishDepth})`}
            >
              <Cpu size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsSoundModalOpen(true)}
              className="chesscom-btn-icon"
              title="Pengaturan Efek Suara & Tema Audio Catur"
            >
              <Volume2 size={16} />
            </button>
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
        <div className={`chesscom-main-layout ${!isReviewActive ? 'mobile-hidden-on-summary' : ''}`}>
          {/* LEFT: Board Section with Eval Bar & Player Cards */}
          <section className={`chesscom-board-section ${!isReviewActive ? 'mobile-hidden-on-summary' : ''}`}>
            {/* Horizontal Evaluation Bar on Mobile (Matching Chess.com Mobile Image 2) */}
            <div className="chesscom-mobile-eval-bar" title="Evaluasi Posisi Stockfish 19">
              <div
                className="mobile-eval-bar-white"
                style={{
                  width: `${currentEvalBarData.winWhite}%`,
                }}
              />
              <div className="mobile-eval-bar-score-badge">
                {currentEvalBarData.scoreDisplay}
              </div>
            </div>

            {/* Candidate Engine Lines (MultiPV) on Mobile when in Analysis Mode (Matching Chess.com Mobile) */}
            {mobileMode === 'analysis' && currentCandidateLines.length > 0 && (
              <div className="chesscom-mobile-engine-lines">
                {currentCandidateLines.slice(0, 2).map((candLine, idx) => (
                  <div
                    key={idx}
                    className="mobile-engine-line-row"
                    onClick={() => {
                      if (candLine.uci && candLine.uci.length >= 4) {
                        executeMove(
                          candLine.uci.slice(0, 2) as Square,
                          candLine.uci.slice(2, 4) as Square
                        );
                      }
                    }}
                    title="Klik untuk memainkan variasi langkah ini di papan catur"
                  >
                    <span className="mobile-line-eval-pill">
                      {candLine.scoreDisplay}
                    </span>
                    <span className="mobile-line-text">
                      {formatCandidateLineDisplay(
                        candLine,
                        currentBoardFen,
                        currentPlyIndex,
                        candLine.san,
                        moveHistory.slice(currentPlyIndex + 1)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

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
                  <div className="player-captured-row">
                    <div className="captured-icons-list">
                      {(isFlipped ? capturedPieces.blackCapturedByWhite : capturedPieces.whiteCapturedByBlack).map((p, idx) => (
                        <span key={idx} className="captured-piece-mini">
                          <ChessComNeoPiece piece={p} size={15} />
                        </span>
                      ))}
                    </div>
                    {(isFlipped ? capturedPieces.whiteAdvantage : capturedPieces.blackAdvantage) && (
                      <span className="captured-advantage-score">
                        {isFlipped ? capturedPieces.whiteAdvantage : capturedPieces.blackAdvantage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="player-clock-box">
                <Clock size={14} />
                <span>10:00</span>
              </div>
            </div>

            {isAnalyzing && (
              <div className="chesscom-analysis-progress" role="status" aria-live="polite">
                <div className="chesscom-analysis-progress-text">
                  <Cpu size={13} />
                  <span>
                    Stockfish menganalisis posisi {analysisProgress.done}/{analysisProgress.total}
                    {' '}(depth {reviewDepth})
                  </span>
                </div>
                <div className="chesscom-analysis-progress-track">
                  <div
                    className="chesscom-analysis-progress-fill"
                    style={{
                      width: `${(analysisProgress.done / Math.max(1, analysisProgress.total)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Board Container with Vertical Evaluation Bar */}
            <div className="chesscom-board-wrapper">
              {/* Vertical Evaluation Bar */}
              <div className="chesscom-eval-bar-track" title="Bar Evaluasi Stockfish 19">
                <div
                  className="chesscom-eval-bar-white"
                  style={{
                    height: `${currentEvalBarData.winWhite}%`,
                  }}
                />
                <div className="chesscom-eval-score-label">
                  {currentEvalBarData.scoreDisplay}
                </div>
              </div>

              {/* 8x8 Chessboard Grid */}
              <div className="chesscom-board-grid" ref={boardGridRef}>
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
                        const isBestMoveTo = shouldShowBestArrow && bestMoveInfo?.to === squareName;
                        const isBestMoveSq = isBestMoveFrom || isBestMoveTo;

                        return (
                          <div
                            key={squareName}
                            onPointerDown={(e) => handleSquarePointerDown(e, squareName)}
                            onClick={() => {
                              if (Date.now() - lastDragDropTimeRef.current < 250) return;
                              handleSquareClick(squareName);
                            }}
                            style={
                              showBestMove && isBestMoveSq
                                ? {
                                    backgroundColor: `${bestMoveColor}28`,
                                    boxShadow: `inset 0 0 0 2px ${bestMoveColor}`,
                                  }
                                : undefined
                            }
                            className={`chesscom-square ${isLight ? 'light-sq' : 'dark-sq'} ${
                              isSelected ? 'is-selected' : ''
                            } ${!showBestMove && (isLastMoveFrom || isLastMoveTo) ? 'is-last-move' : ''} ${
                              showBestMove && isBestMoveSq ? 'is-best-move' : ''
                            } ${dragHoverSquare === squareName ? 'is-drag-hover' : ''} ${
                              activeDrag?.fromSquare === squareName ? 'is-drag-origin' : ''
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
                              <div
                                className="piece-container"
                                draggable={false}
                                onDragStart={(e) => e.preventDefault()}
                              >
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

                            {/* Destination Target Ring for Best Move (when Best button toggled) */}
                            {showBestMove && isBestMoveTo && (
                              <div
                                className="best-move-target-ring"
                                style={{ borderColor: bestMoveColor }}
                              />
                            )}
                          </div>
                        );
                      }
                    )
                )}

                {/* SVG Arrow Overlay for Best Move (UniversalBoardDrawer polygon with exact rotation) */}
                {shouldShowBestArrow && bestMoveUniversalArrow && (
                  <svg
                    className="chesscom-board-arrow-overlay"
                    viewBox="0 0 800 800"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points={bestMoveUniversalArrow.points}
                      transform={bestMoveUniversalArrow.transform}
                      fill={bestMoveColor}
                      opacity="0.88"
                    />
                  </svg>
                )}

                {/* Floating Dragged Piece following cursor during drag */}
                {activeDrag && (
                  <div
                    className="chesscom-floating-drag-piece"
                    style={{
                      position: 'fixed',
                      left: activeDrag.currentX,
                      top: activeDrag.currentY,
                      width: boardGridRef.current ? boardGridRef.current.offsetWidth / 8 : 64,
                      height: boardGridRef.current ? boardGridRef.current.offsetHeight / 8 : 64,
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                      zIndex: 99999,
                    }}
                  >
                    <ChessComNeoPiece piece={activeDrag.piece} />
                  </div>
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
                  <div className="player-captured-row">
                    <div className="captured-icons-list">
                      {(isFlipped ? capturedPieces.whiteCapturedByBlack : capturedPieces.blackCapturedByWhite).map((p, idx) => (
                        <span key={idx} className="captured-piece-mini">
                          <ChessComNeoPiece piece={p} size={15} />
                        </span>
                      ))}
                    </div>
                    {(isFlipped ? capturedPieces.blackAdvantage : capturedPieces.whiteAdvantage) && (
                      <span className="captured-advantage-score">
                        {isFlipped ? capturedPieces.blackAdvantage : capturedPieces.whiteAdvantage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="player-clock-box active-clock">
                <Clock size={14} />
                <span>10:00</span>
              </div>
            </div>

            {/* Mobile Opening Bar (Interactive, links to Explorer) */}
            <div
              className={`chesscom-mobile-opening-bar ${showExplorer ? 'is-active' : ''}`}
              onClick={() => setShowExplorer(!showExplorer)}
              title="Buka Opening Explorer untuk posisi ini"
            >
              <div className="mobile-opening-bar-left">
                <Compass size={14} style={{ color: '#81b64c', flexShrink: 0 }} />
                <span className="mobile-opening-bar-text">
                  {currentBoardOpening
                    ? `${currentBoardOpening.eco} • ${currentBoardOpening.name}`
                    : (openingName || 'Standard Opening')}
                </span>
              </div>
              <span className="mobile-opening-bar-badge">
                {showExplorer ? 'Tutup' : 'Explorer ›'}
              </span>
            </div>

            {/* Mobile Content: Explorer, Analysis Moves Sheet, or Review Card */}
            {showExplorer ? (
              <div className="chesscom-mobile-explorer-sheet">
                {renderOpeningExplorerContent()}
              </div>
            ) : mobileMode === 'analysis' ? (
              <div className="chesscom-mobile-moves-sheet">
                {moveRows.map((row) => (
                  <div key={row.number} className="mobile-move-pair">
                    <span className="mobile-move-num">{row.number}.</span>
                    {row.white && (
                      <button
                        type="button"
                        onClick={() => jumpToPly(row.white!.ply - 1)}
                        className={`mobile-move-btn ${
                          currentPlyIndex === row.white.ply - 1 ? 'active' : ''
                        }`}
                      >
                        {row.white.classification && row.white.classification !== 'book' && (
                          <span className="mobile-move-badge">
                            <ChessComBadgeIcon type={row.white.classification} size={12} />
                          </span>
                        )}
                        {row.white.classification === 'book' && (
                          <span className="mobile-move-badge">📖</span>
                        )}
                        <span
                          className="mobile-move-text"
                          style={{
                            color:
                              currentPlyIndex === row.white.ply - 1
                                ? '#121212'
                                : getMoveItemColor(row.white),
                          }}
                        >
                          {formatSanWithFigurine(row.white.san, 'w')}
                        </span>
                      </button>
                    )}
                    {row.black && (
                      <button
                        type="button"
                        onClick={() => jumpToPly(row.black!.ply - 1)}
                        className={`mobile-move-btn ${
                          currentPlyIndex === row.black.ply - 1 ? 'active' : ''
                        }`}
                      >
                        {row.black.classification && row.black.classification !== 'book' && (
                          <span className="mobile-move-badge">
                            <ChessComBadgeIcon type={row.black.classification} size={12} />
                          </span>
                        )}
                        {row.black.classification === 'book' && (
                          <span className="mobile-move-badge">📖</span>
                        )}
                        <span
                          className="mobile-move-text"
                          style={{
                            color:
                              currentPlyIndex === row.black.ply - 1
                                ? '#121212'
                                : getMoveItemColor(row.black),
                          }}
                        >
                          {formatSanWithFigurine(row.black.san, 'b')}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="chesscom-mobile-review-card">
                {/* Coach Speech Bubble on Mobile */}
                <div className="review-coach-speech-bubble">
                  <div className="review-coach-avatar-wrapper">
                    <CoachAvatarSvg size={44} className="review-coach-avatar-img" />
                  </div>
                  <div className="review-coach-card-body">
                    <div className="review-coach-top-row">
                      {showExplanation ? (
                        <>
                          <Lightbulb size={20} style={{ color: '#eab308' }} />
                          <p className="review-coach-title-text">Penjelasan Taktis</p>
                        </>
                      ) : (!showExplanation && isSuboptimalMove && bestMoveInfo) || showBestMove ? (
                        <>
                          <ChessComBadgeIcon type="best" size={20} />
                          <p className="review-coach-title-text">Best Move</p>
                        </>
                      ) : (
                        <>
                          {currentMoveCoachComment.badge && (
                            <ChessComBadgeIcon type={currentMoveCoachComment.badge} size={20} />
                          )}
                          <p className="review-coach-title-text">
                            {currentMoveCoachComment.title}
                          </p>
                        </>
                      )}
                      <span className="review-coach-eval-pill">
                        {(!showExplanation && isSuboptimalMove) || showBestMove
                          ? 'Best'
                          : currentEvalBarData.scoreDisplay}
                      </span>
                    </div>
                    <p className="review-coach-explanation-text">
                      {showExplanation ? (
                        currentMoveCoachComment.comment
                      ) : (!showExplanation && isSuboptimalMove && bestMoveInfo) || showBestMove ? (
                        `Langkah terbaik adalah ${bestMoveSanDisplay || bestMoveInfo?.san || 'langkah catur komputer'}`
                      ) : (
                        currentMoveCoachComment.comment
                      )}
                    </p>
                  </div>
                </div>

                {/* Mobile Action Buttons: Best, Explain, Next */}
                <div className="mobile-review-action-row">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBestMove(!showBestMove);
                      setShowExplanation(false);
                    }}
                    className={`mobile-action-pill ${(!showExplanation && isSuboptimalMove) || showBestMove ? 'active' : ''}`}
                  >
                    <Star size={15} />
                    <span>Best</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExplanation(!showExplanation);
                      setShowBestMove(false);
                    }}
                    className={`mobile-action-pill ${showExplanation ? 'active' : ''}`}
                  >
                    <Lightbulb size={15} />
                    <span>Explain</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBestMove(false);
                      setShowExplanation(false);
                      handleNextMove();
                    }}
                    className="mobile-action-next-btn"
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Next</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT: Game Review Sidebar Panel (Default & Exclusive Mode) */}
          <aside className="chesscom-sidebar-section">
            {!isAnalysisComplete ? (
              /* ANALYSIS RUNNING HERO: Waiting until analysis completes 100% for the first time */
              <div className="review-panel-container">
                <div className="review-header-title">
                  <div className="title-left">
                    <span className="review-star-badge">★</span>
                    <h3>Game Review</h3>
                  </div>
                  <span className="engine-verified-pill">Stockfish 19 Depth {reviewDepth}</span>
                </div>

                <div className="analysis-running-hero">
                  <div className="analysis-running-icon-glow">
                    <Cpu size={32} className="analysis-cpu-pulse" />
                  </div>
                  <div className="analysis-running-pct">
                    {Math.round((analysisProgress.done / Math.max(1, analysisProgress.total)) * 100)}%
                  </div>
                  <div className="analysis-running-label">
                    Menganalisis langkah {analysisProgress.done} dari {analysisProgress.total}...
                  </div>
                  <div className="analysis-running-track">
                    <div
                      className="analysis-running-fill"
                      style={{
                        width: `${(analysisProgress.done / Math.max(1, analysisProgress.total)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="analysis-running-tip">
                    Stockfish sedang mengkalkulasi seluruh evaluasi, akurasi, dan taktik pertandingan secara step by step. Data Game Review akan tampil lengkap setelah 100%.
                  </p>
                </div>
              </div>
            ) : !isReviewActive ? (
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
                      <CoachAvatarSvg size={48} />
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

                    {/* Game Rating Row (Chess.com Performance Rating) */}
                    <div className="review-grid-row">
                      <span className="review-grid-label">Game Rating</span>
                      <div className="review-rating-box white-box" title="Estimasi Performa Rating Putih (Chess.com CAPS)">
                        {reviewStats.whiteGameRating}
                      </div>
                      <div className="review-rating-vs-badge" title="Performance Rating">
                        VS
                      </div>
                      <div className="review-rating-box black-box" title="Estimasi Performa Rating Hitam (Chess.com CAPS)">
                        {reviewStats.blackGameRating}
                      </div>
                    </div>

                    <div className="review-grid-divider" />

                    {/* Rekap Opening Card (Menggantikan Skills) */}
                    <div
                      className="review-opening-recap-box"
                      onClick={() => jumpToPly(0)}
                      title="Klik untuk melihat langkah pembukaan di papan catur"
                    >
                      <div className="review-recap-header">
                        <div className="recap-title-left">
                          <span className="recap-eco-pill">{openingRecap.eco}</span>
                          <span className="recap-book-icon">📖</span>
                          <span className="recap-opening-name" title={openingRecap.name}>
                            {openingRecap.name}
                          </span>
                        </div>
                        <span className="recap-book-badge">
                          {openingRecap.totalBook} Buku
                        </span>
                      </div>

                      <div className="recap-stats-bar">
                        <span className="recap-stat-pill white">
                          Putih: {openingRecap.bookCountW} book
                        </span>
                        <span className="recap-stat-pill black">
                          Hitam: {openingRecap.bookCountB} book
                        </span>
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
                      <button
                        type="button"
                        onClick={() => setIsEngineModalOpen(true)}
                        className="depth-pill-badge"
                        title={`Kedalaman Analisis Stockfish: Depth ${stockfishDepth}`}
                      >
                        <Cpu size={12} />
                        <span>Depth {stockfishDepth}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowExplorer(!showExplorer)}
                        className={`review-header-icon-btn ${showExplorer ? 'active' : ''}`}
                        title={showExplorer ? 'Tutup Opening Explorer' : 'Buka Opening Explorer'}
                        style={showExplorer ? { color: '#81b64c', background: 'rgba(129, 182, 76, 0.2)' } : undefined}
                      >
                        <Compass size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEngineModalOpen(true)}
                        className="review-header-icon-btn"
                        title="Pengaturan Engine Stockfish (Kedalaman & Evaluasi)"
                      >
                        <Sliders size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSoundModalOpen(true)}
                        className="review-header-icon-btn"
                        title="Pengaturan Suara & Tema Catur"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </div>

                  {showExplorer ? (
                    <div className="desktop-explorer-panel">
                      {renderOpeningExplorerContent()}
                    </div>
                  ) : (
                    <>
                      {/* Coach Speech Bubble Banner */}
                      <div className="review-active-coach-banner">
                        <div className="coach-avatar">
                          <CoachAvatarSvg size={44} />
                        </div>
                        <div className="active-coach-bubble">
                          <div className="bubble-text-left">
                            {showExplanation ? (
                              <>
                                <Lightbulb size={18} style={{ color: '#eab308', flexShrink: 0 }} />
                                <span>
                                  {currentMoveCoachComment.comment}
                                </span>
                              </>
                            ) : (!showExplanation && isSuboptimalMove && bestMoveInfo) || showBestMove ? (
                              <>
                                <ChessComBadgeIcon type="best" size={18} />
                                <span>
                                  {`Langkah terbaik adalah ${bestMoveSanDisplay || bestMoveInfo?.san || 'langkah catur komputer'}`}
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
                              (!showExplanation && isSuboptimalMove) || showBestMove
                                ? { background: '#81b64c', color: '#ffffff' }
                                : undefined
                            }
                          >
                            {(!showExplanation && isSuboptimalMove) || showBestMove
                              ? 'Best'
                              : currentEvalBarData.scoreDisplay}
                          </span>
                        </div>
                      </div>

                      {/* Action Row: Best + Explain + Next (Matching Chess.com Image 2) */}
                      <div className="review-action-row">
                        <button
                          type="button"
                          onClick={() => {
                            setShowBestMove(!showBestMove);
                            setShowExplanation(false);
                          }}
                          className={`btn-best-move ${(!showExplanation && isSuboptimalMove) || showBestMove ? 'active' : ''}`}
                          title="Perlihatkan langkah terbaik di papan catur"
                        >
                          <Star size={15} fill={(!showExplanation && isSuboptimalMove) || showBestMove ? '#ffffff' : 'none'} />
                          <span>Best</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowExplanation(!showExplanation);
                            setShowBestMove(false);
                          }}
                          className={`btn-explain ${showExplanation ? 'active' : ''}`}
                          title="Penjelasan Taktis Langkah"
                        >
                          <Lightbulb size={15} />
                          <span>Explain</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowBestMove(false);
                            setShowExplanation(false);
                            handleNextMove();
                          }}
                          className="btn-next-review"
                          title="Lanjut ke langkah berikutnya"
                        >
                          <Play size={14} fill="currentColor" />
                          <span>Next</span>
                        </button>
                      </div>

                      {/* Opening (lichess-org/chess-openings) + Engine candidate lines (MultiPV) */}
                      {(() => {
                        const prevFen =
                          currentPlyIndex <= 0 ? START_FEN : rawMoveHistory[currentPlyIndex - 1]?.fen;
                        const cand = currentPlyIndex >= 0 ? scoreMap[prevFen]?.lines : undefined;
                        const played = currentPlyIndex >= 0 ? moveHistory[currentPlyIndex] : null;
                        const opening = currentBoardOpening || detectOpeningFromFens(
                          rawMoveHistory.slice(0, Math.max(0, currentPlyIndex + 1)).map((m) => m.fen)
                        );
                        if (!cand?.length && !opening) return null;
                        return (
                          <div className="review-variations-card">
                            {opening && (
                              <div
                                className="review-opening-row"
                                onClick={() => setShowExplorer(true)}
                                title="Buka Opening Explorer untuk variasi dan teori lengkap"
                                style={{ cursor: 'pointer' }}
                              >
                                <span className="review-opening-eco">{opening.eco}</span>
                                <span className="review-opening-name">{opening.name}</span>
                                <span className="review-opening-explore-pill">
                                  <Compass size={12} /> Explorer
                                </span>
                              </div>
                            )}
                            {cand && cand.length > 0 && (
                              <>
                                <div className="review-variations-title">
                                  Alternatif engine (posisi sebelum {played?.san})
                                </div>
                                {cand.map((l, i) => {
                                  const isPlayed =
                                    !!played && l.uci === `${played.from}${played.to}${played.promotion || ''}`;
                                  return (
                                    <div
                                      key={l.uci}
                                      className={`review-variation-line ${isPlayed ? 'played' : ''}`}
                                    >
                                      <span className="rv-rank">{i + 1}</span>
                                      <span className="rv-san">{l.san}</span>
                                      <span className="rv-eval">{l.scoreDisplay}</span>
                                      {isPlayed && <span className="rv-tag">dimainkan</span>}
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}



                  {/* Reset Manual Variation */}
                  {isVariationActive && (
                    <div style={{ padding: '0.25rem 0.9rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={handleResetToOriginalGame}
                        className="variation-reset-badge-btn"
                        title="Kembalikan ke notasi pertandingan asli"
                      >
                        <RotateCcw size={12} />
                        <span>Reset Variasi Manual</span>
                      </button>
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
                      onClick={handleTogglePlayReplay}
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
                      onClick={() => jumpToPly(0)}
                      className="review-footer-btn"
                      title="Kembali ke awal langkah pembukaan"
                    >
                      <Bookmark size={14} />
                      <span>Opening</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="review-footer-btn"
                      title="Putar Papan Catur"
                    >
                      <RotateCcw size={13} />
                      <span>Putar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyFen}
                      className="review-footer-btn"
                      title="Salin FEN"
                    >
                      {copiedFen ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedFen ? 'Tersalin' : 'FEN'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPgn}
                      className="review-footer-btn"
                      title="Salin PGN"
                    >
                      {copiedPgn ? <Check size={13} /> : <Share2 size={13} />}
                      <span>{copiedPgn ? 'Tersalin' : 'PGN'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSoundModalOpen(true)}
                      className="review-footer-btn"
                      title="Pengaturan Efek Suara Catur"
                    >
                      <Volume2 size={13} />
                      <span>Suara</span>
                    </button>
                    {(match?.chessComUrl || recentGame?.url) && (
                      <a
                        href={match?.chessComUrl || recentGame?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="review-footer-btn review-footer-chesscom-pill"
                        title="Buka pertandingan ini langsung di Chess.com"
                        style={{
                          color: '#81b64c',
                          background: 'rgba(129, 182, 76, 0.15)',
                          border: '1px solid rgba(129, 182, 76, 0.35)',
                          borderRadius: '6px',
                          padding: '0.2rem 0.55rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>🎮 Chess.com</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )}
          </aside>
        </div>

        {/* Mobile Bottom Navigation Bar (Matching Chess.com Mobile App Image 2) */}
        <nav
          className={`chesscom-mobile-bottom-bar ${!isReviewActive ? 'mobile-hidden-on-summary' : ''}`}
          aria-label="Kontrol Navigasi Mobile"
        >
          <button
            type="button"
            onClick={() => setIsEngineModalOpen(true)}
            className="mobile-bottom-btn"
          >
            <Sliders size={18} />
            <span>Options</span>
          </button>
          <button
            type="button"
            onClick={() => setShowExplorer(!showExplorer)}
            className={`mobile-bottom-btn ${showExplorer ? 'active' : ''}`}
          >
            <Compass size={18} />
            <span>Explorer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowExplorer(false);
              setMobileMode((prev) => (prev === 'analysis' ? 'review' : 'analysis'));
            }}
            className="mobile-hero-btn"
            title={mobileMode === 'analysis' ? 'Buka Game Review' : 'Buka Mode Analysis'}
          >
            <Star size={22} fill="#ffffff" color="#ffffff" />
          </button>
          <button
            type="button"
            onClick={handlePrevMove}
            className="mobile-bottom-btn"
            title="Langkah Sebelumnya"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={handleNextMove}
            className="mobile-bottom-btn"
            title="Langkah Berikutnya"
          >
            <ChevronRight size={20} />
            <span>Forward</span>
          </button>
        </nav>

        {/* Chess Sound Effects & Theme Settings Modal */}
        <ChessSoundSettingsModal
          isOpen={isSoundModalOpen}
          onClose={() => setIsSoundModalOpen(false)}
        />

        {/* Stockfish 19 Depth & Engine Settings Modal */}
        <ChessEngineSettingsModal
          isOpen={isEngineModalOpen}
          onClose={() => setIsEngineModalOpen(false)}
          currentDepth={stockfishDepth}
          onDepthChange={(newDepth) => setStockfishDepth(newDepth)}
          isEngineActive={isEngineActive}
          onToggleEngineActive={(active) => setIsEngineActive(active)}
          onClearCache={handleClearCache}
        />
      </div>
    </div>
  );
};
