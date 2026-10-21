import React, { useState, useMemo, useRef } from 'react';
import { Player, SwissMatch, StandingRow } from '../types/chess';
import { SwissStandingsResult } from '../utils/swissEngine';
import { TrendingUp, Users, Zap } from 'lucide-react';

export interface TournamentStatisticsProps {
  players: Player[];
  matches: SwissMatch[];
  totalRounds: number;
  currentActiveRound: number;
  selectedRoundTab: number;
  standings: SwissStandingsResult;
  biggestEloGain?: StandingRow;
  avgElo: number;
  tournamentLocation?: string;
}

type StatMode = 'laga' | 'pemain' | 'rerata';

interface Point {
  x: number;
  y: number;
}

function segsOf(pts: Point[]): string[] {
  const all: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    all.push(
      ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)},` +
      ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)},` +
      ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    );
  }
  return all;
}

function pathOf(pts: Point[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  return `M ${pts[0].x} ${pts[0].y}` + segsOf(pts).join('');
}

function splinePair(pts: Point[], split: number): { main: string; proj: string } {
  if (pts.length === 0) return { main: '', proj: '' };
  if (pts.length === 1) return { main: `M ${pts[0].x} ${pts[0].y}`, proj: '' };
  const s = segsOf(pts);
  const safeSplit = Math.max(1, Math.min(pts.length, split));
  const main = safeSplit > 1 ? `M ${pts[0].x} ${pts[0].y}` + s.slice(0, safeSplit - 1).join('') : '';
  const proj = safeSplit < pts.length ? `M ${pts[safeSplit - 1].x} ${pts[safeSplit - 1].y}` + s.slice(safeSplit - 1).join('') : '';
  return { main, proj };
}

const PLAYER_COLORS = [
  '#d99a2b', // Royal Gold
  '#3f9a5e', // Board Green
  '#203a5e', // Deep Navy
  '#c2410c', // Crimson Rose
  '#1d6fa5', // Sky Blue
  '#7c3aed', // Royal Violet
];

export const TournamentStatistics: React.FC<TournamentStatisticsProps> = ({
  players,
  matches,
  totalRounds,
  currentActiveRound,
  selectedRoundTab,
  standings,
  biggestEloGain,
  avgElo,
  tournamentLocation,
}) => {
  const [mode, setMode] = useState<StatMode>('laga');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | 'all'>('all');
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    roundIndex: number;
    clientX: number;
    clientY: number;
    rows: Array<{ label: string; value: string; color: string }>;
    isProjected: boolean;
    roundBreakdown?: {
      round: number;
      whiteWins: number;
      draws: number;
      blackWins: number;
      total: number;
    };
  } | null>(null);

  const [activeTooltip, setActiveTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ---- 1. Calculate Completed Rounds and Timeline Data ----
  const {
    playedRoundsCount,
    perRoundBreakdown,
    roundStats,
    overallAvgOutcomes,
    topPlayerSeries,
    avgEloSeries,
  } = useMemo(() => {
    const roundsCount = Math.max(1, totalRounds);

    // Determine how many rounds have any completed matches
    let lastCompletedRound = 0;
    for (let r = 1; r <= roundsCount; r++) {
      const rMatches = matches.filter((m) => m.round === r && !m.isBye);
      if (rMatches.length > 0 && rMatches.some((m) => m.result !== null)) {
        lastCompletedRound = r;
      }
    }
    const played = Math.max(1, lastCompletedRound);

    // Cumulative round-by-round match outcomes (Progres Hasil Laga Kumulatif)
    const whites: number[] = [];
    const draws: number[] = [];
    const blacks: number[] = [];

    // Per-round raw breakdown (for tooltip)
    const perRoundBreakdown: Array<{
      round: number;
      whiteWins: number;
      draws: number;
      blackWins: number;
      total: number;
    }> = [];

    let cumWhiteWins = 0;
    let cumDraws = 0;
    let cumBlackWins = 0;
    let cumTotalScored = 0;

    for (let r = 1; r <= roundsCount; r++) {
      const rMatches = matches.filter(
        (m) => m.round === r && !m.isBye && m.blackPlayerId !== '__bye__'
      );
      const scored = rMatches.filter((m) => m.result !== null);

      const rW = scored.filter((m) => m.result === '1-0').length;
      const rD = scored.filter((m) => m.result === '0.5-0.5').length;
      const rB = scored.filter((m) => m.result === '0-1').length;
      const rTotal = scored.length;

      perRoundBreakdown.push({
        round: r,
        whiteWins: rW,
        draws: rD,
        blackWins: rB,
        total: rTotal,
      });

      if (rTotal > 0) {
        cumWhiteWins += rW;
        cumDraws += rD;
        cumBlackWins += rB;
        cumTotalScored += rTotal;

        const wPct = Math.round((cumWhiteWins / cumTotalScored) * 100);
        const dPct = Math.round((cumDraws / cumTotalScored) * 100);
        const bPct = Math.max(0, 100 - wPct - dPct);

        whites.push(wPct);
        draws.push(dPct);
        blacks.push(bPct);
      } else {
        // Future / unplayed round projection based on cumulative outcomes so far
        if (cumTotalScored > 0) {
          const wPct = Math.round((cumWhiteWins / cumTotalScored) * 100);
          const dPct = Math.round((cumDraws / cumTotalScored) * 100);
          const bPct = Math.max(0, 100 - wPct - dPct);
          whites.push(wPct);
          draws.push(dPct);
          blacks.push(bPct);
        } else {
          whites.push(50);
          draws.push(20);
          blacks.push(30);
        }
      }
    }

    const overallW = cumTotalScored
      ? Math.round((cumWhiteWins / cumTotalScored) * 100)
      : (whites[0] ?? 50);
    const overallD = cumTotalScored
      ? Math.round((cumDraws / cumTotalScored) * 100)
      : (draws[0] ?? 20);
    const overallB = cumTotalScored
      ? Math.max(0, 100 - overallW - overallD)
      : (blacks[0] ?? 30);

    // Player Elo trajectories for all tournament players
    const rankedPlayers = standings.rows.map((row) => row.player);
    const candidatePlayers = rankedPlayers.length > 0 ? rankedPlayers : players;

    const matchDetails = standings.eloReport?.matchDetails;

    const pSeries = candidatePlayers.map((player, pIdx) => {
      const v: number[] = [];
      const baseRating = player.rating ?? 500;
      let lastKnown = baseRating;

      for (let r = 1; r <= roundsCount; r++) {
        // Find match of this round for player
        const rMatch = matches.find(
          (m) =>
            m.round === r &&
            (m.whitePlayerId === player.id || m.blackPlayerId === player.id)
        );

        if (rMatch && matchDetails && matchDetails.has(rMatch.id)) {
          const detail = matchDetails.get(rMatch.id)!;
          if (rMatch.result !== null) {
            lastKnown =
              detail.whiteId === player.id ? detail.whiteAfter : detail.blackAfter;
          }
        }
        v.push(lastKnown);
      }

      return {
        id: player.id,
        name: player.name.split(' ')[0] || player.name,
        fullName: player.name,
        color: PLAYER_COLORS[pIdx % PLAYER_COLORS.length],
        v: v.slice(0, played),
        p: v.slice(played),
        all: v,
        currentRating: Math.round(v[played - 1] ?? baseRating),
      };
    });

    // Average Elo across rounds
    const avgV: number[] = [];
    for (let r = 0; r < roundsCount; r++) {
      if (pSeries.length > 0) {
        const sum = pSeries.reduce((acc, s) => acc + (s.all[r] ?? 500), 0);
        avgV.push(Math.round(sum / pSeries.length));
      } else {
        avgV.push(avgElo || 500);
      }
    }

    return {
      playedRoundsCount: played,
      perRoundBreakdown,
      roundStats: {
        whites,
        draws,
        blacks,
      },
      overallAvgOutcomes: {
        white: overallW,
        draw: overallD,
        black: overallB,
        whiteCount: cumWhiteWins,
        drawCount: cumDraws,
        blackCount: cumBlackWins,
        total: cumTotalScored,
      },
      topPlayerSeries: pSeries,
      avgEloSeries: {
        v: avgV.slice(0, played),
        p: avgV.slice(played),
        all: avgV,
      },
    };
  }, [matches, totalRounds, standings, players, avgElo]);

  // ---- 1.5 Calculate Dynamic Highest Elo Gain for Active / Selected Round ----
  const bestRoundEloGain = useMemo(() => {
    const matchDetails = standings.eloReport?.matchDetails;
    if (!matchDetails) return null;

    // Target round: prefer selectedRoundTab, fallback to currentActiveRound or latest completed round
    const targetRound = selectedRoundTab || currentActiveRound || 1;
    let roundToUse = targetRound;

    let roundCompletedMatches = matches.filter(
      (m) => m.round === roundToUse && !m.isBye && m.result !== null
    );

    // If selected round has no completed matches, fallback to latest round with results
    if (roundCompletedMatches.length === 0) {
      for (let r = totalRounds; r >= 1; r--) {
        const testMatches = matches.filter(
          (m) => m.round === r && !m.isBye && m.result !== null
        );
        if (testMatches.length > 0) {
          roundToUse = r;
          roundCompletedMatches = testMatches;
          break;
        }
      }
    }

    if (roundCompletedMatches.length === 0) {
      return {
        round: targetRound,
        player: null as Player | null,
        delta: 0,
        ratingAfter: 0,
      };
    }

    interface Candidate {
      player: Player;
      delta: number;
      ratingAfter: number;
    }

    const candidates: Candidate[] = [];

    roundCompletedMatches.forEach((match) => {
      const detail = matchDetails.get(match.id);
      if (!detail) return;

      if (detail.whiteDelta > 0) {
        const whitePlayer = players.find((p) => p.id === detail.whiteId);
        if (whitePlayer) {
          candidates.push({
            player: whitePlayer,
            delta: detail.whiteDelta,
            ratingAfter: detail.whiteAfter,
          });
        }
      }

      if (detail.blackDelta > 0) {
        const blackPlayer = players.find((p) => p.id === detail.blackId);
        if (blackPlayer) {
          candidates.push({
            player: blackPlayer,
            delta: detail.blackDelta,
            ratingAfter: detail.blackAfter,
          });
        }
      }
    });

    candidates.sort((a, b) => b.delta - a.delta);

    return {
      round: roundToUse,
      player: candidates[0]?.player ?? null,
      delta: candidates[0]?.delta ?? 0,
      ratingAfter: candidates[0]?.ratingAfter ?? 0,
    };
  }, [matches, players, standings, selectedRoundTab, currentActiveRound, totalRounds]);

  // ---- 2. Chart Layout & Coordinate Calculations (Enhanced Height & Dimensions) ----
  const W = 620;
  const H = 260; // Taller frame so curves and data points have ample breathing room
  const mL = 34;
  const mR = 64; // Compact right margin for latest Elo rating numbers
  const mT = 18;
  const mB = 28;
  const iw = W - mL - mR;
  const ih = H - mT - mB;

  const chartData = useMemo(() => {
    let seriesList: Array<{
      color: string;
      v: number[];
      p: number[];
      label: string;
      endLabel?: string;
    }> = [];
    let yMin = 0;
    let yMax = 100;
    let suffix = '%';

    if (mode === 'laga') {
      seriesList = [
        {
          color: '#b9c0c9',
          v: roundStats.whites.slice(0, playedRoundsCount),
          p: roundStats.whites.slice(playedRoundsCount),
          label: 'Putih',
          endLabel: 'Putih',
        },
        {
          color: '#e8a322',
          v: roundStats.draws.slice(0, playedRoundsCount),
          p: roundStats.draws.slice(playedRoundsCount),
          label: 'Remis',
          endLabel: 'Remis',
        },
        {
          color: '#203a5e',
          v: roundStats.blacks.slice(0, playedRoundsCount),
          p: roundStats.blacks.slice(playedRoundsCount),
          label: 'Hitam',
          endLabel: 'Hitam',
        },
      ];
      yMin = 0;
      yMax = 100;
      suffix = '%';
    } else if (mode === 'pemain') {
      const filtered =
        selectedPlayerId === 'all'
          ? topPlayerSeries.slice(0, Math.min(topPlayerSeries.length, 6))
          : topPlayerSeries.filter((p) => p.id === selectedPlayerId);

      const activePlayers =
        filtered.length > 0 ? filtered : topPlayerSeries.slice(0, 5);

      seriesList = activePlayers.map((p) => {
        const latestRating = Math.round(
          p.all[playedRoundsCount - 1] ?? p.all[0] ?? 500
        );
        return {
          color: p.color,
          v: p.v,
          p: p.p,
          label: p.name,
          endLabel: `${latestRating}`,
        };
      });

      const allVals = seriesList.flatMap((s) => [...s.v, ...s.p]);
      const minVal = allVals.length ? Math.min(...allVals) : 480;
      const maxVal = allVals.length ? Math.max(...allVals) : 540;
      yMin = Math.max(0, minVal - 10);
      yMax = maxVal + 10;
      suffix = ' Elo';
    } else {
      const latestAvg = Math.round(
        avgEloSeries.all[playedRoundsCount - 1] ?? avgEloSeries.all[0] ?? avgElo
      );
      seriesList = [
        {
          color: '#d99a2b',
          v: avgEloSeries.v,
          p: avgEloSeries.p,
          label: 'Rerata',
          endLabel: `${latestAvg}`,
        },
      ];
      const allVals = [...avgEloSeries.v, ...avgEloSeries.p];
      const minVal = allVals.length ? Math.min(...allVals) : 480;
      const maxVal = allVals.length ? Math.max(...allVals) : 540;
      yMin = Math.max(0, minVal - 8);
      yMax = maxVal + 8;
      suffix = ' Elo';
    }

    const rounds = Math.max(1, totalRounds);
    const getX = (i: number) =>
      rounds > 1 ? mL + (i / (rounds - 1)) * iw : mL + iw / 2;
    const getY = (val: number) =>
      mT + ih - ((val - yMin) / (yMax - yMin || 1)) * ih;

    const valAt = (s: { v: number[]; p: number[] }, i: number) =>
      i < playedRoundsCount ? s.v[i] ?? 0 : s.p[i - playedRoundsCount] ?? 0;

    // Generate spline curves & endpoints
    const mats = seriesList.map((s) => {
      const fullVals = [...s.v, ...s.p];
      const fullPts = fullVals.map((v, i) => ({ x: getX(i), y: getY(v) }));
      const mv = s.v.map((v, i) => ({ x: getX(i), y: getY(v) }));
      return {
        mv,
        full: fullPts,
        spline: splinePair(fullPts, playedRoundsCount),
      };
    });

    // Anti-collision label positioning on right margin (shows latest Elo rating on mode pemain)
    const ends = mats
      .map((m, si) => ({
        text: seriesList[si].endLabel ?? seriesList[si].label,
        color: seriesList[si].color,
        x: m.full[m.full.length - 1]?.x ?? W - mR,
        y: m.full[m.full.length - 1]?.y ?? H / 2,
      }))
      .sort((a, b) => a.y - b.y);

    ends.forEach((e2, i) => {
      if (i > 0 && e2.y - ends[i - 1].y < 13) {
        e2.y = ends[i - 1].y + 13;
      }
    });
    const over = ends[ends.length - 1]?.y - (H - mB - 4);
    if (over > 0) {
      ends.forEach((e2) => (e2.y -= over));
    }

    return {
      seriesList,
      yMin,
      yMax,
      suffix,
      getX,
      getY,
      valAt,
      mats,
      ends,
      rounds,
    };
  }, [
    mode,
    selectedPlayerId,
    roundStats,
    playedRoundsCount,
    topPlayerSeries,
    avgEloSeries,
    totalRounds,
    iw,
    ih,
    avgElo,
  ]);

  // Hover crosshair handler
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const step = iw / Math.max(1, chartData.rounds - 1);
    const roundIdx = Math.max(
      0,
      Math.min(chartData.rounds - 1, Math.round((mx - mL) / (step || 1)))
    );

    const rows = chartData.seriesList.map((s) => ({
      label: s.label,
      value: `${Math.round(chartData.valAt(s, roundIdx))}${chartData.suffix}`,
      color: s.color,
    }));

    const bd = perRoundBreakdown[roundIdx];

    setHoverInfo({
      x: chartData.getX(roundIdx),
      roundIndex: roundIdx,
      clientX: e.clientX,
      clientY: e.clientY,
      rows,
      isProjected: roundIdx >= playedRoundsCount,
      roundBreakdown: bd && bd.total > 0 ? bd : undefined,
    });
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  return (
    <section
      ref={containerRef}
      className="section-card-panel round-statistics-panel stat-card-redesign"
      aria-labelledby="round-statistics-title"
    >
      {/* ── 1. Header (Statistik & Info Turnamen + Round Dots Pill) ── */}
      <div className="stat-head">
        <svg
          className="stat-mark"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M7 20h10M9 20c0-4-4-5-4-9a7 7 0 0 1 14 0c0 4-4 5-4 9" />
          <path d="M10 8l2 3 2-3" />
        </svg>
        <h3 id="round-statistics-title" className="stat-title">
          STATISTIK &amp; INFO TURNAMEN
        </h3>

        {/* Round progress dots pill */}
        <div className="stat-pill" title="Indikator progres babak turnamen">
          <span className="stat-round-dots">
            {Array.from({ length: Math.max(1, totalRounds) }).map((_, idx) => {
              const r = idx + 1;
              const isDone = r <= playedRoundsCount;
              const isNow = r === currentActiveRound;
              return (
                <span
                  key={r}
                  className={`stat-rdot ${isDone ? 'done' : ''} ${isNow ? 'now' : ''}`}
                  onMouseEnter={(e) =>
                    setActiveTooltip({
                      text: `Babak ${r} — ${isDone ? 'Selesai' : isNow ? 'Berlangsung' : 'Belum'}`,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => setActiveTooltip(null)}
                />
              );
            })}
          </span>
        </div>
      </div>

      {/* ── 2. Inner Panel with Mode Switcher, Filter & Taller Spline Chart ── */}
      <div className="stat-panel">
        <div className="stat-panel-head">
          <svg
            className="stat-play-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 5l6 3-6 3V5zm7 0l6 3-6 3V5z" />
          </svg>
          <span className="stat-ttl">
            {mode === 'laga'
              ? 'Hasil laga tiap babak (kumulatif)'
              : mode === 'pemain'
              ? 'Elo per peserta tiap babak'
              : 'Rerata Elo peserta tiap babak'}
          </span>

          {/* Segmented Mode Switcher */}
          <span className="stat-seg" role="tablist" aria-label="Mode Statistik">
            <button
              type="button"
              className={mode === 'laga' ? 'on' : ''}
              onClick={() => setMode('laga')}
              title="Hasil laga tiap babak — Putih / Remis / Hitam"
              aria-label="Mode Laga"
              aria-selected={mode === 'laga'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5l6 3-6 3V5zm7 0l6 3-6 3V5z" />
              </svg>
            </button>
            <button
              type="button"
              className={mode === 'pemain' ? 'on' : ''}
              onClick={() => setMode('pemain')}
              title="Elo per peserta tiap babak"
              aria-label="Mode Pemain"
              aria-selected={mode === 'pemain'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.4" />
                <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
                <path d="M16 7h5M16 11h5" />
              </svg>
            </button>
            <button
              type="button"
              className={mode === 'rerata' ? 'on' : ''}
              onClick={() => setMode('rerata')}
              title="Rerata Elo peserta tiap babak"
              aria-label="Mode Rerata Elo"
              aria-selected={mode === 'rerata'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l5-6 4 4 8-9" />
                <path d="M15 6h5v5" />
              </svg>
            </button>
          </span>
        </div>

        {/* ── Subheader Controls / Filters (Replaces old diagram batang) ── */}
        {mode === 'pemain' ? (
          <div className="stat-filter-wrap" role="region" aria-label="Filter Peserta">
            <div className="stat-filter-label">
              <Users size={13} />
              <span>Filter Peserta:</span>
            </div>
            <div className="stat-filter-chips">
              <button
                type="button"
                className={`stat-filter-chip ${selectedPlayerId === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedPlayerId('all')}
                title="Tampilkan semua peserta teratas"
              >
                <span>Semua ({topPlayerSeries.length})</span>
              </button>
              {topPlayerSeries.map((p) => {
                const isSelected = selectedPlayerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`stat-filter-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedPlayerId(isSelected ? 'all' : p.id)}
                    title={`${p.fullName} — Rating terkini: ${p.currentRating} Elo`}
                    style={
                      isSelected
                        ? { borderColor: p.color, background: `${p.color}18`, color: p.color }
                        : undefined
                    }
                  >
                    <span className="stat-dot" style={{ background: p.color }} />
                    <span className="stat-filter-name">{p.name}</span>
                    <span className="stat-filter-elo">{p.currentRating}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : mode === 'laga' ? (
          <div className="stat-legend-laga">
            <span
              className="stat-chip"
              onMouseEnter={(e) =>
                setActiveTooltip({
                  text: `Total kemenangan bidak putih: ${overallAvgOutcomes.white}% (${overallAvgOutcomes.whiteCount} dari ${overallAvgOutcomes.total} laga)`,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <span className="stat-dot w" />
              <span>Putih · {overallAvgOutcomes.white}%</span>
            </span>
            <span
              className="stat-chip"
              onMouseEnter={(e) =>
                setActiveTooltip({
                  text: `Total hasil remis: ${overallAvgOutcomes.draw}% (${overallAvgOutcomes.drawCount} dari ${overallAvgOutcomes.total} laga)`,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <span className="stat-dot d" />
              <span>Remis · {overallAvgOutcomes.draw}%</span>
            </span>
            <span
              className="stat-chip"
              onMouseEnter={(e) =>
                setActiveTooltip({
                  text: `Total kemenangan bidak hitam: ${overallAvgOutcomes.black}% (${overallAvgOutcomes.blackCount} dari ${overallAvgOutcomes.total} laga)`,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <span className="stat-dot b" />
              <span>Hitam · {overallAvgOutcomes.black}%</span>
            </span>
          </div>
        ) : (
          <div className="stat-legend-rerata">
            <span
              className="stat-chip"
              onMouseEnter={(e) =>
                setActiveTooltip({
                  text: `Rerata Elo seluruh peserta saat ini: ${avgElo} Elo`,
                  x: e.clientX,
                  y: e.clientY,
                })
              }
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <span className="stat-dot" style={{ background: '#d99a2b' }} />
              <span>Rerata Elo Peserta Turnamen ({avgElo} Elo)</span>
            </span>
          </div>
        )}

        {/* ── 3. Core SVG Interactive Spline Chart (Taller H=260) ── */}
        <svg
          ref={svgRef}
          className="stat-chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {chartData.seriesList.map((s, si) => (
              <linearGradient
                key={si}
                id={`stat-grad-${si}`}
                x1="0"
                y1={mT}
                x2="0"
                y2={H - mB}
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor={s.color}
                  stopOpacity={mode === 'laga' ? 0.22 : 0.35}
                />
                <stop offset="60%" stopColor={s.color} stopOpacity={0.08} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines & Y-axis labels */}
          {[0, 1, 2, 3, 4].map((t) => {
            const val =
              chartData.yMin +
              ((chartData.yMax - chartData.yMin) * t) / 4;
            const yPos = chartData.getY(val);
            return (
              <g key={t}>
                <line
                  x1={mL}
                  x2={W - mR}
                  y1={yPos}
                  y2={yPos}
                  className="stat-grid-l"
                />
                <text x={2} y={yPos + 3.5} className="stat-axis">
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* X-axis round vertical lines & labels */}
          {Array.from({ length: chartData.rounds }).map((_, i) => {
            const xPos = chartData.getX(i);
            return (
              <g key={i}>
                <line
                  x1={xPos}
                  x2={xPos}
                  y1={mT}
                  y2={H - mB}
                  stroke="#efe8d8"
                  strokeWidth="1"
                />
                <text x={xPos - 4} y={H - 8} className="stat-axlab">
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* Projection Divider Line */}
          {playedRoundsCount < chartData.rounds && (
            <>
              <line
                x1={
                  (chartData.getX(playedRoundsCount - 1) +
                    chartData.getX(playedRoundsCount)) /
                  2
                }
                x2={
                  (chartData.getX(playedRoundsCount - 1) +
                    chartData.getX(playedRoundsCount)) /
                  2
                }
                y1={mT}
                y2={H - mB}
                stroke="#c9b98a"
                strokeWidth="1.3"
                strokeDasharray="5 4"
                opacity="0.75"
              />
              <text
                x={W - mR - 58}
                y={H - 8}
                className="stat-axlab"
                style={{ fontSize: '9px', fontStyle: 'italic', fill: '#b4a98c' }}
              >
                ← proyeksi
              </text>
            </>
          )}

          {/* Gradient Area under curves */}
          {chartData.mats.map((m, si) => (
            <path
              key={`grad-${si}`}
              d={
                pathOf(m.full) +
                ` L ${m.full[m.full.length - 1]?.x ?? W - mR} ${H - mB} L ${
                  m.mv[0]?.x ?? mL
                } ${H - mB} Z`
              }
              fill={`url(#stat-grad-${si})`}
            />
          ))}

          {/* Spline Lines: Solid (played) + Dashed (projected) */}
          {chartData.mats.map((m, si) => {
            const s = chartData.seriesList[si];
            return (
              <g key={`line-${si}`}>
                {m.spline.main && (
                  <path
                    d={m.spline.main}
                    stroke={s.color}
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={mode === 'pemain' && si !== 0 ? 0.88 : 1}
                  />
                )}
                {m.spline.proj && (
                  <path
                    d={m.spline.proj}
                    stroke={s.color}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                    opacity="0.55"
                  />
                )}
                {/* Dots on played rounds */}
                {m.mv.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={4.2}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    className="stat-pt"
                  />
                ))}
              </g>
            );
          })}

          {/* Right margin end labels with anti-collision (latest Elo rating on mode pemain) */}
          {chartData.ends.map((end, i) => (
            <text
              key={i}
              x={end.x + 8}
              y={end.y + 4}
              fill={end.color}
              style={{
                font: '700 11.5px "Segoe UI", Montserrat, sans-serif',
              }}
            >
              {end.text}
            </text>
          ))}

          {/* Hover Crosshair Guide & Markers */}
          {hoverInfo && (
            <g pointerEvents="none">
              <line
                x1={hoverInfo.x}
                x2={hoverInfo.x}
                y1={mT}
                y2={H - mB}
                className="stat-guide"
              />
              {chartData.seriesList.map((s, si) => {
                const yVal = chartData.getY(
                  chartData.valAt(s, hoverInfo.roundIndex)
                );
                return (
                  <circle
                    key={si}
                    cx={hoverInfo.x}
                    cy={yVal}
                    r={6.2}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="1.6"
                  />
                );
              })}
            </g>
          )}

          {/* Interactive Mouse Capture Area */}
          <rect
            x={mL}
            y={mT}
            width={iw}
            height={ih}
            fill="transparent"
            className="stat-hover-pad"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </svg>

        {/* Foot Round Indicators */}
        <div className="stat-foot" aria-hidden="true">
          {Array.from({ length: Math.max(1, totalRounds) }).map((_, rIdx) => {
            const isDone = rIdx < playedRoundsCount;
            const isNow = rIdx === playedRoundsCount && playedRoundsCount < totalRounds;
            return (
              <span
                key={rIdx}
                className={`stat-rdot ${isDone ? 'done' : ''} ${isNow ? 'now' : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* ── 4. Tournament Highlights (Preserved & Enhanced) ── */}
      <div className="round-statistics-highlights">
        <article className="round-statistics-highlight elo-gain-highlight">
          <span className="round-statistics-icon gain">
            <TrendingUp size={19} />
          </span>
          <div className="round-statistics-highlight-copy">
            <span className="round-statistics-label">Lonjakan Elo (Total Turnamen)</span>
            {biggestEloGain ? (
              <>
                <strong>
                  {biggestEloGain.player.name}{' '}
                  <em>+{biggestEloGain.ratingChange} Elo</em>
                </strong>
                <span>
                  Elo baru: {biggestEloGain.currentRating ?? biggestEloGain.player.rating ?? 500}
                  {biggestEloGain.player.title ? ` (${biggestEloGain.player.title})` : ''}
                </span>
              </>
            ) : (
              <>
                <strong>Belum ada kenaikan</strong>
                <span>Perubahan muncul setelah hasil tercatat</span>
              </>
            )}
          </div>
        </article>

        <article className="round-statistics-highlight round-gain-highlight">
          <span className="round-statistics-icon format">
            <Zap size={19} />
          </span>
          <div className="round-statistics-highlight-copy">
            <span className="round-statistics-label">
              Lonjakan Elo Babak {bestRoundEloGain?.round || currentActiveRound}
            </span>
            {bestRoundEloGain?.player && bestRoundEloGain.delta > 0 ? (
              <>
                <strong>
                  {bestRoundEloGain.player.name}{' '}
                  <em>+{bestRoundEloGain.delta} Elo</em>
                </strong>
                <span>
                  Elo baru: {bestRoundEloGain.ratingAfter}
                  {bestRoundEloGain.player.title ? ` (${bestRoundEloGain.player.title})` : ''} • Laga Babak {bestRoundEloGain.round}
                </span>
              </>
            ) : (
              <>
                <strong>Belum ada kenaikan</strong>
                <span>
                  {bestRoundEloGain?.round
                    ? `Menunggu laga Babak ${bestRoundEloGain.round} selesai`
                    : 'Perubahan tampil setelah hasil dicatat'}
                </span>
              </>
            )}
          </div>
        </article>
      </div>

      {/* ── Floating Hover Tooltip (Chart crosshair) ── */}
      {hoverInfo && (
        <div
          className="stat-floating-tip"
          style={{
            left: `${hoverInfo.clientX}px`,
            top: `${hoverInfo.clientY}px`,
          }}
        >
          <div className="stat-tip-header">
            <b>Babak {hoverInfo.roundIndex + 1}</b>
            {hoverInfo.isProjected ? (
              <span className="stat-tip-proj"> (proyeksi)</span>
            ) : mode === 'laga' ? (
              <span className="stat-tip-proj"> (kumulatif)</span>
            ) : null}
          </div>
          {hoverInfo.rows.map((row, i) => (
            <div key={i} className="stat-tip-row">
              <span className="stat-dot" style={{ background: row.color }} />
              <span className="stat-tip-label">{row.label}</span>
              <b>{row.value}</b>
            </div>
          ))}
          {mode === 'laga' && hoverInfo.roundBreakdown && (
            <div className="stat-tip-breakdown">
              Babak {hoverInfo.roundIndex + 1} saja: {hoverInfo.roundBreakdown.whiteWins} Putih • {hoverInfo.roundBreakdown.blackWins} Hitam{hoverInfo.roundBreakdown.draws > 0 ? ` • ${hoverInfo.roundBreakdown.draws} Remis` : ''}
            </div>
          )}
        </div>
      )}

      {/* ── Simple Floating Tooltip (Legend / Round dots) ── */}
      {activeTooltip && (
        <div
          className="stat-floating-tip"
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
          }}
        >
          <span>{activeTooltip.text}</span>
        </div>
      )}
    </section>
  );
};
