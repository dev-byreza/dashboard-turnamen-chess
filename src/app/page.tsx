'use client';

import React, { useState, useEffect } from 'react';
import { Player, SwissMatch, TournamentFormData } from '../types/chess';
import {
  loadStore,
  saveStore,
  createDefaultStore,
  playersForTournament,
  uid,
  sameIds,
} from '../utils/tournamentStore';
import { generateSwissRound1 } from '../utils/swissEngine';
import { SwissDashboard } from '../components/SwissDashboard';
import { ChessTimerModal } from '../components/ChessTimerModal';
import { TournamentManager } from '../components/TournamentManager';
import { Clock, Settings, Plus, Trophy } from 'lucide-react';

export default function SwissTournamentPage() {
  const [store, setStore] = useState(createDefaultStore);
  const [isHydrated, setIsHydrated] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'unconfigured' | 'offline'>('checking');

  // Modals state
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [isManagerOpen, setIsManagerOpen] = useState<boolean>(false);
  const [managerTab, setManagerTab] = useState<'tournaments' | 'roster'>('tournaments');
  const [managerCreate, setManagerCreate] = useState<boolean>(false);
  const [managerEditId, setManagerEditId] = useState<string | null>(null);

  // Load saved state from LocalStorage on mount, then sync with PostgreSQL API
  useEffect(() => {
    const loaded = loadStore();
    if (loaded) {
      setStore(loaded);
    }
    setIsHydrated(true);

    // Check & sync from PostgreSQL on Vercel
    fetch('/api/tournament')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.configured && data.store) {
          setDbStatus('connected');
          setStore(data.store);
          saveStore(data.store);
        } else if (!data.configured) {
          setDbStatus('unconfigured');
        } else {
          setDbStatus('offline');
        }
      })
      .catch((err) => {
        console.warn('PostgreSQL fetch warning:', err);
        setDbStatus('offline');
      });
  }, []);

  // Persist store to LocalStorage and PostgreSQL whenever it changes
  useEffect(() => {
    if (isHydrated) {
      saveStore(store);

      // Persist to PostgreSQL if configured
      fetch('/api/tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.savedToDb) {
            setDbStatus('connected');
          }
        })
        .catch(() => {});
    }
  }, [store, isHydrated]);

  // Synchronize or seed data to/from PostgreSQL
  const handleSyncWithDatabase = async (force = false) => {
    try {
      const res = await fetch(`/api/init-db${force ? '?force=true' : ''}`);
      const data = await res.json();
      if (data.success) {
        const tourRes = await fetch('/api/tournament');
        const tourData = await tourRes.json();
        if (tourData.success && tourData.store) {
          setStore(tourData.store);
          saveStore(tourData.store);
          setDbStatus('connected');
        }
        alert(data.message || 'Sinkronisasi database berhasil!');
      } else {
        if (force) {
          // If DB not connected locally, still reset local state
          const fresh = createDefaultStore();
          setStore(fresh);
          saveStore(fresh);
          alert('Data lokal berhasil di-reset ke ROOKIE TOUR CHESS dengan 4 peserta. (Koneksi cloud akan aktif setelah POSTGRES_URL disetel di Vercel).');
        } else {
          alert(data.error || 'Gagal sinkronisasi database.');
        }
      }
    } catch (err: any) {
      if (force) {
        const fresh = createDefaultStore();
        setStore(fresh);
        saveStore(fresh);
        alert('Data lokal berhasil di-reset ke ROOKIE TOUR CHESS dengan 4 peserta.');
      } else {
        alert('Terjadi kesalahan koneksi database: ' + (err?.message || err));
      }
    }
  };

  // Resolve current active tournament
  const activeTournament =
    store.tournaments.find((t) => t.id === store.activeId) ||
    store.tournaments[0] ||
    null;

  const activePlayers = activeTournament
    ? playersForTournament(store.roster, activeTournament)
    : [];

  // Update matches for active tournament
  const handleUpdateActiveMatches = (newMatches: SwissMatch[]) => {
    if (!activeTournament) return;
    setStore((prev) => ({
      ...prev,
      tournaments: prev.tournaments.map((t) =>
        t.id === activeTournament.id ? { ...t, matches: newMatches } : t
      ),
    }));
  };

  // Reset active tournament back to round 1
  const handleResetActive = () => {
    if (!activeTournament) return;
    const freshRound1 = generateSwissRound1(activePlayers);
    setStore((prev) => ({
      ...prev,
      tournaments: prev.tournaments.map((t) =>
        t.id === activeTournament.id ? { ...t, matches: freshRound1 } : t
      ),
    }));
  };

  // Save (create or update) tournament
  const handleSaveTournament = (data: TournamentFormData, editId?: string) => {
    if (editId) {
      // Update existing
      setStore((prev) => {
        const existing = prev.tournaments.find((t) => t.id === editId);
        if (!existing) return prev;

        const playerListChanged = !sameIds(existing.playerIds, data.playerIds);
        let updatedMatches = existing.matches;

        // If player list changed, regenerate round 1 pairing
        if (playerListChanged) {
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
    setStore((prev) => ({ ...prev, activeId: id }));
  };

  // Roster CRUD
  const handleAddRosterPlayer = (playerData: Omit<Player, 'id' | 'seed'>) => {
    const newPlayer: Player = {
      ...playerData,
      id: uid('pl'),
      seed: store.roster.length + 1,
    };
    setStore((prev) => ({
      ...prev,
      roster: [...prev.roster, newPlayer],
    }));
  };

  const handleUpdateRosterPlayer = (id: string, updates: Partial<Player>) => {
    setStore((prev) => ({
      ...prev,
      roster: prev.roster.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  const handleDeleteRosterPlayer = (id: string) => {
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
            <button
              onClick={() => openManagerWithTab('tournaments')}
              className="btn-gold-action"
              title="Kelola daftar turnamen dan database peserta"
            >
              <Settings size={15} />
              <span>Kelola turnamen</span>
            </button>

            <button
              onClick={() => setIsTimerOpen(true)}
              className="btn-glass-secondary"
              title="Buka jam catur digital"
            >
              <Clock size={15} style={{ color: '#7dd3fc' }} />
              <span>Jam catur</span>
            </button>
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
            onUpdateMatches={handleUpdateActiveMatches}
            onResetSwiss={handleResetActive}
            onEditParticipants={() => openManagerWithTab('tournaments', false, activeTournament.id)}
          />
        ) : (
          <div className="empty-state" style={{ margin: '4rem auto', maxWidth: 540 }}>
            <Trophy size={48} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
            <h3 className="empty-title">Belum ada turnamen yang dipilih</h3>
            <p className="empty-desc">
              Buat turnamen catur baru atau pilih salah satu turnamen dari database Anda untuk memulai.
            </p>
            <button
              type="button"
              onClick={() => openManagerWithTab('tournaments', true)}
              className="btn-gold-action"
              style={{ margin: '1.25rem auto 0' }}
            >
              <Plus size={16} />
              <span>Buat turnamen baru</span>
            </button>
          </div>
        )}

        {/* Simple White Footer */}
        <footer className="site-footer">
          <span className="footer-title">CHESS POLITEKNIK SOROWAKO</span>
          <span className="footer-credit">devbyreza</span>
        </footer>
      </div>

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
          onSyncDb={() => handleSyncWithDatabase(false)}
          onResetToRookieTour={() => handleSyncWithDatabase(true)}
        />
      )}
    </main>
  );
}
