'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trophy } from 'lucide-react';
import { SwissDashboard } from '../../components/SwissDashboard';
import type { TournamentStore } from '../../types/chess';
import {
  countCompletedGamesInOtherTournaments,
  playersForTournament,
  ensureInitialRatings,
} from '../../utils/tournamentStore';
import {
  getCachedTournamentStore,
  setCachedTournamentStore,
} from '../../utils/tournamentStoreCache';

type TournamentPageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; store: TournamentStore };

export default function TournamentSlugPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = (params.slug || '').trim().toLowerCase();

  useEffect(() => {
    if (slug === 'analisis') {
      router.replace('/analisis');
    }
  }, [slug, router]);

  const cached = getCachedTournamentStore();
  const cachedTournament = cached?.tournaments.find(
    (item) => item.slug?.toLowerCase() === slug
  );
  const hasCachedTournament = Boolean(cachedTournament);

  const [pageState, setPageState] = useState<TournamentPageState>(() => {
    if (cached && hasCachedTournament) {
      return { status: 'ready', store: cached };
    }
    return { status: 'loading' };
  });

  // Shorten loader duration (~300ms) when database was already connected
  const [isOpeningLoaderActive, setIsOpeningLoaderActive] = useState<boolean>(() => hasCachedTournament);

  useEffect(() => {
    if (hasCachedTournament) {
      const timer = setTimeout(() => {
        setIsOpeningLoaderActive(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [hasCachedTournament]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/tournament')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.store) {
          throw new Error(data.error || data.message || 'Data turnamen tidak dapat dimuat.');
        }
        return data.store as TournamentStore;
      })
      .then((store) => {
        if (cancelled) return;
        const syncedStore = ensureInitialRatings(store);
        setCachedTournamentStore(syncedStore, 'connected');
        setPageState({ status: 'ready', store: syncedStore });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!hasCachedTournament) {
          setPageState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat turnamen.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, hasCachedTournament]);

  const tournament = pageState.status === 'ready'
    ? pageState.store.tournaments.find((item) => item.slug?.toLowerCase() === slug) || null
    : null;

  const players = useMemo(() => {
    if (pageState.status !== 'ready' || !tournament) return [];
    const otherTournamentGames = countCompletedGamesInOtherTournaments(
      pageState.store.tournaments,
      tournament.id
    );
    return playersForTournament(pageState.store.roster, tournament).map((player) => ({
      ...player,
      ratedGames: (player.ratedGames ?? 0) + (otherTournamentGames.get(player.id) ?? 0),
    }));
  }, [pageState, tournament]);

  const isLoading = (pageState.status === 'loading' && !hasCachedTournament) || isOpeningLoaderActive;
  const failureMessage = pageState.status === 'error' ? pageState.message : null;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <div className="chess-wrapper">
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
              <p className="brand-subtitle">Hasil dan klasemen turnamen catur</p>
            </div>
          </div>
          <Link href="/" prefetch={true} className="btn-glass-secondary tournament-slug-backlink">
            <ArrowLeft size={15} />
            <span>Dashboard turnamen</span>
          </Link>
        </header>

        {isLoading ? (
          <section
            className="chess-loading-state"
            role="status"
            aria-live="polite"
            aria-label="Memuat data turnamen"
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
        ) : failureMessage ? (
          <div className="empty-state tournament-slug-message" role="alert">
            <Trophy size={42} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
            <h1 className="empty-title">Turnamen belum dapat dimuat</h1>
            <p className="empty-desc">{failureMessage}</p>
          </div>
        ) : !tournament ? (
          <div className="empty-state tournament-slug-message" role="status">
            <Trophy size={42} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
            <h1 className="empty-title">Turnamen tidak ditemukan</h1>
            <p className="empty-desc">
              Slug <code>{slug}</code> belum terdaftar. Periksa kembali alamat turnamen atau pilih turnamen dari dashboard.
            </p>
          </div>
        ) : (
          <SwissDashboard
            key={tournament.id}
            players={players}
            matches={tournament.matches}
            totalRounds={tournament.totalRounds}
            tournamentName={tournament.name}
            tournamentDate={tournament.date}
            tournamentLocation={tournament.location}
            pairingOverrides={tournament.pairingOverrides}
            roundSchedules={tournament.roundSchedules}
            isAdmin={false}
            onUpdateMatches={() => undefined}
          />
        )}

        <footer className="site-footer">
          <span className="footer-title">CHESS POLITEKNIK SOROWAKO</span>
          <span className="footer-credit">devbyreza</span>
        </footer>
      </div>
    </main>
  );
}

