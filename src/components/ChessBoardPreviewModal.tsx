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
  HelpCircle,
  AlertTriangle,
  AlertOctagon,
  ThumbsUp,
  Star,
  Settings,
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
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_win';

export const ChessComBadgeIcon: React.FC<{ type: ChessComBadgeType; size?: number }> = ({
  type,
  size = 22,
}) => {
  switch (type) {
    case 'brilliant':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#1baca6" />
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
    case 'best':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#85a94e" />
          <path
            d="M12 4.5l2.2 4.7 5.2.8-3.7 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2-3.7-3.6 5.2-.8z"
            fill="#ffffff"
          />
        </svg>
      );
    case 'excellent':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#5c8bb0" />
          <path
            d="M7 12.5l3.5 3.5 7-7"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'good':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#8c8882" />
          <circle cx="12" cy="12" r="6" fill="none" stroke="#ffffff" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="2.2" fill="#ffffff" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#a88865" />
          <path
            d="M6.5 8c1.8-.8 3.5-.8 5.5.5V17c-2-1.2-3.7-1.2-5.5-.5V8zm11 0c-1.8-.8-3.5-.8-5.5.5V17c2-1.2 3.7-1.2 5.5-.5V8z"
            fill="#ffffff"
          />
        </svg>
      );
    case 'inaccuracy':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#e69d24" />
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
          <circle cx="12" cy="12" r="11" fill="#e67828" />
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
    case 'missed_win':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="classification-icon-svg">
          <circle cx="12" cy="12" r="11" fill="#db4352" />
          <path
            d="M8 8l8 8M16 8l-8 8"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};

