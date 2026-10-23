'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Search,
  User,
  Clock,
  Zap,
  Flame,
  ExternalLink,
  X,
  Loader2,
  RotateCcw,
  FileText,
  AlertCircle,
  Trophy,
  History,
} from 'lucide-react';
import { ChessBoardPreviewModal } from '@/components/ChessBoardPreviewModal';
import {
  ChessComRecentGame,
  sanitizeChessComUsername,
  fetchPlayerRecentGames,
} from '@/utils/chessComApi';
import { getCachedTournamentStore } from '@/utils/tournamentStoreCache';
import { Player } from '@/types/chess';

export default function StandaloneAnalysisPage() {
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [activeUsername, setActiveUsername] = useState<string>('');
  const [games, setGames] = useState<ChessComRecentGame[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Picker Modal State (Default open when visiting /analisis)
  const [isPickerModalOpen, setIsPickerModalOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'chesscom' | 'pgn'>('chesscom');
  const [customPgnInput, setCustomPgnInput] = useState<string>('');

  // Selected game for ChessBoardPreviewModal
  const [selectedGame, setSelectedGame] = useState<ChessComRecentGame | null>(null);

  // Recent searches saved in localStorage
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Tournament roster players for quick suggestions
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);

  // Load cached tournament roster & saved usernames on mount
  useEffect(() => {
    try {
      const savedSearches = localStorage.getItem('chess_recent_analysis_users');
      if (savedSearches) {
        const parsed = JSON.parse(savedSearches);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 6));
        }
      }
    } catch {}

    const cachedStore = getCachedTournamentStore();
    if (cachedStore && cachedStore.roster) {
      setRosterPlayers(cachedStore.roster.filter((p) => Boolean(p.chessComUsername)));
    } else {
      fetch('/api/tournament')
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data?.store?.roster) {
            setRosterPlayers(
              data.store.roster.filter((p: Player) => Boolean(p.chessComUsername))
            );
          }
        })
        .catch(() => {});
    }
  }, []);

  // Save recent search
  const saveRecentSearch = (user: string) => {
    const clean = sanitizeChessComUsername(user);
    if (!clean) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((u) => u.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('chess_recent_analysis_users', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Fetch games for username
  const handleFetchGames = useCallback(
    async (targetUser?: string) => {
      const rawUser = targetUser !== undefined ? targetUser : usernameInput;
      const clean = sanitizeChessComUsername(rawUser);
      if (!clean) {
        setErrorMsg('Silakan masukkan username Chess.com.');
        return;
      }

      setErrorMsg(null);
      setIsLoadingGames(true);
      setActiveUsername(clean);
      saveRecentSearch(clean);

      try {
        // 1. Try server-side API route first (avoids CORS & has proper User-Agent)
        const res = await fetch(
          `/api/chesscom-games?username=${encodeURIComponent(clean)}&limit=16`
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.games)) {
            setGames(json.games);
            if (json.games.length === 0) {
              setErrorMsg(
                `Tidak ada riwayat permainan online yang ditemukan untuk @${clean} dalam 2 bulan terakhir.`
              );
            }
            return;
          }
        }

        // 2. Fallback to client-side fetch directly if API is unavailable
        const clientGames = await fetchPlayerRecentGames(clean, 16);
        setGames(clientGames);
        if (clientGames.length === 0) {
          setErrorMsg(
            `Tidak ada riwayat permainan online yang ditemukan untuk @${clean} dalam 2 bulan terakhir.`
          );
        }
      } catch (err: any) {
        console.error('Failed to fetch Chess.com games:', err);
        setErrorMsg(
          'Gagal mengambil riwayat dari Chess.com. Periksa koneksi internet atau nama akun.'
        );
      } finally {
        setIsLoadingGames(false);
      }
    },
    [usernameInput]
  );

  // Handle selecting a game to analyze
  const handleSelectGame = (game: ChessComRecentGame) => {
    setSelectedGame(game);
    setIsPickerModalOpen(false);
  };

  // Handle custom PGN submission
  const handleAnalyzeCustomPgn = () => {
    const trimmed = customPgnInput.trim();
    if (!trimmed) {
      setErrorMsg('Silakan tempel teks PGN catur terlebih dahulu.');
      return;
    }

    const mockGame: ChessComRecentGame = {
      url: '',
      pgn: trimmed,
      timeClass: 'rapid',
      timeControl: 'Analisis PGN',
      endTime: Math.floor(Date.now() / 1000),
      white: {
        username: 'Putih (PGN)',
        rating: 1500,
        result: '',
      },
      black: {
        username: 'Hitam (PGN)',
        rating: 1500,
        result: '',
      },
      tournamentScore: '1-0',
      matchedWhiteUser: 'Putih',
      matchedBlackUser: 'Hitam',
    };

    setSelectedGame(mockGame);
    setIsPickerModalOpen(false);
  };

  // Format date helper
  const formatGameDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Time class icon helper
  const getTimeClassIcon = (tc: string) => {
    switch (tc.toLowerCase()) {
      case 'bullet':
        return <Flame size={12} style={{ color: '#ef4444' }} />;
      case 'blitz':
        return <Zap size={12} style={{ color: '#eab308' }} />;
      case 'rapid':
        return <Clock size={12} style={{ color: '#22c55e' }} />;
      default:
        return <Clock size={12} />;
    }
  };

  // Outcome text & badge helper
  const getGameOutcome = (game: ChessComRecentGame, currentUser: string) => {
    const isWhite = sanitizeChessComUsername(game.white.username) === currentUser;
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

  return (
    <div className="standalone-analysis-container">
      {/* Top Navbar */}
      <header className="standalone-analysis-navbar">
        <div className="standalone-nav-brand">
          <Link
            href="/"
            className="standalone-nav-btn"
            title="Kembali ke Dashboard Utama Turnamen"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </Link>
          <div className="standalone-nav-logo">
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="standalone-nav-title">Analisis Mandiri</span>
              <span className="standalone-nav-badge">Stockfish 19</span>
            </div>
          </div>
        </div>

        <div className="standalone-nav-actions">
          <button
            type="button"
            onClick={() => setIsPickerModalOpen(true)}
            className="standalone-nav-btn primary"
            title="Buka jendela pemilihan riwayat game Chess.com"
          >
            <Search size={14} />
            <span>{selectedGame ? 'Ganti Game' : 'Pilih Game'}</span>
          </button>
        </div>
      </header>

      {/* Main Background View when modal is closed or game is selected */}
      <main className="standalone-hero-section">
        <div className="standalone-hero-badge">
          <Sparkles size={14} />
          <span>Chess.com Game Review Engine</span>
        </div>

        <h1 className="standalone-hero-title">
          Analisis Catur Mendalam & Mandiri
        </h1>

        <p className="standalone-hero-desc">
          Evaluasi setiap langkah catur dengan Stockfish 19 Lite langsung di browser Anda. Dapatkan
          akurasi langkah, deteksi blunder, pergerakan Great & Brilliant, serta saran taktik dari
          AI Coach.
        </p>

        {selectedGame ? (
          <div className="standalone-hero-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`time-pill ${selectedGame.timeClass}`}>
                  {getTimeClassIcon(selectedGame.timeClass)}
                  <span>
                    {selectedGame.timeClass.toUpperCase()} {selectedGame.timeControl}
                  </span>
                </span>
                <span className="game-date">{formatGameDate(selectedGame.endTime)}</span>
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  color: '#81b64c',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                ● Game Sedang Ditinjau
              </span>
            </div>

            <div className="standalone-game-players-grid" style={{ marginBottom: '1.2rem' }}>
              <div className="standalone-player-tag">
                <span style={{ fontSize: '1.1rem' }}>♟</span>
                <div>
                  <div className="standalone-player-name">{selectedGame.white.username}</div>
                  <div className="standalone-player-rating">Rating {selectedGame.white.rating}</div>
                </div>
              </div>

              <div className="standalone-game-score-badge">{selectedGame.tournamentScore}</div>

              <div className="standalone-player-tag" style={{ justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="standalone-player-name">{selectedGame.black.username}</div>
                  <div className="standalone-player-rating">Rating {selectedGame.black.rating}</div>
                </div>
                <span style={{ fontSize: '1.1rem' }}>♙</span>
              </div>
            </div>

            {selectedGame.termination && (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#9ca3af',
                  marginBottom: '1.2rem',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                }}
              >
                {selectedGame.termination}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="standalone-btn-analyze"
                onClick={() => {
                  // Re-trigger board preview
                  const current = selectedGame;
                  setSelectedGame(null);
                  setTimeout(() => setSelectedGame(current), 50);
                }}
                style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem' }}
              >
                <Sparkles size={16} />
                <span>Buka Papan Analisis Catur</span>
              </button>

              <button
                type="button"
                className="standalone-nav-btn"
                onClick={() => setIsPickerModalOpen(true)}
              >
                <RotateCcw size={15} />
                <span>Pilih Permainan Lain</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <button
              type="button"
              className="standalone-search-submit"
              onClick={() => setIsPickerModalOpen(true)}
              style={{ fontSize: '1rem', padding: '0.9rem 2rem' }}
            >
              <Search size={18} />
              <span>Masukkan Username Chess.com</span>
            </button>
          </div>
        )}
      </main>

      {/* Jendela Baru: Modal Pemilihan Username & History Permainan */}
      {isPickerModalOpen && (
        <div className="standalone-modal-overlay" onClick={() => selectedGame && setIsPickerModalOpen(false)}>
          <div
            className="standalone-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="standalone-modal-header">
              <div className="standalone-modal-title-group">
                <div className="standalone-modal-icon-badge">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="standalone-modal-title">Pilih Permainan untuk Analisis</h2>
                  <p className="standalone-modal-subtitle">
                    Masukkan akun Chess.com untuk memuat riwayat game online Anda.
                  </p>
                </div>
              </div>

              {selectedGame && (
                <button
                  type="button"
                  className="standalone-modal-close-btn"
                  onClick={() => setIsPickerModalOpen(false)}
                  title="Tutup jendela dan kembali ke papan"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="standalone-modal-body">
              {/* Tabs: Akun Chess.com vs Tempel PGN */}
              <div className="standalone-picker-tabs">
                <button
                  type="button"
                  className={`standalone-picker-tab ${activeTab === 'chesscom' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chesscom')}
                >
                  <User size={14} />
                  <span>Cari Akun Chess.com</span>
                </button>
                <button
                  type="button"
                  className={`standalone-picker-tab ${activeTab === 'pgn' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pgn')}
                >
                  <FileText size={14} />
                  <span>Tempel PGN Manual</span>
                </button>
              </div>

              {activeTab === 'chesscom' ? (
                <>
                  {/* Search Form */}
                  <form
                    className="standalone-search-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleFetchGames();
                    }}
                  >
                    <div className="standalone-search-input-wrapper">
                      <Search size={16} className="standalone-search-input-icon" />
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        placeholder="Ketik username Chess.com (cth: Hikaru, devbyreza)..."
                        className="standalone-search-input"
                        autoFocus
                      />
                      {usernameInput && (
                        <button
                          type="button"
                          className="standalone-search-clear"
                          onClick={() => setUsernameInput('')}
                          title="Hapus"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoadingGames || !usernameInput.trim()}
                      className="standalone-search-submit"
                    >
                      {isLoadingGames ? (
                        <>
                          <Loader2 size={16} className="chesscom-spinner" />
                          <span>Memuat...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>Cari Riwayat</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Suggestion Chips: Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="standalone-chips-row">
                      <span className="standalone-chips-label">
                        <History size={11} style={{ display: 'inline', marginRight: 3 }} />
                        Terakhir dicari:
                      </span>
                      {recentSearches.map((user) => (
                        <button
                          key={user}
                          type="button"
                          className="standalone-chip-btn"
                          onClick={() => {
                            setUsernameInput(user);
                            handleFetchGames(user);
                          }}
                        >
                          @{user}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggestion Chips: Tournament Roster */}
                  {rosterPlayers.length > 0 && (
                    <div className="standalone-chips-row">
                      <span className="standalone-chips-label">
                        <Trophy size={11} style={{ display: 'inline', marginRight: 3 }} />
                        Pemain Turnamen:
                      </span>
                      {rosterPlayers.slice(0, 8).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="standalone-chip-btn"
                          onClick={() => {
                            if (p.chessComUsername) {
                              setUsernameInput(p.chessComUsername);
                              handleFetchGames(p.chessComUsername);
                            }
                          }}
                        >
                          {p.name} (@{p.chessComUsername})
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Error Notification */}
                  {errorMsg && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Games History List */}
                  {isLoadingGames ? (
                    <div
                      style={{
                        padding: '3rem 1.5rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.75rem',
                        color: '#9ca3af',
                      }}
                    >
                      <Loader2 size={32} className="chesscom-spinner" style={{ color: '#81b64c' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        Mengambil riwayat game dari Chess.com @{activeUsername}...
                      </span>
                    </div>
                  ) : games.length > 0 ? (
                    <div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#81b64c',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginBottom: '0.65rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          Daftar Permainan @{activeUsername} ({games.length} game):
                        </span>
                        <span style={{ color: '#9ca3af', fontWeight: 500, fontSize: '0.72rem' }}>
                          Pilih game untuk analisis mandiri
                        </span>
                      </div>

                      <div className="standalone-games-scroll">
                        {games.map((g, idx) => {
                          const outcome = getGameOutcome(g, activeUsername);
                          const isWhite =
                            sanitizeChessComUsername(g.white.username) === activeUsername;

                          return (
                            <div
                              key={g.url || `${idx}_${g.endTime}`}
                              className="standalone-game-item-card"
                              onClick={() => handleSelectGame(g)}
                            >
                              <div className="standalone-game-meta-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <span className={`time-pill ${g.timeClass}`}>
                                    {getTimeClassIcon(g.timeClass)}
                                    <span>
                                      {g.timeClass.toUpperCase()} {g.timeControl}
                                    </span>
                                  </span>
                                  <span className="game-date">{formatGameDate(g.endTime)}</span>
                                </div>
                                <span className={`outcome-badge ${outcome.cls}`}>
                                  {outcome.text}
                                </span>
                              </div>

                              <div className="standalone-game-players-grid">
                                <div className={`standalone-player-tag ${isWhite ? 'highlight' : ''}`}>
                                  <span>♟</span>
                                  <span className="standalone-player-name">{g.white.username}</span>
                                  <span className="standalone-player-rating">({g.white.rating})</span>
                                </div>

                                <div className="standalone-game-score-badge">{g.tournamentScore}</div>

                                <div
                                  className={`standalone-player-tag ${!isWhite ? 'highlight' : ''}`}
                                  style={{ justifyContent: 'flex-end' }}
                                >
                                  <span className="standalone-player-rating">({g.black.rating})</span>
                                  <span className="standalone-player-name">{g.black.username}</span>
                                  <span>♙</span>
                                </div>
                              </div>

                              {g.termination && (
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: '#9ca3af',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  {g.termination}
                                </div>
                              )}

                              <div className="standalone-game-actions-row">
                                <button
                                  type="button"
                                  className="standalone-btn-analyze"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectGame(g);
                                  }}
                                  title="Mulai analisis langkah mandiri dengan Stockfish 19"
                                >
                                  <Sparkles size={14} />
                                  <span>Mulai Analisis Mandiri</span>
                                </button>

                                {g.url && (
                                  <a
                                    href={g.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="standalone-nav-btn"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Buka pertandingan di Chess.com"
                                    style={{ padding: '0.45rem 0.6rem' }}
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                /* PGN Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>
                    Tempelkan notasi PGN (Portable Game Notation) dari pertandingan Anda di bawah
                    ini untuk langsung dianalisis:
                  </p>
                  <textarea
                    rows={8}
                    value={customPgnInput}
                    onChange={(e) => setCustomPgnInput(e.target.value)}
                    placeholder="Contoh: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6..."
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      background: '#181715',
                      border: '1.5px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAnalyzeCustomPgn}
                    className="standalone-search-submit"
                    style={{ width: '100%' }}
                  >
                    <Sparkles size={16} />
                    <span>Analisis PGN Ini</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Modal: Opens full interactive Chess.com board when game is selected */}
      {selectedGame && (
        <ChessBoardPreviewModal
          isOpen={Boolean(selectedGame)}
          match={null}
          recentGame={selectedGame}
          whitePlayer={{
            id: `cc_${selectedGame.white.username}`,
            name: selectedGame.white.username,
            rating: selectedGame.white.rating,
            seed: 0,
            chessComUsername: selectedGame.white.username,
          }}
          blackPlayer={{
            id: `cc_${selectedGame.black.username}`,
            name: selectedGame.black.username,
            rating: selectedGame.black.rating,
            seed: 0,
            chessComUsername: selectedGame.black.username,
          }}
          onClose={() => {
            // When user closes board modal, return to the picker window so they can pick another game!
            setIsPickerModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
