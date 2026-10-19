'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Player, SwissMatch, TournamentFormData, TournamentStore } from '../types/chess';
import {
  createEmptyStore,
  countCompletedGamesInOtherTournaments,
  playersForTournament,
  uid,
  sameIds,
  hasStarted,
  ensureInitialRatings,
} from '../utils/tournamentStore';
import { generateSwissRound1 } from '../utils/swissEngine';
import { SwissDashboard } from '../components/SwissDashboard';
import { ChessTimerModal } from '../components/ChessTimerModal';
import { TournamentManager } from '../components/TournamentManager';
import { AdminLoginModal } from '../components/AdminLoginModal';
import { TournamentRulesModal } from '../components/TournamentRulesModal';
import {
  checkIsAdmin,
  saveAdminSession,
  clearAdminSession,
  getStoredAdminPin,
} from '../utils/adminAuth';
import { Clock, Settings, Plus, Trophy, Lock, LogOut, BookOpen } from 'lucide-react';

export default function SwissTournamentPage() {
  const [store, setStore] = useState(createEmptyStore);
  const [isHydrated, setIsHydrated] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'unconfigured' | 'offline'>('checking');
  const dbStatusRef = useRef(dbStatus);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const confirmedStoreRef = useRef(createEmptyStore());
  const lastPersistedStoreRef = useRef<TournamentStore | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // Modals state
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [isManagerOpen, setIsManagerOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [managerTab, setManagerTab] = useState<'tournaments' | 'roster'>('tournaments');
  const [managerCreate, setManagerCreate] = useState<boolean>(false);
  const [managerEditId, setManagerEditId] = useState<string | null>(null);

  // Neon is the only source of tournament and roster data.
  useEffect(() => {
    setIsAdmin(checkIsAdmin());
    let cancelled = false;
    fetch('/api/tournament')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.configured && data.source === 'postgres' && data.store) {
          setDbStatus('connected');
          const syncedStore = ensureInitialRatings(data.store);
          confirmedStoreRef.current = data.store;
          lastPersistedStoreRef.current = data.store;
          setStore(syncedStore);
        } else {
          setStore(createEmptyStore());
          setDbStatus(data.configured ? 'offline' : 'unconfigured');
        }
        setIsHydrated(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('PostgreSQL fetch warning:', err);
        setStore(createEmptyStore());
        setDbStatus('offline');
        setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    dbStatusRef.current = dbStatus;
  }, [dbStatus]);

  // Queue writes so rapid edits cannot finish out of order and leave an older snapshot in Neon.
  useEffect(() => {
    if (isHydrated && dbStatus === 'connected') {
      const storeSnapshot = store;
      if (storeSnapshot === lastPersistedStoreRef.current) return;
      const adminPin = getStoredAdminPin() || 'admin2026';
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (dbStatusRef.current !== 'connected') return;
        if (storeSnapshot === lastPersistedStoreRef.current) return;
        try {
          const response = await fetch('/api/tournament', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-pin': adminPin,
            },
            body: JSON.stringify({ store: storeSnapshot }),
          });
          const result = await response.json();
          if (response.ok && result.savedToDb) {
            confirmedStoreRef.current = storeSnapshot;
            lastPersistedStoreRef.current = storeSnapshot;
            return;
          }
          dbStatusRef.current = 'offline';
          setStore(confirmedStoreRef.current);
          setDbStatus('offline');
        } catch (err) {
          console.warn('Gagal sync ke PostgreSQL:', err);
          dbStatusRef.current = 'offline';
          setStore(confirmedStoreRef.current);
          setDbStatus('offline');
        }
      });
    }
  }, [store, isHydrated, dbStatus]);

  const handleLogout = () => {
    clearAdminSession();
    setIsAdmin(false);
  };

  const requireConnectedAdmin = () => {
    if (dbStatus !== 'connected') {
      alert('Neon tidak terhubung. Perubahan ditolak agar data tidak hanya tersimpan lokal.');
      return false;
    }
    if (!isAdmin) {
      setIsAdminModalOpen(true);
      return false;
    }
    return true;
  };

  // Ensure the Neon schema exists, then reload the authoritative store from Neon.
  const handleSyncWithDatabase = async () => {
    const adminPin = getStoredAdminPin() || '';
    try {
      const res = await fetch('/api/init-db', {
        headers: { 'x-admin-pin': adminPin },
      });
      const data = await res.json();
      if (data.success) {
        const tourRes = await fetch('/api/tournament');
        const tourData = await tourRes.json();
        if (tourData.success && tourData.configured && tourData.source === 'postgres' && tourData.store) {
          const syncedStore = ensureInitialRatings(tourData.store);
          confirmedStoreRef.current = tourData.store;
          lastPersistedStoreRef.current = tourData.store;
          setStore(syncedStore);
          setDbStatus('connected');
        } else {
          setDbStatus(tourData.configured ? 'offline' : 'unconfigured');
        }
        alert(data.message || 'Sinkronisasi database berhasil!');
      } else {
        alert(data.error || 'Gagal menyiapkan database.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan koneksi database: ' + (err?.message || err));
    }
  };

  // Resolve current active tournament
  const activeTournament =
    store.tournaments.find((t) => t.id === store.activeId) ||
    store.tournaments[0] ||
    null;

  const activePlayers = activeTournament
    ? (() => {
        const gamesFromOtherTournaments = countCompletedGamesInOtherTournaments(
          store.tournaments,
          activeTournament.id
        );
        return playersForTournament(store.roster, activeTournament).map((player) => ({
          ...player,
          ratedGames: (player.ratedGames ?? 0) + (gamesFromOtherTournaments.get(player.id) ?? 0),
        }));
      })()
    : [];

  const isAdminConnected = isAdmin && dbStatus === 'connected';

  // Update matches for active tournament
  const handleUpdateActiveMatches = (newMatches: SwissMatch[]) => {
    if (!requireConnectedAdmin()) return;
    if (!activeTournament) return;
    setStore((prev) => ({
      ...prev,
      tournaments: prev.tournaments.map((t) =>
        t.id === activeTournament.id
          ? {
              ...t,
              matches: newMatches,
              initialRatings:
                t.initialRatings ||
                (hasStarted({ ...t, matches: newMatches })
                  ? Object.fromEntries(
                      t.playerIds.map((id) => [id, prev.roster.find((p) => p.id === id)?.rating ?? 500])
                    )
                  : undefined),
              initialRatedGames:
                t.initialRatedGames ||
                (hasStarted({ ...t, matches: newMatches })
                  ? Object.fromEntries(
                      t.playerIds.map((id) => [id, prev.roster.find((p) => p.id === id)?.ratedGames ?? 0])
                    )
                  : undefined),
            }
          : t
      ),
    }));
  };

  const handleUpdateRoundSchedule = (round: number, scheduledAt: string) => {
    if (!requireConnectedAdmin()) return;
    if (!activeTournament) return;

    setStore((prev) => ({
      ...prev,
      tournaments: prev.tournaments.map((t) => {
        if (t.id !== activeTournament.id) return t;

        const roundSchedules = { ...(t.roundSchedules || {}) };
        if (scheduledAt) roundSchedules[round] = scheduledAt;
        else delete roundSchedules[round];

        return { ...t, roundSchedules };
      }),
    }));
  };

  // Reset active tournament back to round 1
  const handleResetActive = () => {
    if (!requireConnectedAdmin()) return;
    if (!activeTournament) return;
    const freshRound1 = generateSwissRound1(activePlayers);
    setStore((prev) => ({
      ...prev,
      tournaments: prev.tournaments.map((t) =>
        t.id === activeTournament.id
          ? { ...t, matches: freshRound1, initialRatings: undefined, initialRatedGames: undefined }
          : t
      ),
    }));
  };

  // Save (create or update) tournament
  const handleSaveTournament = (data: TournamentFormData, editId?: string) => {
    if (!requireConnectedAdmin()) return;
    if (editId) {
      const current = store.tournaments.find((t) => t.id === editId);
      if (
        current &&
        hasStarted(current) &&
        (!sameIds(current.playerIds, data.playerIds) || current.totalRounds !== data.totalRounds)
      ) {
        alert('Peserta dan jumlah babak tidak dapat diubah setelah pertandingan dimulai.');
        return;
      }

      // Update existing
      setStore((prev) => {
        const existing = prev.tournaments.find((t) => t.id === editId);
        if (!existing) return prev;

        const playerListChanged = !sameIds(existing.playerIds, data.playerIds);
        let updatedMatches = existing.matches;

        // If player list changed, regenerate round 1 pairing
        if (playerListChanged && !hasStarted(existing)) {
          const resolvedPlayers = data.playerIds
            .map((id) => prev.roster.find((p) => p.id === id))
            .filter((p): p is Player => Boolean(p))
            .map((p, idx) => ({ ...p, seed: idx + 1 }));
          updatedMatches = generateSwissRound1(resolvedPlayers);
        }

        const updatedTournaments = prev.tournaments.map((t) =>
          t.id === editId
            ? {
                ...t,
                name: data.name,
                date: data.date,
                location: data.location,
                totalRounds: data.totalRounds,
                playerIds: data.playerIds,
                matches: updatedMatches,
              }
            : t
        );

        return { ...prev, tournaments: updatedTournaments };
      });
    } else {
      // Create new tournament
      const newId = uid('tn');
      const resolvedPlayers = data.playerIds
        .map((id) => store.roster.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p))
        .map((p, idx) => ({ ...p, seed: idx + 1 }));

      const newTournament = {
        id: newId,
        name: data.name,
        date: data.date,
        location: data.location,
        totalRounds: data.totalRounds,
        playerIds: data.playerIds,
        matches: generateSwissRound1(resolvedPlayers),
        createdAt: Date.now(),
      };

      setStore((prev) => ({
        ...prev,
        tournaments: [newTournament, ...prev.tournaments],
        activeId: newId,
      }));
    }
  };

  // Delete tournament
  const handleDeleteTournament = (id: string) => {
    if (!requireConnectedAdmin()) return;
    setStore((prev) => {
      const remaining = prev.tournaments.filter((t) => t.id !== id);
      const nextActiveId =
        prev.activeId === id ? (remaining[0]?.id || null) : prev.activeId;
      return {
        ...prev,
        tournaments: remaining,
        activeId: nextActiveId,
      };
    });
  };

  // Switch active tournament
  const handleSetActive = (id: string) => {
    if (!requireConnectedAdmin()) return;
    setStore((prev) => ({ ...prev, activeId: id }));
  };

  // Roster CRUD
  const handleAddRosterPlayer = (
    playerData: Omit<Player, 'id' | 'seed'> & { id?: string },
    addToActiveTournament = true
  ) => {
    if (!requireConnectedAdmin()) return;
    const newId = playerData.id || uid('pl');
    const newPlayer: Player = {
      ...playerData,
      id: newId,
      seed: store.roster.length + 1,
    };

    setStore((prev) => {
      const updatedRoster = [...prev.roster, newPlayer];
      let updatedTournaments = prev.tournaments;

      // Automatically enroll into active tournament if it exists
      if (addToActiveTournament && prev.activeId) {
        updatedTournaments = prev.tournaments.map((t) => {
          if (t.id === prev.activeId && !t.playerIds.includes(newId)) {
            const newPlayerIds = [...t.playerIds, newId];
            const resolvedPlayers = newPlayerIds
              .map((id) => updatedRoster.find((p) => p.id === id))
              .filter((p): p is Player => Boolean(p))
              .map((p, idx) => ({ ...p, seed: idx + 1 }));

            const started = hasStarted(t);
            const matches = started ? t.matches : generateSwissRound1(resolvedPlayers);

            return {
              ...t,
              playerIds: started ? t.playerIds : newPlayerIds,
              matches,
            };
          }
          return t;
        });
      }

      return {
        ...prev,
        roster: updatedRoster,
        tournaments: updatedTournaments,
      };
    });
  };

  const handleUpdateRosterPlayer = (id: string, updates: Partial<Player>) => {
    if (!requireConnectedAdmin()) return;
    const ratingLocked = store.tournaments.some(
      (t) => t.playerIds.includes(id) && hasStarted(t)
    );
    const ratedGamesLocked = store.tournaments.some(
      (t) => t.playerIds.includes(id) && hasStarted(t) && t.initialRatedGames?.[id] === undefined
    );

    const safeUpdates = { ...updates };
    if (ratingLocked && updates.rating !== undefined) {
      if (updates.rating !== store.roster.find((p) => p.id === id)?.rating) {
        alert('Rating Elo peserta sudah terkunci karena turnamen telah dimulai.');
      }
      delete safeUpdates.rating;
    }
    if (ratedGamesLocked && updates.ratedGames !== undefined) {
      if (updates.ratedGames !== store.roster.find((p) => p.id === id)?.ratedGames) {
        alert('Riwayat laga berating belum dapat diubah sebelum baseline turnamen tersimpan.');
      }
      delete safeUpdates.ratedGames;
    }

    setStore((prev) => ({
      ...prev,
      roster: prev.roster.map((p) => (p.id === id ? { ...p, ...safeUpdates } : p)),
    }));
  };

  const handleUpdatePlayers = (updatedPlayers: Player[]) => {
    if (!requireConnectedAdmin()) return;
    setStore((prev) => {
      const idMap = new Map(updatedPlayers.map((p) => [p.id, p]));
      const newRoster = prev.roster.map((p) => {
        const u = idMap.get(p.id);
        const ratingLocked = prev.tournaments.some(
          (t) => t.playerIds.includes(p.id) && hasStarted(t)
        );
        return u && !ratingLocked ? { ...p, rating: u.rating } : p;
      });
      return { ...prev, roster: newRoster };
    });
  };

  const handleDeleteRosterPlayer = (id: string) => {
    if (!requireConnectedAdmin()) return;
    setStore((prev) => ({
      ...prev,
      roster: prev.roster.filter((p) => p.id !== id),
    }));
  };

  const openManagerWithTab = (
    tab: 'tournaments' | 'roster',
    create: boolean = false,
    editId: string | null = null
  ) => {
    if (!requireConnectedAdmin()) return;
    setManagerTab(tab);
    setManagerCreate(create);
    setManagerEditId(editId);
    setIsManagerOpen(true);
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <div className="chess-wrapper">
        {/* Top Header with Official Chess Club Politeknik Sorowako Logo */}
        <header className="top-nav-bar">
          <div className="brand-section">
            <div className="brand-title-wrap">
              <div className="brand-logo-row">
                <img
                  src="/images/logo-chess-club-text.png"
                  alt="Chess Club Politeknik Sorowako"
                  className="brand-text-logo-img"
                />
              </div>
              <p className="brand-subtitle">
                Dashboard turnamen catur sistem Swiss • UKM Catur Mahasiswa Politeknik Sorowako
              </p>
            </div>
          </div>

          <div className="header-actions-row">
            {/* Database Cloud / Local Sync Badge */}
            <div
              className={`db-nav-badge ${dbStatus === 'connected' ? 'connected' : 'offline'}`}
              title={
                dbStatus === 'connected'
                  ? 'Online — database PostgreSQL terhubung'
                  : dbStatus === 'checking'
                  ? 'Memeriksa status database...'
                  : 'Offline — database tidak terhubung'
              }
            >
              <span
                className={`db-status-dot ${
                  dbStatus === 'connected'
                    ? 'connected'
                    : 'offline'
                }`}
              />
              <span className="db-nav-text">{dbStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {isAdminConnected ? (
              <>
                <div className="admin-status-badge" title="Anda login sebagai Admin Turnamen">
                  <span className="admin-status-dot" />
                  <span>Admin</span>
                </div>

                <button
                  onClick={() => openManagerWithTab('tournaments')}
                  className="btn-gold-action"
                  title="Kelola daftar turnamen dan database peserta"
                >
                  <Settings size={15} />
                  <span>Kelola turnamen</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  className="btn-glass-secondary"
                  title="Lihat Formula Elo dengan K dinamis (40, 20, atau 10)"
                >
                  <BookOpen size={15} style={{ color: 'var(--gold)' }} />
                  <span>Mekanisme</span>
                </button>

                <button
                  onClick={() => setIsTimerOpen(true)}
                  className="btn-glass-secondary"
                  title="Buka jam catur digital"
                >
                  <Clock size={15} style={{ color: '#7dd3fc' }} />
                  <span>Jam catur</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-glass-secondary btn-logout"
                  title="Keluar dari sesi Admin"
                >
                  <LogOut size={14} />
                  <span>Keluar</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  className="btn-glass-secondary"
                  title="Lihat Formula Elo dengan K dinamis (40, 20, atau 10)"
                >
                  <BookOpen size={15} style={{ color: 'var(--gold)' }} />
                  <span>Mekanisme</span>
                </button>

                <button
                  onClick={() => setIsTimerOpen(true)}
                  className="btn-glass-secondary"
                  title="Buka jam catur digital"
                >
                  <Clock size={15} style={{ color: '#7dd3fc' }} />
                  <span>Jam catur</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(true)}
                  className="btn-gold-action"
                  title="Masuk sebagai Administrator untuk mengubah skor & mengelola turnamen"
                >
                  <Lock size={14} />
                  <span>Login Admin</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Swiss Dashboard */}
        {activeTournament ? (
          <SwissDashboard
            key={activeTournament.id}
            players={activePlayers}
            matches={activeTournament.matches}
            totalRounds={activeTournament.totalRounds}
            tournamentName={activeTournament.name}
            tournamentDate={activeTournament.date}
            tournamentLocation={activeTournament.location}
            pairingOverrides={activeTournament.pairingOverrides}
            roundSchedules={activeTournament.roundSchedules}
            isAdmin={isAdminConnected}
            onRequestAdminLogin={() => setIsAdminModalOpen(true)}
            onUpdateMatches={handleUpdateActiveMatches}
            onUpdateRoundSchedule={handleUpdateRoundSchedule}
            onUpdatePlayers={handleUpdatePlayers}
            onEditParticipants={() => openManagerWithTab('tournaments', false, activeTournament.id)}
            onOpenRules={() => setIsRulesOpen(true)}
          />
        ) : dbStatus === 'checking' ? null : (
          <div className="empty-state" style={{ margin: '4rem auto', maxWidth: 540 }} role="status" aria-live="polite">
            <Trophy size={48} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
            <h3 className="empty-title">Belum ada turnamen yang dipilih</h3>
            <p className="empty-desc">
              {dbStatus === 'connected'
                ? isAdminConnected
                  ? 'Pilih turnamen dari database atau buat turnamen baru.'
                  : 'Belum ada turnamen. Hubungi administrator untuk membuat atau memilih turnamen.'
                : 'Data turnamen belum tersedia karena koneksi ke Neon belum aktif.'}
            </p>
            {isAdminConnected && (
              <button
                type="button"
                onClick={() => openManagerWithTab('tournaments', true)}
                className="btn-gold-action"
                style={{ margin: '1.25rem auto 0' }}
              >
                <Plus size={16} />
                <span>Buat turnamen baru</span>
              </button>
            )}
          </div>
        )}

        {/* Simple White Footer */}
        <footer className="site-footer">
          <span className="footer-title">CHESS POLITEKNIK SOROWAKO</span>
          <span className="footer-credit">devbyreza</span>
        </footer>
      </div>

      {!activeTournament && dbStatus === 'checking' && (
        <section
          className="chess-loading-state"
          role="status"
          aria-live="polite"
          aria-label="Memuat data pertandingan"
        >
          <div className="chess-loading-board" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <span
                key={index}
                className={`chess-loading-square ${(Math.floor(index / 3) + (index % 3)) % 2 === 0 ? 'is-light' : 'is-dark'}`}
              />
            ))}
            <span className="chess-loading-knight">♞</span>
          </div>
        </section>
      )}

      {/* Chess Timer Modal */}
      {isTimerOpen && (
        <ChessTimerModal
          whiteName={activePlayers[0]?.name || 'Putih'}
          blackName={activePlayers[1]?.name || 'Hitam'}
          onClose={() => setIsTimerOpen(false)}
        />
      )}

      {/* Tournament & Roster Manager Modal */}
      {isManagerOpen && (
        <TournamentManager
          roster={store.roster}
          tournaments={store.tournaments}
          activeId={store.activeId}
          initialTab={managerTab}
          initialCreate={managerCreate}
          initialEditId={managerEditId}
          dbStatus={dbStatus}
          onClose={() => {
            setIsManagerOpen(false);
            setManagerCreate(false);
            setManagerEditId(null);
          }}
          onSetActive={handleSetActive}
          onSaveTournament={handleSaveTournament}
          onDeleteTournament={handleDeleteTournament}
          onAddRosterPlayer={handleAddRosterPlayer}
          onUpdateRosterPlayer={handleUpdateRosterPlayer}
          onDeleteRosterPlayer={handleDeleteRosterPlayer}
          onResetTournament={handleResetActive}
          onSyncDb={() => handleSyncWithDatabase()}
        />
      )}

      {/* Admin PIN Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={(pin) => {
          saveAdminSession(pin);
          setIsAdmin(true);
        }}
      />

      {/* Tournament Rules & Elo Mechanism Modal */}
      <TournamentRulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </main>
  );
}
