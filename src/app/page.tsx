'use client';

import React, { useState, useEffect } from 'react';
import { Player, SwissMatch } from '../types/chess';
import { initialSwissPlayers, generateSwissRound1 } from '../utils/swissEngine';
import { SwissDashboard } from '../components/SwissDashboard';
import { ChessTimerModal } from '../components/ChessTimerModal';
import { Clock, RotateCcw, ShieldCheck, Tv, Eye } from 'lucide-react';

const SWISS_STORAGE_KEY = 'CHESS_SWISS_POLTEK_SOROWAKO_V2';

export default function SwissTournamentPage() {
  const [players, setPlayers] = useState<Player[]>(initialSwissPlayers);
  const [matches, setMatches] = useState<SwissMatch[]>(() => generateSwissRound1(initialSwissPlayers));
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [isBroadcastMode, setIsBroadcastMode] = useState<boolean>(false);

  // Load saved state from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SWISS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.players && parsed.matches) {
          setPlayers(parsed.players);
          setMatches(parsed.matches);
          if (parsed.totalRounds) setTotalRounds(parsed.totalRounds);
        }
      }
    } catch (e) {
      console.error('Failed to parse saved swiss data', e);
    }
  }, []);

  // Save to LocalStorage
  const saveTournament = (
    newPlayers: Player[],
    newMatches: SwissMatch[],
    roundsCount: number = totalRounds
  ) => {
    setPlayers(newPlayers);
    setMatches(newMatches);
    setTotalRounds(roundsCount);
    try {
      localStorage.setItem(
        SWISS_STORAGE_KEY,
        JSON.stringify({
          players: newPlayers,
          matches: newMatches,
          totalRounds: roundsCount,
        })
      );
    } catch (e) {
      console.error('Failed to save swiss tournament to localStorage', e);
    }
  };

  const handleResetSwiss = () => {
    if (confirm('Kembalikan turnamen ke setelan awal Chess Club Politeknik Sorowako?')) {
      const initialMatches = generateSwissRound1(initialSwissPlayers);
      saveTournament(initialSwissPlayers, initialMatches, 5);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-main)' }}>
      <div className="chess-wrapper">
        {/* Floating Broadcast Mode Exit Button */}
        {isBroadcastMode && (
          <div className="broadcast-exit">
            <button onClick={() => setIsBroadcastMode(false)} className="btn-gold-action">
              <Eye size={14} />
              <span>Keluar mode layar penuh</span>
            </button>
          </div>
        )}

        {/* Top Header with Official Chess Club Politeknik Sorowako Logo */}
        {!isBroadcastMode && (
          <header className="top-nav-bar">
            <div className="brand-section">
              <div className="brand-title-wrap">
                <div className="brand-logo-row">
                  <img
                    src="/images/logo-chess-club-text.png"
                    alt="Chess Club Politeknik Sorowako"
                    className="brand-text-logo-img"
                  />
                  <span className="badge-pill-gold">Resmi 2026</span>
                </div>
                <p className="brand-subtitle">
                  Dashboard turnamen catur sistem Swiss • UKM Catur Mahasiswa Politeknik Sorowako
                </p>
              </div>
            </div>

            <div className="header-actions-row">
              <button
                onClick={() => setIsTimerOpen(true)}
                className="btn-glass-secondary"
                title="Buka jam catur digital"
              >
                <Clock size={15} style={{ color: '#7dd3fc' }} />
                <span>Jam catur</span>
              </button>

              <button
                onClick={() => setIsBroadcastMode(true)}
                className="btn-glass-secondary"
                title="Tampilkan mode layar TV / proyektor"
              >
                <Tv size={15} style={{ color: '#f6d77a' }} />
                <span>Mode TV</span>
              </button>

              <button
                onClick={handleResetSwiss}
                className="btn-glass-secondary"
                title="Reset turnamen ke 8 peserta default"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
          </header>
        )}

        {/* Main Swiss Dashboard */}
        <SwissDashboard
          players={players}
          matches={matches}
          totalRounds={totalRounds}
          onUpdateMatches={(newM) => saveTournament(players, newM, totalRounds)}
          onUpdatePlayers={(newP) => saveTournament(newP, matches, totalRounds)}
          onResetSwiss={() => {
            const initialMatches = generateSwissRound1(initialSwissPlayers);
            saveTournament(initialSwissPlayers, initialMatches, 5);
          }}
        />

        {/* Footer with Logo */}
        <footer className="site-footer">
          <div className="footer-left">
            <img src="/images/logo-chess-club-sorowako.png" alt="Politeknik Sorowako" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ShieldCheck size={15} style={{ color: 'var(--green)' }} />
              <span>Tie-break FIDE: Buchholz (BH) dan Sonneborn-Berger (SB)</span>
            </div>
          </div>

          <div>
            Diselenggarakan oleh <strong>Chess Club Politeknik Sorowako</strong> • Platform DevByReza
          </div>
        </footer>
      </div>

      {/* Chess Timer Modal */}
      {isTimerOpen && (
        <ChessTimerModal
          whiteName={players[0]?.name || 'Putih'}
          blackName={players[1]?.name || 'Hitam'}
          onClose={() => setIsTimerOpen(false)}
        />
      )}
    </main>
  );
}