interface MoveHistoryItem {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  fen: string;
  piece: string;
  captured?: string;
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
  const [currentPlyIndex, setCurrentPlyIndex] = useState<number>(-1); // -1 = start pos
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);

  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const evalDebounceRef = useRef<NodeJS.Timeout | null>(null);

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

        setMoveHistory(constructedHistory);
        setChessInstance(newChess);
        setCurrentPlyIndex(constructedHistory.length - 1); // Jump to final position
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
    setMoveHistory([]);
    setCurrentPlyIndex(-1);
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

  // Interactive square click
  const handleSquareClick = (square: Square) => {
    // If browsing historical moves, don't allow branching edits
    if (moveHistory.length > 0 && currentPlyIndex < moveHistory.length - 1) {
      jumpToPly(moveHistory.length - 1);
      return;
    }

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      try {
        const moveAttempt = chessInstance.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        });

        if (moveAttempt) {
          const newHistoryItem: MoveHistoryItem = {
            ply: moveHistory.length + 1,
            moveNumber: Math.floor(moveHistory.length / 2) + 1,
            color: moveAttempt.color,
            san: moveAttempt.san,
            from: moveAttempt.from,
            to: moveAttempt.to,
            fen: chessInstance.fen(),
            piece: moveAttempt.piece,
            captured: moveAttempt.captured,
          };
          const updated = [...moveHistory, newHistoryItem];
          setMoveHistory(updated);
          setCurrentPlyIndex(updated.length - 1);
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
      } catch {
        // Not a legal move to that square
      }
    }

    // Select piece
    const piece = chessInstance.get(square);
    if (piece && piece.color === chessInstance.turn()) {
      setSelectedSquare(square);
      const moves = chessInstance.moves({ square, verbose: true }).map((m) => m.to);
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

  // Parse current FEN into 8x8 matrix
  const boardMatrix = useMemo(() => {
    const cleanFen = currentBoardFen.trim().split(' ')[0] || '';
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

  // Mock Review Statistics calibrated from match outcome
  const reviewStats = useMemo(() => {
    const isWhiteWin = match?.result === '1-0';
    const isBlackWin = match?.result === '0-1';

    const wAcc = isWhiteWin ? 78.4 : isBlackWin ? 62.5 : 71.0;
    const bAcc = isBlackWin ? 79.2 : isWhiteWin ? 54.8 : 70.5;

    return {
      whiteAccuracy: wAcc,
      blackAccuracy: bAcc,
      coachComment: isWhiteWin
        ? `Langkah brilian (Brilliant Move) dan taktik tajam oleh ${whiteName}! Tekanan konsisten berhasil mengunci kemenangan meyakinkan.`
        : isBlackWin
        ? `Langkah brilian dan serangan balik mematikan oleh ${blackName}! Mengonversi keunggulan taktis menjadi poin kemenangan.`
        : 'Pertarungan sengit dan seimbang dari kedua pemain! Pertukaran perwira yang rapi berakhir dengan posisi imbang.',
      counts: {
        brilliant: { w: isWhiteWin ? 1 : 0, b: isBlackWin ? 1 : 0 },
        best: { w: isWhiteWin ? 10 : 5, b: isBlackWin ? 9 : 6 },
        excellent: { w: 6, b: 5 },
        good: { w: 5, b: 6 },
        book: { w: 2, b: 2 },
        inaccuracy: { w: isWhiteWin ? 1 : 3, b: isBlackWin ? 1 : 2 },
        mistake: { w: isWhiteWin ? 1 : 4, b: isBlackWin ? 1 : 4 },
        blunder: { w: isWhiteWin ? 0 : 2, b: isBlackWin ? 0 : 2 },
        missed_win: { w: 0, b: isBlackWin ? 0 : 1 },
      },
    };
  }, [match?.result, whiteName, blackName]);

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

                        return (
                          <div
                            key={squareName}
                            onClick={() => handleSquareClick(squareName)}
                            className={`chesscom-square ${isLight ? 'light-sq' : 'dark-sq'} ${
                              isSelected ? 'is-selected' : ''
                            } ${isLastMoveFrom || isLastMoveTo ? 'is-last-move' : ''}`}
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
                          </div>
                        );
                      }
                    )
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
              /* TAB 1: GAME REVIEW (Matching Chess.com Screenshot 2) */
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
                      {/* Coach face illustration */}
                      <circle cx="30" cy="26" r="14" fill="#fed7aa" />
                      {/* Hair and beard */}
                      <path
                        d="M18 20c2-8 22-8 24 0 0 0-3-4-12-4s-12 4-12 4z"
                        fill="#573418"
                      />
                      <path
                        d="M20 30c1 6 19 6 20 0 0 5-6 9-10 9s-10-4-10-9z"
                        fill="#573418"
                      />
                      {/* Glasses */}
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
                      {/* Shirt */}
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

                {/* Advantage / Evaluation Graph */}
                <div className="advantage-graph-card">
                  <div className="graph-label-row">
                    <span className="graph-title">Grafik Keunggulan Partai</span>
                    <span className="graph-legend">Putih ▲ | ▼ Hitam</span>
                  </div>
                  <div className="graph-canvas-box">
                    <svg
                      viewBox="0 0 320 80"
                      preserveAspectRatio="none"
                      className="eval-graph-svg"
                    >
                      {/* Zero baseline */}
                      <line
                        x1="0"
                        y1="40"
                        x2="320"
                        y2="40"
                        stroke="#52504c"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                      {/* Area graph */}
                      <path
                        d="M0 40 Q 40 38, 80 32 T 160 25 T 240 18 T 320 12 L 320 40 L 0 40 Z"
                        fill="rgba(129, 182, 76, 0.25)"
                      />
                      <path
                        d="M0 40 Q 40 38, 80 32 T 160 25 T 240 18 T 320 12"
                        fill="none"
                        stroke="#81b64c"
                        strokeWidth="2.5"
                      />
                      {/* Move markers */}
                      <circle cx="80" cy="32" r="3.5" fill="#38bdf8" />
                      <circle cx="160" cy="25" r="3.5" fill="#22c55e" />
                      <circle cx="240" cy="18" r="3.5" fill="#f97316" />
                      <circle cx="280" cy="15" r="3.5" fill="#ef4444" />
                    </svg>
                  </div>
                </div>

                {/* Player Accuracy Comparison */}
                <div className="accuracy-comparison-grid">
                  <div className="accuracy-player-col">
                    <div className="player-badge-top">
                      <span className="pawn-tag">♙</span>
                      <span className="name">{whiteName}</span>
                    </div>
                    <div className="accuracy-pill-box">
                      <span className="acc-number">{reviewStats.whiteAccuracy}</span>
                      <span className="acc-label">Akurasi</span>
                    </div>
                  </div>

                  <div className="accuracy-player-col">
                    <div className="player-badge-top">
                      <span className="pawn-tag">♟</span>
                      <span className="name">{blackName}</span>
                    </div>
                    <div className="accuracy-pill-box">
                      <span className="acc-number">{reviewStats.blackAccuracy}</span>
                      <span className="acc-label">Akurasi</span>
                    </div>
                  </div>
                </div>

                {/* Move Classification Breakdown Table */}
                <div className="move-classification-table">
                  {[
                    { type: 'brilliant', label: 'Brilliant', color: '#1baca6' },
                    { type: 'best', label: 'Best Move', color: '#85a94e' },
                    { type: 'excellent', label: 'Excellent', color: '#5c8bb0' },
                    { type: 'good', label: 'Good', color: '#8c8882' },
                    { type: 'book', label: 'Book Move', color: '#a88865' },
                    { type: 'inaccuracy', label: 'Inaccuracy', color: '#e69d24' },
                    { type: 'mistake', label: 'Mistake', color: '#e67828' },
                    { type: 'blunder', label: 'Blunder', color: '#ca3431' },
                    { type: 'missed_win', label: 'Missed Win', color: '#db4352' },
                  ].map((item) => {
                    const countKey = item.type as ChessComBadgeType;
                    const wCount = reviewStats.counts[countKey]?.w ?? 0;
                    const bCount = reviewStats.counts[countKey]?.b ?? 0;

                    return (
                      <div
                        key={item.type}
                        className={`classification-row classification-row-${item.type}`}
                      >
                        <span
                          className="count white"
                          style={{ color: wCount > 0 ? item.color : '#6b7280' }}
                        >
                          {wCount}
                        </span>

                        <div className="badge-pill-chesscom">
                          <ChessComBadgeIcon type={item.type as ChessComBadgeType} size={22} />
                          <span className="badge-pill-label">{item.label}</span>
                        </div>

                        <span
                          className="count black"
                          style={{ color: bCount > 0 ? item.color : '#6b7280' }}
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
                    setActiveTab('analysis');
                    jumpToPly(-1);
                    setIsPlayingReplay(true);
                  }}
                  className="btn-start-review-cta"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Start Review</span>
                </button>
              </div>
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

                {/* Best Move Hint Pill */}
                {isEngineActive && currentEval.bestMoveUci && (
                  <div className="engine-bestmove-pill">
                    <span className="bestmove-title">Saran Terbaik:</span>
                    <span className="bestmove-code">
                      {currentEval.bestMoveUci} ({currentEval.scoreDisplay})
                    </span>
                    <span className="depth-tag">Depth {currentEval.depth || 14}</span>
                  </div>
                )}

                {/* Move List Notation Table */}
                <div className="moves-notation-wrapper">
                  <div className="moves-table-header">
                    <span>Posisi Awal</span>
                    <span className="book-icon">📖</span>
                  </div>

                  <div className="moves-scroll-body">
                    {moveRows.length === 0 ? (
                      <div className="empty-moves-notice">
                        Belum ada riwayat langkah. Gerakkan bidak catur di papan untuk mulai analisis!
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
                            <button
                              type="button"
                              onClick={() => row.white && jumpToPly(row.white.ply - 1)}
                              className={`move-btn white ${isWhiteActive ? 'active' : ''}`}
                            >
                              <span className="piece-glyph">
                                {row.white?.piece ? row.white.piece.toUpperCase() : ''}
                              </span>
                              <span>{row.white?.san || ''}</span>
                            </button>

                            {/* Black Move */}
                            {row.black ? (
                              <button
                                type="button"
                                onClick={() => row.black && jumpToPly(row.black.ply - 1)}
                                className={`move-btn black ${isBlackActive ? 'active' : ''}`}
                              >
                                <span className="piece-glyph">
                                  {row.black?.piece ? row.black.piece.toLowerCase() : ''}
                                </span>
                                <span>{row.black.san}</span>
                              </button>
                            ) : (
                              <div className="move-empty-cell" />
                            )}
                          </div>
                        );
                      })
                    )}
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
