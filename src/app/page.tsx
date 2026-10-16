'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Player, SwissMatch } from '../types/chess';
import { initialSwissPlayers, generateSwissRound1 } from '../utils/swissEngine';
import { SwissDashboard } from '../components/SwissDashboard';
import { ChessTimerModal } from '../components/ChessTimerModal';
import { Clock, RotateCcw, ShieldCheck, Tv, Eye, Type, Sparkles } from 'lucide-react';

const SWISS_STORAGE_KEY = 'CHESS_SWISS_POLTEK_SOROWAKO_V2';

type FontOption = 'montserrat' | 'condensed' | 'tech' | 'classical';

const fontLabels: Record<FontOption, string> = {
  montserrat: 'Modern Collegiate',
  condensed: 'Athletic Block',
  tech: 'Futuristic Tech',
  classical: 'Klasik Editorial (Serif)',
};

export default function SwissTournamentPage() {
  const [players, setPlayers] = useState<Player[]>(initialSwissPlayers);
  const [matches, setMatches] = useState<SwissMatch[]>(() => generateSwissRound1(initialSwissPlayers));
  const [totalRounds, setTotalRounds] = useState<number>(5);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [isBroadcastMode, setIsBroadcastMode] = useState<boolean>(false);
  const [fontStyle, setFontStyle] = useState<FontOption>('montserrat');

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
          if (parsed.fontStyle) setFontStyle(parsed.fontStyle);
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
    roundsCount: number = totalRounds,
    newFont: FontOption = fontStyle
  ) => {
    setPlayers(newPlayers);
    setMatches(newMatches);
    setTotalRounds(roundsCount);
    setFontStyle(newFont);
    try {
      localStorage.setItem(
        SWISS_STORAGE_KEY,
        JSON.stringify({
          players: newPlayers,
          matches: newMatches,
          totalRounds: roundsCount,
          fontStyle: newFont,
        })
      );
    } catch (e) {
      console.error('Failed to save swiss tournament to localStorage', e);
    }
  };

  const handleCycleFont = () => {
    const options: FontOption[] = ['montserrat', 'condensed', 'tech', 'classical'];
    const currentIndex = options.indexOf(fontStyle);
    const nextFont = options[(currentIndex + 1) % options.length];
    saveTournament(players, matches, totalRounds, nextFont);
  };

  const handleResetSwiss = () => {
    if (confirm('Kembalikan turnamen ke setelan awal Chess Club Politeknik Sorowako?')) {
      const initialMatches = generateSwissRound1(initialSwissPlayers);
      saveTournament(initialSwissPlayers, initialMatches, 5, 'montserrat');
    }
  };

  return (
    <main
      data-font={fontStyle === 'montserrat' ? undefined : fontStyle}
      style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-main)' }}
    >
      <div className="chess-wrapper">
        {/* Floating Broadcast Mode Exit Button */}
        {isBroadcastMode && (
          <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999 }}>
            <button
              onClick={() => setIsBroadcastMode(false)}
              className="btn-gold-action"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
            >
              <Eye size={14} />
              <span>Keluar Mode Layar Penuh</span>
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
                  <span className="badge-pill-gold">
                    RESMI 2026
                  </span>
                </div>
                <p className="brand-subtitle">
                  Dashboard Turnamen Catur Sistem Swiss • UKM Catur Mahasiswa Politeknik Sorowako
                </p>
              </div>
            </div>

            <div className="header-actions-row">
              {/* Font Style Switcher Button */}
              <button
                onClick={handleCycleFont}
                className="btn-glass-secondary"
                title="Ganti Gaya Huruf Teks (Modern, Athletic, Tech, Klasik)"
              >
                <Type size={15} style={{ color: '#ffd700' }} />
                <span>Font: <strong>{fontLabels[fontStyle]}</strong></span>
              </button>

              <button
                onClick={() => setIsTimerOpen(true)}
                className="btn-glass-secondary"
                title="Buka Jam Catur Digital"
              >
                <Clock size={15} style={{ color: '#38bdf8' }} />
                <span>Jam Catur</span>
              </button>

              <button
                onClick={() => setIsBroadcastMode(true)}
                className="btn-glass-secondary"
                title="Tampilkan Mode Layar TV / Proyektor"
              >
                <Tv size={15} style={{ color: '#ffd700' }} />
                <span>Mode TV</span>
              </button>

              <button
                onClick={handleResetSwiss}
                className="btn-glass-secondary"
                title="Reset Turnamen ke 8 Peserta Default"
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
          onUpdateMatches={(newM) => saveTournament(players, newM, totalRounds, fontStyle)}
          onUpdatePlayers={(newP) => saveTournament(newP, matches, totalRounds, fontStyle)}
          onResetSwiss={() => {
            const initialMatches = generateSwissRound1(initialSwissPlayers);
            saveTournament(initialSwissPlayers, initialMatches, 5, fontStyle);
          }}
        />

        {/* Minimalist Footer with Logo */}
        <footer
          style={{
            marginTop: '3.5rem',
            paddingTop: '1.75rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8rem',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/images/logo-chess-club-sorowako.png"
              alt="Politeknik Sorowako"
              style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ShieldCheck size={15} style={{ color: '#38bdf8' }} />
              <span>Kalkulasi Tie-Break FIDE: Buchholz (BH) & Sonneborn-Berger (SB)</span>
            </div>
          </div>

          <div>
            Diselenggarakan oleh <strong style={{ color: '#ffd700' }}>Chess Club Politeknik Sorowako</strong> • Platform DevByReza
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
