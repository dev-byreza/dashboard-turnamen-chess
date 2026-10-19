'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Player, SwissMatch, MatchResult, SwissPairingOverride } from '../types/chess';
import {
  calculateSwissStandings,
  generateNextSwissRound,
  generateSwissRound1,
} from '../utils/swissEngine';
import {
  Trophy,
  ArrowRight,
  Crown,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Swords,
  TrendingUp,
  Flag,
  Printer,
  X,
  Calendar,
  MapPin,
  BookOpen,
  Clock3,
  Save,
  Search,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SwissDashboardProps {
  players: Player[];
  matches: SwissMatch[];
  totalRounds: number;
  tournamentName?: string;
  tournamentDate?: string;
  tournamentLocation?: string;
  pairingOverrides?: Record<number, SwissPairingOverride[]>;
  roundSchedules?: Record<number, string>;
  isAdmin?: boolean;
  onRequestAdminLogin?: () => void;
  onUpdateMatches: (newMatches: SwissMatch[]) => void;
  onUpdateRoundSchedule?: (round: number, scheduledAt: string) => void;
  onUpdatePlayers?: (newPlayers: Player[]) => void;
  onEditParticipants?: () => void;
  onOpenRules?: () => void;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const formatRoundSchedule = (value: string) => {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = (datePart || '').split('-').map(Number);
  const [hour, minute] = (timePart || '').split(':');
  const date = new Date(year, month - 1, day, 12);
  if (!datePart || !timePart || Number.isNaN(date.getTime())) return value;

  const formattedDate = date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${formattedDate}, pukul ${hour}.${minute}`;
};

const smoothChartPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const start = points[index];
    const end = points[index + 1];
    const next = points[index + 2] || end;
    const controlOneX = start.x + (end.x - previous.x) / 6;
    const controlOneY = Math.max(44, Math.min(232, start.y + (end.y - previous.y) / 6));
    const controlTwoX = end.x - (next.x - start.x) / 6;
    const controlTwoY = Math.max(44, Math.min(232, end.y - (next.y - start.y) / 6));
    path += ` C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${end.x} ${end.y}`;
  }
  return path;
};

export const SwissDashboard: React.FC<SwissDashboardProps> = ({
  players,
  matches,
  totalRounds,
  tournamentName,
  tournamentDate,
  tournamentLocation,
  pairingOverrides,
  roundSchedules,
  isAdmin = false,
  onRequestAdminLogin,
  onUpdateMatches,
  onUpdateRoundSchedule,
  onUpdatePlayers,
  onEditParticipants,
  onOpenRules,
}) => {
  const standings = calculateSwissStandings(players, matches);
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
  const currentMaxRound = rounds.length > 0 ? Math.max(...rounds) : 1;

  const [selectedRoundTab, setSelectedRoundTab] = useState<number>(currentMaxRound);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRating, setNewPlayerRating] = useState('500');
  const [statisticsPlayerFilter, setStatisticsPlayerFilter] = useState('');
  const [roundScheduleDrafts, setRoundScheduleDrafts] = useState<Record<number, string>>(
    roundSchedules || {}
  );
  const celebratedRef = useRef(false);

  useEffect(() => {
    setRoundScheduleDrafts(roundSchedules || {});
  }, [roundSchedules]);

  useEffect(() => {
    if (selectedRoundTab > currentMaxRound) {
      setSelectedRoundTab(currentMaxRound);
    }
  }, [currentMaxRound, selectedRoundTab]);

  // Suppress document.title during print so browser top margin only shows the date without falling back to URL
  useEffect(() => {
    let originalTitle = document.title;
    const handleBeforePrint = () => {
      originalTitle = document.title;
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = '\u00A0';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 600);
  };

  const activeRoundMatches = matches.filter((m) => m.round === selectedRoundTab);
  const currentRoundMatches = matches.filter((m) => m.round === currentMaxRound);
  const isCurrentRoundFullyScored =
    currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.result !== null);

  const canGenerateNextRound = isCurrentRoundFullyScored && currentMaxRound < totalRounds;
  const isTournamentFinished = currentMaxRound === totalRounds && isCurrentRoundFullyScored;

  // ---- Derived statistics with live Elo calculation ----
  const avgElo = players.length
    ? Math.round(
        standings.rows.reduce(
          (sum, r) => sum + (r.currentRating ?? r.player.rating ?? 500),
          0
        ) / players.length
      )
    : 0;
  const playableMatches = matches.filter((m) => !m.isBye);
  const scoredMatches = playableMatches.filter((m) => m.result !== null).length;
  const expectedTotal = totalRounds * Math.floor(players.length / 2);
  const progressPct = expectedTotal
    ? Math.min(100, Math.round((scoredMatches / expectedTotal) * 100))
    : 0;
  const maxPoints = Math.max(1, ...standings.rows.map((r) => r.points));

  // Celebrate once when the tournament finishes
  useEffect(() => {
    if (isTournamentFinished && !celebratedRef.current) {
      celebratedRef.current = true;
      const end = Date.now() + 1400;
      const frame = () => {
        confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 }, colors: ['#e0a82e', '#4d7c3a', '#14213d'] });
        confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 }, colors: ['#e0a82e', '#4d7c3a', '#14213d'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
    if (!isTournamentFinished) celebratedRef.current = false;
  }, [isTournamentFinished]);

  const handleScoreChange = (matchId: string, result: MatchResult) => {
    const match = matches.find((m) => m.id === matchId);
    if (!isAdmin || !match || match.round !== currentMaxRound) return;
    const updated = matches.map((m) => (m.id === matchId ? { ...m, result } : m));
    onUpdateMatches(updated);
  };

  const handleGenerateNextRound = () => {
    if (!canGenerateNextRound) return;
    const nextRoundNum = currentMaxRound + 1;
    const newRoundMatches = generateNextSwissRound(
      nextRoundNum,
      players,
      matches,
      pairingOverrides?.[nextRoundNum] ?? []
    );
    onUpdateMatches([...matches, ...newRoundMatches]);
    setSelectedRoundTab(nextRoundNum);

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#e0a82e', '#4d7c3a', '#14213d', '#ffffff'],
    });
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newP: Player = {
      id: `sp_${Date.now()}`,
      name: newPlayerName.trim(),
      seed: players.length + 1,
      rating: parseInt(newPlayerRating, 10) || 500,
      ratedGames: 0,
    };
    const updatedPlayers = [...players, newP];
    onUpdatePlayers?.(updatedPlayers);
    setNewPlayerName('');
    setNewPlayerRating('500');
    onUpdateMatches(generateSwissRound1(updatedPlayers));
    setSelectedRoundTab(1);
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 4) {
      alert('Sistem Swiss minimal memerlukan 4 pemain!');
      return;
    }
    const filtered = players.filter((p) => p.id !== id);
    onUpdatePlayers?.(filtered);
    onUpdateMatches(generateSwissRound1(filtered));
    setSelectedRoundTab(1);
  };

  const getPlayer = (id: string) => players.find((p) => p.id === id);

  const top1 = standings.rows[0];
  const top2 = standings.rows[1];
  const top3 = standings.rows[2];

  const normalizedStatisticsPlayerFilter = statisticsPlayerFilter.trim().toLowerCase();
  const filteredPlayerStandings = standings.rows.filter((row) =>
    !normalizedStatisticsPlayerFilter ||
    row.player.name.toLowerCase().includes(normalizedStatisticsPlayerFilter)
  );
  const statisticsPalette = ['#b8891a', '#315a91', '#4d7c3a', '#b06a30', '#6b63be', '#c2413b', '#178a9a', '#929db0'];
  const statisticsRoundNumbers = Array.from({ length: totalRounds }, (_, index) => index + 1);
  const playerPointSeries = filteredPlayerStandings.map((standing, index) => {
    const pointsByRound = new Map<number, number>();

    matches.forEach((match) => {
      if (match.result === null) return;

      let earnedPoints = 0;
      const isBye = Boolean(match.isBye || match.blackPlayerId === '__bye__');
      if (isBye && match.whitePlayerId === standing.player.id) {
        earnedPoints = 1;
      } else if (match.whitePlayerId === standing.player.id) {
        earnedPoints = match.result === '1-0' ? 1 : match.result === '0.5-0.5' ? 0.5 : 0;
      } else if (match.blackPlayerId === standing.player.id) {
        earnedPoints = match.result === '0-1' ? 1 : match.result === '0.5-0.5' ? 0.5 : 0;
      }

      if (earnedPoints > 0) {
        pointsByRound.set(match.round, (pointsByRound.get(match.round) || 0) + earnedPoints);
      }
    });

    let cumulativePoints = 0;
    const points = statisticsRoundNumbers.map((round) => {
      cumulativePoints += pointsByRound.get(round) || 0;
      return { round, points: cumulativePoints };
    });

    return {
      id: standing.player.id,
      name: standing.player.name,
      points,
      color: statisticsPalette[index % statisticsPalette.length],
    };
  });
  const visiblePlayerPointSeries = playerPointSeries.slice(0, 8);
  const hiddenPlayerSeriesCount = Math.max(0, playerPointSeries.length - visiblePlayerPointSeries.length);
  const maxChartPoints = Math.max(
    1,
    totalRounds,
    ...visiblePlayerPointSeries.flatMap((series) => series.points.map((point) => point.points))
  );
  const chartTicks = Array.from({ length: 5 }, (_, index) => (maxChartPoints * index) / 4);
  const filteredOutcomeTotals = filteredPlayerStandings.reduce(
    (totals, row) => ({
      wins: totals.wins + row.won,
      draws: totals.draws + row.drawn,
      losses: totals.losses + row.lost,
    }),
    { wins: 0, draws: 0, losses: 0 }
  );
  const totalFilteredResults =
    filteredOutcomeTotals.wins + filteredOutcomeTotals.draws + filteredOutcomeTotals.losses;
  const hasCompletedStatisticsMatch = matches.some((match) => match.result !== null);
  const donutCircumference = 2 * Math.PI * 43;

  return (
    <div className="stack-page">
      {/* Champion banner (tournament finished) */}
      {isTournamentFinished && top1 && (
        <div className="champion-banner">
          <div className="champion-trophy">
            <Trophy size={32} />
          </div>
          <div>
            <div className="champion-eyebrow">Juara turnamen</div>
            <div className="champion-name">{top1.player.name}</div>
            <div className="champion-meta">
              {top1.points} poin dari {top1.played} laga • Buchholz {top1.buchholz || 0}
            </div>
          </div>
        </div>
      )}

      {/* Hero Banner Card */}
      <div className="hero-banner-card">
        <div className="flex-row-between">
          <div>
            <div className="hero-header-meta">
              <button
                type="button"
                onClick={onOpenRules}
                className="badge-pill-cyan"
                style={{ cursor: onOpenRules ? 'pointer' : 'default', border: 'none' }}
                title="Klik untuk melihat rumus Elo dan aturan K dinamis (40, 20, atau 10)"
              >
                <Sparkles size={12} />
                FIDE Swiss • Elo (K dinamis)
              </button>
              <span className="badge-pill-gold">{players.length} pemain terdaftar</span>
              <span className="hero-meta-text">• Format {totalRounds} babak resmi</span>
              {tournamentDate && (
                <span className="hero-meta-chip">
                  <Calendar size={13} />
                  <span>
                    {new Date(tournamentDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </span>
              )}
              {tournamentLocation && (
                <span className="hero-meta-chip">
                  <MapPin size={13} />
                  <span>{tournamentLocation}</span>
                </span>
              )}
            </div>

            <h2 className="hero-title">{tournamentName || 'Turnamen Catur Sistem Swiss'}</h2>
            <p className="hero-desc">
              Diselenggarakan resmi oleh <strong>Chess Club Politeknik Sorowako</strong>. Setiap babak
              pemain dipasangkan dengan lawan yang memiliki perolehan poin serupa tanpa pernah
              bertanding dua kali.
            </p>
          </div>

          <div className="hero-actions-group">
            {isAdmin ? (
              <>
                <button
                  onClick={() => {
                    if (onEditParticipants) {
                      onEditParticipants();
                    } else {
                      setIsPlayerModalOpen(true);
                    }
                  }}
                  className="btn-glass-secondary"
                >
                  <Users size={15} style={{ color: 'var(--sky)' }} />
                  <span>Kelola peserta ({players.length})</span>
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
                  <span>Pairing babak {Math.min(currentMaxRound + 1, totalRounds)}</span>
                  <ArrowRight size={15} />
                </button>

              </>
            ) : null}
          </div>
        </div>

        {/* Overall progress */}
        <div className="hero-progress">
          <div className="hero-progress-head">
            <span>Progres turnamen</span>
            <strong>{progressPct}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Round Stepper */}
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
                  onClick={() => hasMatches && setSelectedRoundTab(rNum)}
                  disabled={!hasMatches}
                  className={pillClass}
                >
                  <span>Babak {rNum}</span>
                  {isDone && <CheckCircle2 size={13} />}
                </button>
              );
            })}
          </div>

          <div className="round-status-text">
            {isTournamentFinished ? (
              <span className="finished-chip">
                <Crown size={16} /> Turnamen selesai
              </span>
            ) : (
              <span>
                Babak berjalan:{' '}
                <strong>
                  Babak {selectedRoundTab} dari {totalRounds}
                </strong>
              </span>
            )}
          </div>
        </div>

        <section className="round-schedule-panel" aria-labelledby="round-schedule-title">
          <div className="round-schedule-heading">
            <div>
              <h3 id="round-schedule-title" className="round-schedule-title">
                <Calendar size={17} /> Jadwal tanding per babak
              </h3>
              <p className="round-schedule-description">
                {isAdmin
                  ? 'Atur tanggal dan waktu pertandingan untuk setiap babak.'
                  : 'Jadwal dapat dilihat semua peserta dan diatur oleh admin.'}
              </p>
            </div>
            <span className={`round-schedule-access ${isAdmin ? 'admin' : ''}`}>
              {isAdmin ? 'Kontrol admin' : 'Jadwal publik'}
            </span>
          </div>

          <div className="round-schedule-grid">
            {Array.from({ length: totalRounds }, (_, idx) => {
              const roundNumber = idx + 1;
              const savedSchedule = roundSchedules?.[roundNumber] || '';
              const draftSchedule = roundScheduleDrafts[roundNumber] ?? savedSchedule;
              const hasUnsavedChanges = draftSchedule !== savedSchedule;

              return (
                <div className="round-schedule-item" key={roundNumber}>
                  <div className="round-schedule-round">Babak {roundNumber}</div>
                  {isAdmin ? (
                    <>
                      <label className="round-schedule-input-label" htmlFor={`round-schedule-${roundNumber}`}>
                        Tanggal dan waktu
                      </label>
                      <input
                        id={`round-schedule-${roundNumber}`}
                        className="round-schedule-input"
                        type="datetime-local"
                        value={draftSchedule}
                        onChange={(event) =>
                          setRoundScheduleDrafts((current) => ({
                            ...current,
                            [roundNumber]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="round-schedule-save"
                        disabled={!hasUnsavedChanges}
                        onClick={() => onUpdateRoundSchedule?.(roundNumber, draftSchedule)}
                      >
                        <Save size={14} /> Simpan jadwal
                      </button>
                    </>
                  ) : roundSchedules?.[roundNumber] ? (
                    <div className="round-schedule-time">
                      <Clock3 size={15} />
                      <time dateTime={roundSchedules[roundNumber]}>
                        {formatRoundSchedule(roundSchedules[roundNumber])}
                      </time>
                    </div>
                  ) : (
                    <div className="round-schedule-empty">Jadwal belum ditentukan</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon gold">
            <Users size={22} />
          </div>
          <div>
            <div className="stat-value">{players.length}</div>
            <div className="stat-label">Peserta</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon sky">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="stat-value">{avgElo}</div>
            <div className="stat-label">Rata-rata Elo</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <Swords size={22} />
          </div>
          <div>
            <div className="stat-value">
              {scoredMatches}/{expectedTotal}
            </div>
            <div className="stat-label">Laga selesai</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon navy">
            <Flag size={22} />
          </div>
          <div>
            <div className="stat-value">
              {selectedRoundTab}/{totalRounds}
            </div>
            <div className="stat-label">Babak</div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="swiss-two-col-grid">
        <div className="matches-statistics-column">
          {/* Left: Match Boards */}
          <div className="section-card-panel matches-panel">
          <div className="section-panel-header">
            <div className="section-title-wrap">
              <span className="section-dot" />
              <h3 className="section-title-text">Daftar Match • Babak {selectedRoundTab}</h3>
            </div>
            <span className="section-hint">
              {activeRoundMatches.filter((m) => m.result !== null).length} / {activeRoundMatches.length} laga selesai
            </span>
          </div>

          <div className="matches-list-wrapper">
            {activeRoundMatches.length === 0 ? (
              <div className="empty-state">
                Babak ini belum dipasangkan. Selesaikan pertandingan babak sebelumnya lalu klik{' '}
                <strong>Pairing babak {selectedRoundTab}</strong>.
              </div>
            ) : (
              activeRoundMatches.map((match, idx) => {
                const whiteP = getPlayer(match.whitePlayerId);
                const isBye = match.isBye;
                const blackP = isBye ? null : getPlayer(match.blackPlayerId);
                const whiteWon = match.result === '1-0' && !isBye;
                const blackWon = match.result === '0-1';
                const matchElo = standings.eloReport?.matchDetails.get(match.id);

                return (
                  <div
                    key={match.id}
                    className={`board-match-card ${match.result !== null ? 'is-finished' : ''}`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="board-card-top-bar">
                      <span className="board-number-badge">
                        Match {String(match.boardNumber).padStart(2, '0')}
                      </span>
                      <span
                        className={`board-status-text ${match.result !== null ? 'completed' : 'pending'}`}
                      >
                        {match.result !== null ? (
                          <>
                            <CheckCircle2 size={12} /> Selesai
                          </>
                        ) : (
                          'Menunggu hasil'
                        )}
                      </span>
                    </div>

                    <div className="match-action-grid">
                      {/* White */}
                      <div
                        className={`player-unit player-unit-white ${whiteWon ? 'is-winner' : ''} ${blackWon ? 'is-loser' : ''}`}
                      >
                        <div className="pawn-avatar white-piece" title="Bidak Putih">
                          ♟
                        </div>
                        <div className="player-info-meta">
                          <div className="player-name-line">
                            {whiteP?.title && <span className="title-tag">{whiteP.title}</span>}
                            <span className="player-name-text">{whiteP?.name || 'TBD'}</span>
                          </div>
                          <div className="player-elo-row">
                            <span className="player-elo-text">
                              Elo {matchElo ? matchElo.whiteBefore : (whiteP?.rating ?? 500)}
                            </span>
                            {matchElo && match.result !== null && !isBye && (
                              <span
                                className={`elo-delta-tag ${
                                  matchElo.whiteDelta > 0
                                    ? 'gain'
                                    : matchElo.whiteDelta < 0
                                    ? 'loss'
                                    : 'neutral'
                                }`}
                                title={`Perubahan Elo: ${matchElo.whiteDelta > 0 ? `+${matchElo.whiteDelta}` : matchElo.whiteDelta} (kini: ${matchElo.whiteAfter})`}
                              >
                                {matchElo.whiteDelta > 0 ? `+${matchElo.whiteDelta}` : matchElo.whiteDelta}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="score-control-cell">
                        {isBye ? (
                          <span className="score-bye-badge">1 - 0 (Bye)</span>
                        ) : isAdmin && match.round === currentMaxRound ? (
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
                        ) : (
                          <div className="score-view-container">
                            {match.result === '1-0' ? (
                              <span className="score-view-badge win-white" title="Menang Putih (1 - 0)">
                                1 - 0
                              </span>
                            ) : match.result === '0.5-0.5' ? (
                              <span className="score-view-badge draw" title="Remis (½ - ½)">
                                ½ - ½
                              </span>
                            ) : match.result === '0-1' ? (
                              <span className="score-view-badge win-black" title="Menang Hitam (0 - 1)">
                                0 - 1
                              </span>
                            ) : (
                              <span
                                className="score-view-badge ongoing"
                                title="Pertandingan sedang berlangsung"
                              >
                                VS
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Black */}
                      <div
                        className={`player-unit is-black player-unit-black ${blackWon ? 'is-winner' : ''} ${whiteWon ? 'is-loser' : ''}`}
                      >
                        <div className="player-info-meta">
                          <div className="player-name-line">
                            <span className="player-name-text">
                              {isBye ? 'Bye (libur)' : blackP?.name || 'TBD'}
                            </span>
                            {blackP?.title && <span className="title-tag">{blackP.title}</span>}
                          </div>
                          <div className="player-elo-row">
                            <span className="player-elo-text">
                              {isBye
                                ? 'Poin penuh'
                                : `Elo ${matchElo ? matchElo.blackBefore : (blackP?.rating ?? 500)}`}
                            </span>
                            {matchElo && match.result !== null && !isBye && (
                              <span
                                className={`elo-delta-tag ${
                                  matchElo.blackDelta > 0
                                    ? 'gain'
                                    : matchElo.blackDelta < 0
                                    ? 'loss'
                                    : 'neutral'
                                }`}
                                title={`Perubahan Elo: ${matchElo.blackDelta > 0 ? `+${matchElo.blackDelta}` : matchElo.blackDelta} (kini: ${matchElo.blackAfter})`}
                              >
                                {matchElo.blackDelta > 0 ? `+${matchElo.blackDelta}` : matchElo.blackDelta}
                              </span>
                            )}
                          </div>
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

          <section className="section-card-panel tournament-statistics-panel">
            <div className="section-panel-header">
              <div className="section-title-wrap">
                <span className="section-dot" />
                <h3 className="section-title-text">Statistik Turnamen</h3>
              </div>
              <span className="section-hint">
                {filteredPlayerStandings.length} pemain sesuai filter
              </span>
            </div>

            <label className="form-label statistics-filter-label" htmlFor="statistics-player-filter">
              Filter nama player
            </label>
            <div className="search-box statistics-player-search">
              <Search size={16} aria-hidden="true" />
              <input
                id="statistics-player-filter"
                type="search"
                className="search-input"
                value={statisticsPlayerFilter}
                onChange={(event) => setStatisticsPlayerFilter(event.target.value)}
                placeholder="Cari nama pemain untuk semua diagram..."
              />
              {statisticsPlayerFilter && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Hapus filter nama pemain"
                  onClick={() => setStatisticsPlayerFilter('')}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <p className="statistics-filter-hint">
              Garis menunjukkan akumulasi poin pemain pada setiap babak.
            </p>

            {filteredPlayerStandings.length === 0 ? (
              <div className="empty-state statistics-empty-state" role="status">
                {normalizedStatisticsPlayerFilter
                  ? `Tidak ada pemain yang cocok dengan nama “${statisticsPlayerFilter.trim()}”.`
                  : 'Belum ada pemain untuk divisualisasikan.'}
              </div>
            ) : !hasCompletedStatisticsMatch ? (
              <div className="empty-state statistics-empty-state" role="status">
                Diagram tren poin akan tampil setelah hasil pertandingan pertama dicatat.
              </div>
            ) : (
              <div className="statistics-trend-chart-wrap">
                <svg
                  className="statistics-trend-chart"
                  viewBox="0 0 720 290"
                  role="img"
                  aria-label="Diagram tren akumulasi poin pemain di setiap babak"
                >
                  <rect x="0" y="0" width="720" height="290" rx="12" className="statistics-chart-background" />
                  <text x="18" y="22" className="statistics-chart-axis-title">TREN POIN PEMAIN</text>
                  {chartTicks.map((tick, index) => {
                    const y = 232 - (tick / maxChartPoints) * 188;
                    return (
                      <g key={`tick-${index}`}>
                        <line x1="62" x2="700" y1={y} y2={y} className="statistics-chart-gridline" />
                        <text x="48" y={y + 4} textAnchor="end" className="statistics-chart-tick">
                          {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                  {statisticsRoundNumbers.map((round, index) => {
                    const x = statisticsRoundNumbers.length <= 1
                      ? 381
                      : 62 + (index * 638) / (statisticsRoundNumbers.length - 1);
                    return (
                      <g key={`round-${round}`}>
                        <line x1={x} x2={x} y1="44" y2="232" className="statistics-chart-v-gridline" />
                        <text x={x} y="258" textAnchor="middle" className="statistics-chart-tick">
                          Babak {round}
                        </text>
                      </g>
                    );
                  })}
                  {visiblePlayerPointSeries.map((series) => {
                    const chartPoints = series.points.map((point, index) => {
                      const x = statisticsRoundNumbers.length <= 1
                        ? 381
                        : 62 + (index * 638) / (statisticsRoundNumbers.length - 1);
                      const y = 232 - (point.points / maxChartPoints) * 188;
                      return { x, y, point };
                    });
                    const path = smoothChartPath(chartPoints);
                    const areaPath = chartPoints.length > 0
                      ? `${path} L ${chartPoints[chartPoints.length - 1].x} 232 L ${chartPoints[0].x} 232 Z`
                      : '';

                    return (
                      <g key={series.id}>
                        <defs>
                          <linearGradient id={`statistics-area-${series.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={series.color} stopOpacity="0.28" />
                            <stop offset="100%" stopColor={series.color} stopOpacity="0.015" />
                          </linearGradient>
                        </defs>
                        <path d={areaPath} fill={`url(#statistics-area-${series.id})`} />
                        <path d={path} fill="none" stroke={series.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        {chartPoints.map(({ x, y, point }) => {
                          return (
                            <circle key={`${series.id}-${point.round}`} cx={x} cy={y} r="4" fill={series.color} stroke="white" strokeWidth="2">
                              <title>{`${series.name} • Babak ${point.round}: ${point.points} poin`}</title>
                            </circle>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
                <div className="statistics-chart-legend" aria-label="Legenda pemain">
                  {visiblePlayerPointSeries.map((series) => (
                    <button
                      type="button"
                      key={series.id}
                      className="statistics-chart-legend-item"
                      onClick={() => setStatisticsPlayerFilter(series.name)}
                      title={`Filter diagram ke ${series.name}`}
                    >
                      <span style={{ backgroundColor: series.color }} />
                      {series.name}
                    </button>
                  ))}
                  {hiddenPlayerSeriesCount > 0 && (
                    <span className="statistics-chart-more">+{hiddenPlayerSeriesCount} pemain lain, cari nama untuk melihat</span>
                  )}
                </div>
              </div>
            )}
            <div className="statistics-all-player">
              <div className="statistics-subsection-heading">
                <div>
                  <h4>Ringkasan Semua Pemain</h4>
                  <p>{filteredPlayerStandings.length} dari {standings.rows.length} pemain ditampilkan</p>
                </div>
                <span className="statistics-subsection-mark">WIN · DRAW · LOSS</span>
              </div>

              {filteredPlayerStandings.length === 0 ? (
                <div className="empty-state statistics-empty-state" role="status">
                  Tidak ada player yang cocok dengan filter nama.
                </div>
              ) : (
                <div className="statistics-player-chart-layout">
                  <div className="statistics-outcome-overview">
                    <div className="statistics-outcome-donut-wrap">
                      <svg className="statistics-outcome-donut" viewBox="0 0 112 112" role="img" aria-label="Diagram proporsi hasil pemain yang sedang difilter">
                        <circle cx="56" cy="56" r="43" className="statistics-donut-track" />
                        {totalFilteredResults > 0 && (() => {
                          const segments = [
                            { key: 'wins', value: filteredOutcomeTotals.wins, color: 'var(--green-bright)' },
                            { key: 'draws', value: filteredOutcomeTotals.draws, color: 'var(--gold-bright)' },
                            { key: 'losses', value: filteredOutcomeTotals.losses, color: 'var(--rose)' },
                          ];
                          let offset = 0;
                          return segments.map((segment) => {
                            const length = (segment.value / totalFilteredResults) * donutCircumference;
                            const circle = (
                              <circle
                                key={segment.key}
                                cx="56"
                                cy="56"
                                r="43"
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="13"
                                strokeDasharray={`${length} ${donutCircumference - length}`}
                                strokeDashoffset={-offset}
                                transform="rotate(-90 56 56)"
                              >
                                <title>{`${segment.key === 'wins' ? 'Menang' : segment.key === 'draws' ? 'Remis' : 'Kalah'}: ${segment.value}`}</title>
                              </circle>
                            );
                            offset += length;
                            return circle;
                          });
                        })()}
                        <text x="56" y="53" textAnchor="middle" className="statistics-donut-total">{totalFilteredResults}</text>
                        <text x="56" y="69" textAnchor="middle" className="statistics-donut-caption">hasil pemain</text>
                      </svg>
                      <span className="statistics-donut-label">Komposisi Hasil</span>
                    </div>
                    <div className="statistics-outcome-summary">
                      <div className="statistics-outcome-summary-heading">Total seluruh pemain terpilih</div>
                      <div className="statistics-outcome-stat win">
                        <span><i /> Menang</span><strong>{filteredOutcomeTotals.wins}</strong>
                      </div>
                      <div className="statistics-outcome-stat draw">
                        <span><i /> Remis</span><strong>{filteredOutcomeTotals.draws}</strong>
                      </div>
                      <div className="statistics-outcome-stat loss">
                        <span><i /> Kalah</span><strong>{filteredOutcomeTotals.losses}</strong>
                      </div>
                      <p className="statistics-outcome-note">Bye masuk hitungan menang sesuai perhitungan poin turnamen.</p>
                    </div>
                  </div>

                  <div className="statistics-player-bars" aria-label="Grafik performa seluruh pemain">
                    {filteredPlayerStandings.map((row) => {
                      const resultCount = row.won + row.drawn + row.lost;
                      const winWidth = resultCount ? (row.won / resultCount) * 100 : 0;
                      const drawWidth = resultCount ? (row.drawn / resultCount) * 100 : 0;
                      const lossWidth = resultCount ? (row.lost / resultCount) * 100 : 0;
                      return (
                        <div className="statistics-player-bar-row" key={row.player.id}>
                          <div className="statistics-player-bar-heading">
                            <div className="statistics-player-bar-name-wrap">
                              <span className={`statistics-player-rank ${row.rank <= 3 ? `rank-${row.rank}` : ''}`}>{row.rank}</span>
                              <span className="statistics-player-bar-name">{row.player.name}</span>
                            </div>
                            <div className="statistics-player-bar-metrics">
                              <span className="statistics-player-points">{row.points} <small>poin</small></span>
                              <span className="statistics-player-elo">
                                Elo {row.currentRating ?? row.player.rating ?? 500}
                                {row.ratingChange !== undefined && (
                                  <b className={row.ratingChange > 0 ? 'up' : row.ratingChange < 0 ? 'down' : ''}>
                                    {row.ratingChange > 0 ? `+${row.ratingChange}` : row.ratingChange}
                                  </b>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="statistics-player-result-bar" role="img" aria-label={`${row.player.name}: ${row.won} menang, ${row.drawn} remis, ${row.lost} kalah`}>
                            {row.won > 0 && <span className="win" style={{ width: `${winWidth}%` }} title={`Menang: ${row.won}`} />}
                            {row.drawn > 0 && <span className="draw" style={{ width: `${drawWidth}%` }} title={`Remis: ${row.drawn}`} />}
                            {row.lost > 0 && <span className="loss" style={{ width: `${lossWidth}%` }} title={`Kalah: ${row.lost}`} />}
                            {resultCount === 0 && <span className="empty" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="statistics-result-legend" aria-label="Legenda komposisi hasil">
                    <span><i className="win" /> Menang</span>
                    <span><i className="draw" /> Remis</span>
                    <span><i className="loss" /> Kalah</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right: Podium & Standings */}
        <div className="section-card-panel standings-panel">
          {/* Print-only Page 2 Header */}
          <div className="print-page-header">
            <div className="print-page-title">CHESS CLUB POLITEKNIK SOROWAKO</div>
            <div className="print-page-subtitle">
              {tournamentName || 'Turnamen Catur Sistem Swiss'} • Klasemen Sementara & Podium
            </div>
          </div>

          <div className="section-panel-header">
            <div className="section-title-wrap">
              <Trophy size={18} style={{ color: 'var(--gold)' }} />
              <h3 className="section-title-text">Klasemen Sementara</h3>
            </div>
            <div className="flex-row-center gap-2 no-print">
              {onOpenRules && (
                <button
                  type="button"
                  className="btn-glass-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.35rem' }}
                  onClick={onOpenRules}
                  title="Lihat Formula Elo dengan K dinamis (40, 20, atau 10)"
                >
                  <BookOpen size={13} style={{ color: 'var(--gold)' }} />
                  <span>Aturan & Elo</span>
                </button>
              )}
              <button
                className="btn-glass-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                onClick={handlePrint}
                title="Cetak / simpan klasemen sebagai PDF"
              >
                <Printer size={13} />
                <span>Cetak</span>
              </button>
            </div>
          </div>

          {/* Podium stage: 2 - 1 - 3 */}
          <div className="podium-stage">
            <div className="podium-col rank-2">
              <div className="podium-medal">🥈</div>
              <div className="podium-player-name">{top2?.player.name || '-'}</div>
              <div className="podium-points-tag">{top2?.points || 0} Pts</div>
              {top2 && (
                <div className="podium-elo-tag">
                  Elo {top2.currentRating ?? top2.player.rating ?? 500}
                  {top2.ratingChange ? (
                    <span className={`podium-delta ${top2.ratingChange > 0 ? 'gain' : 'loss'}`}>
                      {top2.ratingChange > 0 ? `+${top2.ratingChange}` : top2.ratingChange}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="podium-pedestal">2</div>
            </div>
            <div className="podium-col rank-1">
              <div className="podium-medal">👑</div>
              <div className="podium-player-name">{top1?.player.name || '-'}</div>
              <div className="podium-points-tag">{top1?.points || 0} Pts</div>
              {top1 && (
                <div className="podium-elo-tag">
                  Elo {top1.currentRating ?? top1.player.rating ?? 500}
                  {top1.ratingChange ? (
                    <span className={`podium-delta ${top1.ratingChange > 0 ? 'gain' : 'loss'}`}>
                      {top1.ratingChange > 0 ? `+${top1.ratingChange}` : top1.ratingChange}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="podium-pedestal">1</div>
            </div>
            <div className="podium-col rank-3">
              <div className="podium-medal">🥉</div>
              <div className="podium-player-name">{top3?.player.name || '-'}</div>
              <div className="podium-points-tag">{top3?.points || 0} Pts</div>
              {top3 && (
                <div className="podium-elo-tag">
                  Elo {top3.currentRating ?? top3.player.rating ?? 500}
                  {top3.ratingChange ? (
                    <span className={`podium-delta ${top3.ratingChange > 0 ? 'gain' : 'loss'}`}>
                      {top3.ratingChange > 0 ? `+${top3.ratingChange}` : top3.ratingChange}
                    </span>
                  ) : null}
                </div>
              )}
              <div className="podium-pedestal">3</div>
            </div>
          </div>

          <div className="swiss-table-responsive">
            <table className="modern-swiss-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>#</th>
                  <th className="left">Pemain</th>
                  <th title="Rating Elo live dengan K dinamis: 40 (<30 laga), 20 (<2400), atau 10 (>=2400)">Elo Live</th>
                  <th>Main</th>
                  <th title="Menang (1 Poin)">M</th>
                  <th title="Remis (0,5 Poin)">R</th>
                  <th title="Kalah (0 Poin)">K</th>
                  <th title="Buchholz (BH): Total poin seluruh lawan yang pernah dihadapi">BH</th>
                  <th title="Sonneborn-Berger (SB): Kualitas kemenangan (100% poin lawan menang + 50% poin lawan remis)">SB</th>
                  <th title="Total Poin Hasil Pertandingan">Poin</th>
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
                    <tr
                      key={row.player.id}
                      className={isLeader ? 'leader-row' : ''}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <td>
                        <span className={rankBadgeClass}>{index + 1}</span>
                      </td>
                      <td className="left">
                        <div className="player-cell">
                          <span className="mini-avatar">{getInitials(row.player.name)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="player-cell-name">{row.player.name}</div>
                            {row.player.club && (
                              <div className="player-cell-club">{row.player.club}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="table-elo-cell" title={`K aktif pemain: ${standings.eloReport?.playerSummaries.get(row.player.id)?.kFactor ?? 20}`}>
                          <span className="elo-live-val">
                            {row.currentRating ?? row.player.rating ?? 500}
                          </span>
                          {row.ratingChange !== undefined && row.ratingChange !== 0 && (
                            <span
                              className={`elo-table-delta ${row.ratingChange > 0 ? 'gain' : 'loss'}`}
                              title={`Rating awal: ${row.initialRating ?? 500} → sekarang: ${row.currentRating ?? 500}`}
                            >
                              {row.ratingChange > 0 ? `+${row.ratingChange}` : row.ratingChange}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{row.played}</td>
                      <td className="num-win">{row.won}</td>
                      <td>{row.drawn}</td>
                      <td className="num-loss">{row.lost}</td>
                      <td className="num-bh" title={`Buchholz: ${row.buchholz || 0}`}>{row.buchholz || 0}</td>
                      <td className="num-bh" style={{ color: 'var(--gold)' }} title={`Sonneborn-Berger: ${row.sonnebornBerger || 0}`}>
                        {row.sonnebornBerger !== undefined ? row.sonnebornBerger : 0}
                      </td>
                      <td>
                        <div className="points-cell">
                          <span className="points-pill">{row.points}</span>
                          <span className="points-bar">
                            <span style={{ width: `${(row.points / maxPoints) * 100}%` }} />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: Kelola Peserta */}
      {isPlayerModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPlayerModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span className="modal-title-icon">
                  <Users size={18} />
                </span>
                Kelola Peserta Turnamen
              </div>
              <button className="icon-btn" onClick={() => setIsPlayerModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="player-add-form">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
                  placeholder="Nama peserta baru"
                  className="form-input-text grow"
                />
                <input
                  type="number"
                  value={newPlayerRating}
                  onChange={(e) => setNewPlayerRating(e.target.value)}
                  placeholder="500 (Default)"
                  className="form-input-text elo-input"
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

              <div className="player-list">
                {players.map((p, idx) => (
                  <div key={p.id} className="player-row">
                    <div className="player-row-left">
                      <span className="player-row-idx">{idx + 1}</span>
                      <span className="mini-avatar">{getInitials(p.name)}</span>
                      <span className="player-row-name">{p.name}</span>
                      <span className="player-row-elo">({p.rating || 500} Elo)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(p.id)}
                      className="danger-icon-btn"
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

