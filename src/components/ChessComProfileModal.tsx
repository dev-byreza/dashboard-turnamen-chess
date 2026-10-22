'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ExternalLink,
  X,
  Trophy,
  Zap,
  Flame,
  Clock,
  ShieldAlert,
  Loader2,
  Calendar,
  Globe,
  Award,
  Swords,
  Sparkles,
  ChevronRight,
  Play,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';
import {
  fetchFullChessComPlayer,
  fetchPlayerRecentGames,
  ChessComPlayerDetails,
  ChessComRecentGame,
  sanitizeChessComUsername,
} from '../utils/chessComApi';
import { SwissMatch, Player } from '../types/chess';

export interface ChessComProfileModalProps {
  isOpen: boolean;
  username: string | null;
  onClose: () => void;
  /** Optional fallback display name (e.g. from local tournament roster) */
  localPlayerName?: string;
  /** Callback when real Chess.com avatar is fetched so parent can save it locally */
  onAvatarSync?: (username: string, avatarUrl: string) => void;
  /** Optional matches involving this player in the Swiss tournament */
  tournamentMatches?: SwissMatch[];
  /** Optional tournament player roster for name/rating lookups */
  tournamentPlayers?: Player[];
  /** Callback to launch Stockfish 19 board analysis modal */
  onAnalyzeMatch?: (data: {
    match?: SwissMatch | null;
    recentGame?: ChessComRecentGame | null;
    whitePlayer?: Player | null;
    blackPlayer?: Player | null;
  }) => void;
}

