'use strict';
'use client';

import React, { useState } from 'react';
import { Player, SwissMatch, MatchResult } from '../types/chess';
import {
  calculateSwissStandings,
  generateNextSwissRound,
  generateSwissRound1,
} from '../utils/swissEngine';
import {
  Trophy,
  ArrowRight,
  RotateCcw,
  Crown,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Award,
  Sparkles,
  Swords,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SwissDashboardProps {
  players: Player[];
  matches: SwissMatch[];
  totalRounds: number;
  onUpdateMatches: (newMatches: SwissMatch[]) => void;
  onUpdatePlayers: (newPlayers: Player[]) => void;
  onResetSwiss: () => void;
}

export const SwissDashboard: React.FC<SwissDashboardProps> = ({
  players,
  matches,
  totalRounds,
  onUpdateMatches,
  onUpdatePlayers,
  onResetSwiss,
}) => {
  const standings = calculateSwissStandings(players, matches);
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
  const currentMaxRound = rounds.length > 0 ? Math.max(...rounds) : 1;

  const [selectedRoundTab, setSelectedRoundTab] = useState<number>(currentMaxRound);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRating, setNewPlayerRating] = useState('1800');

  // Filter matches for the selected round
  const activeRoundMatches = matches.filter((m) => m.round === selectedRoundTab);
  const isCurrentRoundFullyScored =
    activeRoundMatches.length > 0 && activeRoundMatches.every((m) => m.result !== null);

  const canGenerateNextRound =
    isCurrentRoundFullyScored && currentMaxRound < totalRounds;

  const isTournamentFinished =
    currentMaxRound === totalRounds && isCurrentRoundFullyScored;

  // Handle Score Selection
  const handleScoreChange = (matchId: string, result: MatchResult) => {
    const updated = matches.map((m) => (m.id === matchId ? { ...m, result } : m));
    onUpdateMatches(updated);
  };

  // Generate Next Round
  const handleGenerateNextRound = () => {
    if (!canGenerateNextRound) return;
    const nextRoundNum = currentMaxRound + 1;
    const newRoundMatches = generateNextSwissRound(nextRoundNum, players, matches);
    const updatedMatches = [...matches, ...newRoundMatches];
    onUpdateMatches(updatedMatches);
    setSelectedRoundTab(nextRoundNum);

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#38bdf8', '#ffd700', '#ffffff', '#10b981'],
    });
  };

  // Add new player
  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newP: Player = {
      id: `sp_${Date.now()}`,
      name: newPlayerName.trim(),
      seed: players.length + 1,
      rating: parseInt(newPlayerRating, 10) || 1800,
    };
    const updatedPlayers = [...players, newP];
    onUpdatePlayers(updatedPlayers);
    setNewPlayerName('');
    onUpdateMatches(generateSwissRound1(updatedPlayers));
    setSelectedRoundTab(1);
  };

  // Remove player
  const handleRemovePlayer = (id: string) => {
    if (players.length <= 4) {
      alert('Sistem Swiss minimal memerlukan 4 pemain!');
      return;
    }
    const filtered = players.filter((p) => p.id !== id);
    onUpdatePlayers(filtered);
    onUpdateMatches(generateSwissRound1(filtered));
    setSelectedRoundTab(1);
  };

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  // Top 3 Podium players
  const top1 = standings.rows[0];
  const top2 = standings.rows[1];
  const top3 = standings.rows[2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Hero Banner Card */}
      <div className="hero-banner-card">
        <div className="flex-row-between">
          <div>
            <div className="hero-header-meta">
                <span className="badge-pill-cyan">
                  <Sparkles size={12} />
                  FIDE SWISS PAIRING ENGINE
                </span>
                <span className="badge-pill-gold">
                  {players.length} Pemain Terdaftar
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  • Format {totalRounds} Babak Resmi
                </span>
              </div>

              <h2 className="hero-title">
                Turnamen Catur Sistem Swiss
              </h2>
              <p className="hero-desc">
                Diselenggarakan resmi oleh <strong>Chess Club Politeknik Sorowako</strong>. Setiap babak pemain dipasangkan dengan lawan yang memiliki perolehan poin serupa tanpa pernah bertanding dua kali.
              </p>
            </div>

          <div className="hero-actions-group">
            <button
              onClick={() => setIsPlayerModalOpen(true)}
              className="btn-glass-secondary"
            >
              <Users size={15} style={{ color: '#38bdf8' }} />
              <span>Kelola Peserta ({players.length})</span>
            </button>

            <button
              onClick={handleGenerateNextRound}
              disabled={!canGenerateNextRound}
              className="btn-gold-action"
              title={
                canGenerateNextRound
                  ? 'Pasangkan babak berikutnya berdasarkan poin & Buchholz'
                  : 'Selesaikan semua skor babak ini untuk membuka babak berikutnya'
              }
            >
              <span>Pairing Babak {currentMaxRound + 1}</span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={() => {
                if (confirm('Mulai ulang seluruh babak turnamen Swiss dari Babak 1?')) {
                  onResetSwiss();
                  setSelectedRoundTab(1);
                }
              }}
              className="btn-glass-secondary"
              title="Reset ke Babak 1"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Round Stepper Progression Bar */}
        <div className="round-stepper-container">
          <div className="round-pills-row">
            {Array.from({ length: totalRounds }).map((_, idx) => {
              const rNum = idx + 1;
              const hasMatches = rounds.includes(rNum);
              const rMatches = matches.filter((m) => m.round === rNum);
              const isDone = rMatches.length > 0 && rMatches.every((m) => m.result !== null);

              let pillClass = 'round-pill-btn';
              if (selectedRoundTab === rNum) pillClass += ' active';
              else if (isDone) pillClass += ' completed';

              return (
                <button
                  key={rNum}
                  onClick={() => {
                    if (hasMatches) setSelectedRoundTab(rNum);
                  }}
                  disabled={!hasMatches}
                  className={pillClass}
                >
                  <span>BABAK {rNum}</span>
                  {isDone && <CheckCircle2 size={13} style={{ color: '#10b981' }} />}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '0.825rem', color: '#94a3b8', fontFamily: 'var(--font-code)' }}>
            {isTournamentFinished ? (
              <span style={{ color: '#ffd700', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Crown size={16} /> TURNAMEN SELESAI
              </span>
            ) : (
              <span>
                Babak Berjalan: <strong style={{ color: '#fff' }}>Babak {selectedRoundTab} dari {totalRounds}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Dashboard Grid */}
      <div className="swiss-two-col-grid">
        {/* Left Column: Match Board Cards */}
        <div className="section-card-panel">
          <div className="section-panel-header">
            <div className="section-title-wrap">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              <h3 className="section-title-text">
                Meja Pertandingan • Babak {selectedRoundTab}
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', color: '#94a3b8' }}>
              {activeRoundMatches.filter((m) => m.result !== null).length} / {activeRoundMatches.length} Laga Selesai
            </span>
          </div>

          <div className="matches-list-wrapper">
            {activeRoundMatches.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                Babak ini belum dipasangkan. Selesaikan pertandingan babak sebelumnya lalu klik <strong>Pairing Babak {selectedRoundTab}</strong>.
              </div>
            ) : (
              activeRoundMatches.map((match) => {
                const whiteP = getPlayer(match.whitePlayerId);
                const isBye = match.isBye;
                const blackP = isBye ? null : getPlayer(match.blackPlayerId);

                return (
                  <div key={match.id} className="board-match-card">
                    {/* Board Card Top Header */}
                    <div className="board-card-top-bar">
                      <span className="board-number-badge">
                        MEJA {String(match.boardNumber).padStart(2, '0')}
                      </span>
                      {isBye ? (
                        <span className="board-status-text" style={{ color: '#ffd700' }}>
                          ★ BYE (+1 POIN OTOMATIS)
                        </span>
                      ) : match.result ? (
                        <span className="board-status-text completed">
                          ✓ SKOR: {match.result}
                        </span>
                      ) : (
                        <span className="board-status-text pending">
                          Menunggu Hasil Pertandingan
                        </span>
                      )}
                    </div>

                    {/* Match Action Grid */}
                    <div className="match-action-grid">
                      {/* White Player */}
                      <div className="player-unit player-unit-white">
                        <div className="pawn-avatar white-piece" title="Bidak Putih">
                          ♟
                        </div>
                        <div className="player-info-meta">
                          <div className="player-name-line">
                            {whiteP?.title && (
                              <span className="title-tag">{whiteP.title}</span>
                            )}
                            <span className="player-name-text">
                              {whiteP?.name || 'TBD'}
                            </span>
                          </div>
                          <span className="player-elo-text">
                            Elo {whiteP?.rating || '1800'}
                          </span>
                        </div>
                      </div>

                      {/* Center Score Control Pill */}
                      <div className="score-control-cell">
                        {isBye ? (
                          <span className="score-bye-badge">
                            1 - 0 (Bye)
                          </span>
                        ) : (
                          <div className="score-pill-container">
                            <button
                              onClick={() => handleScoreChange(match.id, '1-0')}
                              className={`score-choice-btn ${match.result === '1-0' ? 'selected-win' : ''}`}
                              title="Menang Putih (1 - 0)"
                            >
                              1 - 0
                            </button>

                            <button
                              onClick={() => handleScoreChange(match.id, '0.5-0.5')}
                              className={`score-choice-btn ${match.result === '0.5-0.5' ? 'selected-draw' : ''}`}
                              title="Remis (½ - ½)"
                            >
                              ½ - ½
                            </button>

                            <button
                              onClick={() => handleScoreChange(match.id, '0-1')}
                              className={`score-choice-btn ${match.result === '0-1' ? 'selected-win' : ''}`}
                              title="Menang Hitam (0 - 1)"
                            >
                              0 - 1
                            </button>

                            {match.result && (
                              <button
                                onClick={() => handleScoreChange(match.id, null)}
                                className="score-reset-btn"
                                title="Reset Skor"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Black Player */}
                      <div className="player-unit is-black player-unit-black">
                        <div className="player-info-meta">
                          <div className="player-name-line">
                            <span className="player-name-text">
                              {isBye ? 'BYE (Libur)' : blackP?.name || 'TBD'}
                            </span>
                            {blackP?.title && (
                              <span className="title-tag">{blackP.title}</span>
                            )}
                          </div>
                          <span className="player-elo-text">
                            {isBye ? 'Poin Penuh' : `Elo ${blackP?.rating || '1800'}`}
                          </span>
                        </div>
                        <div className="pawn-avatar black-piece" title="Bidak Hitam">
                          ♙
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>


        {/* Right Column: Live Standings & Podium */}
        <div className="section-card-panel">
          <div className="section-panel-header">
            <div className="section-title-wrap">
              <Trophy size={18} style={{ color: '#ffd700' }} />
              <h3 className="section-title-text">
                Klasemen Sementara FIDE Swiss
              </h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Tie-Break: Buchholz (BH) & SB
            </span>
          </div>

          {/* Top 3 Podium Mini Cards */}
          <div className="podium-highlights-grid">
            {/* Rank 2 */}
            <div className="podium-mini-card rank-2">
              <div className="podium-rank-icon">🥈</div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Juara 2</div>
              <div className="podium-player-name">{top2?.player.name || '-'}</div>
              <div className="podium-points-tag" style={{ color: '#cbd5e1' }}>{top2?.points || 0} Pts</div>
            </div>

            {/* Rank 1 */}
            <div className="podium-mini-card rank-1">
              <div className="podium-rank-icon">👑</div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#ffd700', fontWeight: 800 }}>Juara 1</div>
              <div className="podium-player-name">{top1?.player.name || '-'}</div>
              <div className="podium-points-tag">{top1?.points || 0} Pts</div>
            </div>

            {/* Rank 3 */}
            <div className="podium-mini-card rank-3">
              <div className="podium-rank-icon">🥉</div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#b45309', fontWeight: 700 }}>Juara 3</div>
              <div className="podium-player-name">{top3?.player.name || '-'}</div>
              <div className="podium-points-tag" style={{ color: '#fb923c' }}>{top3?.points || 0} Pts</div>
            </div>
          </div>

          {/* Standings Table */}
          <div className="swiss-table-responsive">
            <table className="modern-swiss-table">
              <thead>
                <tr>
                  <th style={{ width: '45px', textAlign: 'center' }}>POS</th>
                  <th>PEMAIN</th>
                  <th style={{ textAlign: 'center' }}>ELO</th>
                  <th style={{ textAlign: 'center' }}>MAIN</th>
                  <th style={{ textAlign: 'center', color: '#34d399' }}>M</th>
                  <th style={{ textAlign: 'center' }}>R</th>
                  <th style={{ textAlign: 'center', color: '#f43f5e' }}>K</th>
                  <th style={{ textAlign: 'center', color: '#38bdf8' }} title="Buchholz (Total Poin Lawan)">
                    BH
                  </th>
                  <th style={{ textAlign: 'center', color: '#ffd700' }}>POIN</th>
                </tr>
              </thead>
              <tbody>
                {standings.rows.map((row, index) => {
                  const isLeader = index === 0 && row.points > 0;
                  let rankBadgeClass = 'rank-badge';
                  if (index === 0 && row.points > 0) rankBadgeClass += ' gold';
                  else if (index === 1 && row.points > 0) rankBadgeClass += ' silver';
                  else if (index === 2 && row.points > 0) rankBadgeClass += ' bronze';

                  return (
                    <tr key={row.player.id} className={isLeader ? 'leader-row' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <span className={rankBadgeClass}>
                          {index + 1}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                          {row.player.name}
                        </div>
                        {row.player.club && (
                          <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
                            {row.player.club}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>
                        {row.player.rating || 1800}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)' }}>
                        {row.played}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', color: '#34d399', fontWeight: 700 }}>
                        {row.won}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', color: '#94a3b8' }}>
                        {row.drawn}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', color: '#f43f5e' }}>
                        {row.lost}
                      </td>

                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)', color: '#38bdf8', fontWeight: 600 }}>
                        {row.buchholz || 0}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="points-pill">
                          {row.points}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: KELOLA PESERTA SWISS */}
      {isPlayerModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPlayerModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} style={{ color: '#38bdf8' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>
                  Kelola Peserta Turnamen Swiss
                </h3>
              </div>
              <button
                onClick={() => setIsPlayerModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Form Tambah Peserta */}
              <div className="player-add-form">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Nama Peserta Baru"
                  className="form-input-text"
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={newPlayerRating}
                  onChange={(e) => setNewPlayerRating(e.target.value)}
                  placeholder="Elo"
                  className="form-input-text"
                  style={{ width: '85px' }}
                />
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  disabled={!newPlayerName.trim()}
                  className="btn-gold-action"
                  style={{ padding: '0.6rem 1rem' }}
                >
                  <Plus size={15} />
                  <span>Tambah</span>
                </button>
              </div>

              {/* Daftar Peserta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                {players.map((p, idx) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(15, 23, 42, 0.7)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ width: '22px', textAlign: 'center', fontFamily: 'var(--font-code)', color: '#ffd700', fontWeight: 800 }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.875rem' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-code)' }}>
                        ({p.rating || 1800} Elo)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(p.id)}
                      style={{
                        padding: '0.35rem',
                        color: '#f43f5e',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: '6px',
                      }}
                      title="Hapus Pemain"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setIsPlayerModalOpen(false)}
                className="btn-glass-secondary"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