export const ChessComProfileModal: React.FC<ChessComProfileModalProps> = ({
  isOpen,
  username,
  onClose,
  localPlayerName,
  onAvatarSync,
  tournamentMatches,
  tournamentPlayers,
  onAnalyzeMatch,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ChessComPlayerDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Match list & analysis state
  const [recentGames, setRecentGames] = useState<ChessComRecentGame[]>([]);
  const [loadingGames, setLoadingGames] = useState<boolean>(true);
  const [selectedGameKey, setSelectedGameKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chesscom' | 'tournament'>('chesscom');

  const cleanUser = useMemo(() => {
    return username ? sanitizeChessComUsername(username) : '';
  }, [username]);

  // Find corresponding tournament player
  const currentTournamentPlayer = useMemo(() => {
    if (!cleanUser && !localPlayerName) return null;
    return (
      (tournamentPlayers || []).find(
        (p) =>
          (p.chessComUsername && sanitizeChessComUsername(p.chessComUsername) === cleanUser) ||
          (localPlayerName && p.name.toLowerCase() === localPlayerName.toLowerCase())
      ) || null
    );
  }, [cleanUser, localPlayerName, tournamentPlayers]);

  // Filter tournament matches involving this player
  const playerTournamentMatches = useMemo(() => {
    if (!currentTournamentPlayer) return tournamentMatches || [];
    return (tournamentMatches || []).filter(
      (m) =>
        m.whitePlayerId === currentTournamentPlayer.id ||
        m.blackPlayerId === currentTournamentPlayer.id
    );
  }, [tournamentMatches, currentTournamentPlayer]);

  // Set default tab when matches are available
  useEffect(() => {
    if (playerTournamentMatches.length > 0) {
      setActiveTab('tournament');
    } else {
      setActiveTab('chesscom');
    }
  }, [playerTournamentMatches.length]);

  useEffect(() => {
    if (!isOpen || !username) {
      setData(null);
      setError(null);
      setRecentGames([]);
      setSelectedGameKey(null);
      setLoading(false);
      setLoadingGames(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadingGames(true);
    setError(null);
    setSelectedGameKey(null);

    const user = sanitizeChessComUsername(username);

    // 1. Fetch profile & rating stats
    fetchFullChessComPlayer(user)
      .then((res) => {
        if (!isMounted) return;
        if (!res) {
          setError(`Akun Chess.com "${user}" tidak ditemukan atau berstatus privat.`);
        } else {
          setData(res);
          if (res.profile.avatar && onAvatarSync) {
            onAvatarSync(user, res.profile.avatar);
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Gagal memuat data dari Chess.com. Silakan periksa koneksi internet.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 2. Fetch recent games from Chess.com
    fetchPlayerRecentGames(user, 8)
      .then((games) => {
        if (!isMounted) return;
        setRecentGames(games);
      })
      .catch((err) => {
        console.error('Failed to load player recent games:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingGames(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, username, onAvatarSync]);

  if (!isOpen || !username) return null;

  const profile = data?.profile;
  const stats = data?.stats;

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('id-ID', {
      month: 'short',
      year: 'numeric',
    });
  };

  const formatGameDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const calcWinRate = (record?: { win: number; loss: number; draw: number }) => {
    if (!record) return null;
    const total = record.win + record.loss + record.draw;
    if (total === 0) return '0%';
    const pct = Math.round((record.win / total) * 100);
    return `${pct}%`;
  };

  const getTimeClassIcon = (tc: string) => {
    switch (tc.toLowerCase()) {
      case 'bullet':
        return <Flame size={12} className="time-icon-bullet" />;
      case 'blitz':
        return <Zap size={12} className="time-icon-blitz" />;
      case 'rapid':
        return <Clock size={12} className="time-icon-rapid" />;
      default:
        return <Clock size={12} />;
    }
  };

  const getGameOutcome = (game: ChessComRecentGame) => {
    const isWhite = sanitizeChessComUsername(game.white.username) === cleanUser;
    const userResult = isWhite ? game.white.result : game.black.result;

    if (userResult === 'win') {
      return { text: 'Menang', cls: 'outcome-win' };
    }
    if (
      game.tournamentScore === '0.5-0.5' ||
      userResult === 'agreed' ||
      userResult === 'stalemate' ||
      userResult === 'repetition' ||
      userResult === 'insufficient' ||
      userResult === 'timevsinsufficient'
    ) {
      return { text: 'Remis', cls: 'outcome-draw' };
    }
    return { text: 'Kalah', cls: 'outcome-loss' };
  };

  const getTournamentOutcome = (match: SwissMatch) => {
    if (!match.result) {
      return { text: 'Belum Main', cls: 'outcome-pending' };
    }
    if (match.result === '0.5-0.5') {
      return { text: 'Remis', cls: 'outcome-draw' };
    }
    const isWhite = match.whitePlayerId === currentTournamentPlayer?.id;
    const isWin = isWhite ? match.result === '1-0' : match.result === '0-1';
    return isWin
      ? { text: 'Menang', cls: 'outcome-win' }
      : { text: 'Kalah', cls: 'outcome-loss' };
  };

  const handleAnalyzeRecentGame = (game: ChessComRecentGame) => {
    if (!onAnalyzeMatch) return;
    onAnalyzeMatch({
      match: null,
      recentGame: game,
      whitePlayer: {
        id: `cc_${game.white.username}`,
        name: game.white.username,
        seed: 0,
        rating: game.white.rating,
        chessComUsername: game.white.username,
      },
      blackPlayer: {
        id: `cc_${game.black.username}`,
        name: game.black.username,
        seed: 0,
        rating: game.black.rating,
        chessComUsername: game.black.username,
      },
    });
    onClose();
  };

  const handleAnalyzeTournamentMatch = (match: SwissMatch) => {
    if (!onAnalyzeMatch) return;
    const whitePlayer = tournamentPlayers?.find((p) => p.id === match.whitePlayerId) || null;
    const blackPlayer = tournamentPlayers?.find((p) => p.id === match.blackPlayerId) || null;

    // Check if we have an online game in recentGames between these two players if match has no PGN
    let matchingRecent: ChessComRecentGame | null = null;
    if (
      !match.chessComPgn &&
      recentGames.length > 0 &&
      whitePlayer?.chessComUsername &&
      blackPlayer?.chessComUsername
    ) {
      const w = sanitizeChessComUsername(whitePlayer.chessComUsername);
      const b = sanitizeChessComUsername(blackPlayer.chessComUsername);
      matchingRecent =
        recentGames.find((g) => {
          const gw = sanitizeChessComUsername(g.white.username);
          const gb = sanitizeChessComUsername(g.black.username);
          return (gw === w && gb === b) || (gw === b && gb === w);
        }) || null;
    }

    onAnalyzeMatch({
      match,
      recentGame: matchingRecent,
      whitePlayer,
      blackPlayer,
    });
    onClose();
  };

  return (
    <div className="chesscom-modal-backdrop" onClick={onClose}>
      <div
        className="chesscom-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="chesscom-modal-header">
          <div className="chesscom-brand-tag">
            <span className="chesscom-pawn-icon">♟</span>
            <span>CHESS.COM VERIFIED PROFILE</span>
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

        {/* Body */}
        <div className="chesscom-modal-body">
          {loading ? (
            <div className="chesscom-loading-state">
              <Loader2 size={36} className="chesscom-spinner" />
              <p>Menghubungkan ke server Chess.com...</p>
              <span>Mengambil rating & statistik akun @{username}</span>
            </div>
          ) : error ? (
            <div className="chesscom-error-state">
              <ShieldAlert size={40} className="chesscom-error-icon" />
              <h4>Pemain Tidak Ditemukan</h4>
              <p>{error}</p>
              <a
                href={`https://www.chess.com/member/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="chesscom-action-btn primary"
              >
                Cari Manual di Chess.com <ExternalLink size={14} />
              </a>
            </div>
          ) : profile && stats ? (
            <>
              {/* Profile Bar */}
              <div className="chesscom-profile-card">
                <div className="chesscom-avatar-wrap">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.username}
                      referrerPolicy="no-referrer"
                      className="chesscom-avatar-img"
                    />
                  ) : (
                    <div className="chesscom-avatar-placeholder">
                      {profile.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {profile.title && (
                    <span className="chesscom-title-badge">{profile.title}</span>
                  )}
                </div>

                <div className="chesscom-profile-meta">
                  <div className="chesscom-name-row">
                    <h3 className="chesscom-name-heading">
                      {profile.name || localPlayerName || profile.username}
                    </h3>
                  </div>
                  <div className="chesscom-username-sub">
                    <span>@{profile.username}</span>
                    {profile.countryCode && (
                      <span className="chesscom-country-badge">
                        <Globe size={11} /> {profile.countryCode}
                      </span>
                    )}
                    {profile.joined && (
                      <span className="chesscom-joined-badge">
                        <Calendar size={11} /> Sejak {formatDate(profile.joined)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="chesscom-stats-section">
                <h4 className="chesscom-stats-title">
                  <Award size={15} style={{ color: 'var(--gold)' }} />
                  Rating Resmi Chess.com
                </h4>

                <div className="chesscom-stats-grid">
                  {/* Rapid */}
                  <div className="chesscom-rating-card rapid">
                    <div className="rating-card-top">
                      <div className="rating-type">
                        <Clock size={16} />
                        <span>Rapid</span>
                      </div>
                      <span className="rating-number">
                        {stats.rapid?.rating || '-'}
                      </span>
                    </div>
                    {stats.rapid?.record && (
                      <div className="rating-record-row">
                        <span className="rec-win">{stats.rapid.record.win}M</span>
                        <span className="rec-draw">{stats.rapid.record.draw}R</span>
                        <span className="rec-loss">{stats.rapid.record.loss}K</span>
                        <span className="rec-rate">
                          Win {calcWinRate(stats.rapid.record)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Blitz */}
                  <div className="chesscom-rating-card blitz">
                    <div className="rating-card-top">
                      <div className="rating-type">
                        <Zap size={16} />
                        <span>Blitz</span>
                      </div>
                      <span className="rating-number">
                        {stats.blitz?.rating || '-'}
                      </span>
                    </div>
                    {stats.blitz?.record && (
                      <div className="rating-record-row">
                        <span className="rec-win">{stats.blitz.record.win}M</span>
                        <span className="rec-draw">{stats.blitz.record.draw}R</span>
                        <span className="rec-loss">{stats.blitz.record.loss}K</span>
                        <span className="rec-rate">
                          Win {calcWinRate(stats.blitz.record)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bullet */}
                  <div className="chesscom-rating-card bullet">
                    <div className="rating-card-top">
                      <div className="rating-type">
                        <Flame size={16} />
                        <span>Bullet</span>
                      </div>
                      <span className="rating-number">
                        {stats.bullet?.rating || '-'}
                      </span>
                    </div>
                    {stats.bullet?.record && (
                      <div className="rating-record-row">
                        <span className="rec-win">{stats.bullet.record.win}M</span>
                        <span className="rec-draw">{stats.bullet.record.draw}R</span>
                        <span className="rec-loss">{stats.bullet.record.loss}K</span>
                        <span className="rec-rate">
                          Win {calcWinRate(stats.bullet.record)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Match Analysis Section (NEW) */}
              <div className="chesscom-matches-section">
                <div className="chesscom-matches-header">
                  <div className="matches-header-left">
                    <Swords size={16} className="matches-header-icon" />
                    <span className="matches-header-title">Analisis Pertandingan</span>
                    <span className="matches-engine-pill">
                      <Sparkles size={11} /> Stockfish 19
                    </span>
                  </div>

                  {/* Tab Selector if both types of matches exist */}
                  {playerTournamentMatches.length > 0 && (
                    <div className="matches-tab-selector">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('tournament');
                          setSelectedGameKey(null);
                        }}
                        className={`matches-tab-btn ${activeTab === 'tournament' ? 'active' : ''}`}
                      >
                        <Trophy size={12} />
                        <span>Turnamen ({playerTournamentMatches.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('chesscom');
                          setSelectedGameKey(null);
                        }}
                        className={`matches-tab-btn ${activeTab === 'chesscom' ? 'active' : ''}`}
                      >
                        <span>Chess.com ({recentGames.length})</span>
                      </button>
                    </div>
                  )}
                </div>

                <p className="matches-instruction-text">
                  Pilih pertandingan untuk ditinjau akurasi langkah, evaluasi grafik, dan coach review:
                </p>

                {/* Match List */}
                <div className="chesscom-match-list-scroll">
                  {activeTab === 'tournament' ? (
                    playerTournamentMatches.length === 0 ? (
                      <div className="matches-empty-box">
                        <CircleAlert size={20} />
                        <span>Belum ada jadwal pertandingan turnamen untuk pemain ini.</span>
                      </div>
                    ) : (
                      playerTournamentMatches.map((m) => {
                        const wp = tournamentPlayers?.find((p) => p.id === m.whitePlayerId);
                        const bp = tournamentPlayers?.find((p) => p.id === m.blackPlayerId);
                        const outcome = getTournamentOutcome(m);
                        const isSelected = selectedGameKey === m.id;

                        return (
                          <div
                            key={m.id}
                            className={`profile-match-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedGameKey(m.id)}
                          >
                            <div className="match-card-meta">
                              <div className="meta-left">
                                <span className="time-pill tournament">
                                  <Trophy size={11} /> Babak {m.round}
                                </span>
                                {m.chessComUrl && (
                                  <span className="synced-pill" title="Terhubung dengan game Chess.com">
                                    ♟ Game Terhubung
                                  </span>
                                )}
                              </div>
                              <span className={`outcome-badge ${outcome.cls}`}>
                                {outcome.text}
                              </span>
                            </div>

                            <div className="match-card-players">
                              {/* White */}
                              <div
                                className={`player-box ${
                                  wp?.id === currentTournamentPlayer?.id ? 'current' : ''
                                }`}
                              >
                                <span className="piece-icon">♟</span>
                                <span className="player-name">{wp?.name || 'Putih'}</span>
                                <span className="player-rating">({wp?.rating || 500})</span>
                              </div>

                              <div className="match-center-score">
                                <span className="score-val">{m.result || 'VS'}</span>
                              </div>

                              {/* Black */}
                              <div
                                className={`player-box ${
                                  bp?.id === currentTournamentPlayer?.id ? 'current' : ''
                                }`}
                              >
                                <span className="piece-icon">♙</span>
                                <span className="player-name">{bp?.name || 'Hitam'}</span>
                                <span className="player-rating">({bp?.rating || 500})</span>
                              </div>
                            </div>

                            <div className="match-card-actions">
                              <button
                                type="button"
                                className="btn-card-analyze"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAnalyzeTournamentMatch(m);
                                }}
                                title="Buka analisis Stockfish 19 & Game Review"
                              >
                                <Sparkles size={13} />
                                <span>Analisa Pertandingan</span>
                              </button>
                              {m.chessComUrl && (
                                <a
                                  href={m.chessComUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-card-external"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Buka di Chess.com"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : loadingGames ? (
                    <div className="matches-loading-box">
                      <Loader2 size={24} className="chesscom-spinner" />
                      <span>Mengambil riwayat game online @{cleanUser}...</span>
                    </div>
                  ) : recentGames.length === 0 ? (
                    <div className="matches-empty-box">
                      <CircleAlert size={20} />
                      <span>Tidak ada riwayat pertandingan online yang ditemukan.</span>
                    </div>
                  ) : (
                    recentGames.map((game, idx) => {
                      const gameKey = game.url || `game_${idx}_${game.endTime}`;
                      const outcome = getGameOutcome(game);
                      const isSelected = selectedGameKey === gameKey;
                      const isCurrentUserWhite =
                        sanitizeChessComUsername(game.white.username) === cleanUser;

                      return (
                        <div
                          key={gameKey}
                          className={`profile-match-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedGameKey(gameKey)}
                        >
                          <div className="match-card-meta">
                            <div className="meta-left">
                              <span className={`time-pill ${game.timeClass}`}>
                                {getTimeClassIcon(game.timeClass)}
                                <span>
                                  {game.timeClass.toUpperCase()} {game.timeControl}
                                </span>
                              </span>
                              <span className="game-date">{formatGameDate(game.endTime)}</span>
                            </div>
                            <span className={`outcome-badge ${outcome.cls}`}>
                              {outcome.text}
                            </span>
                          </div>

                          <div className="match-card-players">
                            {/* White */}
                            <div className={`player-box ${isCurrentUserWhite ? 'current' : ''}`}>
                              <span className="piece-icon">♟</span>
                              <span className="player-name">{game.white.username}</span>
                              <span className="player-rating">({game.white.rating})</span>
                            </div>

                            <div className="match-center-score">
                              <span className="score-val">{game.tournamentScore}</span>
                            </div>

                            {/* Black */}
                            <div className={`player-box ${!isCurrentUserWhite ? 'current' : ''}`}>
                              <span className="piece-icon">♙</span>
                              <span className="player-name">{game.black.username}</span>
                              <span className="player-rating">({game.black.rating})</span>
                            </div>
                          </div>

                          {game.termination && (
                            <div className="match-termination-row">
                              <span>{game.termination}</span>
                            </div>
                          )}

                          <div className="match-card-actions">
                            <button
                              type="button"
                              className="btn-card-analyze"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyzeRecentGame(game);
                              }}
                              title="Buka analisis Stockfish 19 & Game Review"
                            >
                              <Sparkles size={13} />
                              <span>Analisa Pertandingan</span>
                            </button>
                            {game.url && (
                              <a
                                href={game.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-card-external"
                                onClick={(e) => e.stopPropagation()}
                                title="Buka di Chess.com"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Action if a match is selected */}
                {selectedGameKey && onAnalyzeMatch && (
                  <div className="selected-match-action-bar">
                    <button
                      type="button"
                      className="btn-launch-selected-analysis"
                      onClick={() => {
                        if (activeTab === 'tournament') {
                          const m = playerTournamentMatches.find((x) => x.id === selectedGameKey);
                          if (m) handleAnalyzeTournamentMatch(m);
                        } else {
                          const g = recentGames.find(
                            (x, idx) => (x.url || `game_${idx}_${x.endTime}`) === selectedGameKey
                          );
                          if (g) handleAnalyzeRecentGame(g);
                        }
                      }}
                    >
                      <Sparkles size={16} />
                      <span>Mulai Analisis Match Terpilih</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Footer action */}
              <div className="chesscom-modal-footer">
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chesscom-action-btn primary"
                >
                  Buka Profil di Chess.com <ExternalLink size={14} />
                </a>
                <button onClick={onClose} className="chesscom-action-btn secondary">
                  Tutup
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
