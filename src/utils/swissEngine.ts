import { Player, SwissMatch, MatchResult, StandingRow, SwissPairingOverride } from '../types/chess';
import { calculateTournamentEloReport, TournamentEloReport } from './eloRating';

export interface SwissStandingsResult {
  rows: StandingRow[];
  currentRoundMatches: SwissMatch[];
  completedRounds: number;
  isRoundComplete: boolean;
  eloReport: TournamentEloReport;
}

// Generate Round 1 pairings using the standard Dutch-style top-half vs bottom-half split.
export function generateSwissRound1(players: Player[]): SwissMatch[] {
  const sorted = [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.seed - b.seed);
  const n = sorted.length;
  const matches: SwissMatch[] = [];

  const hasOdd = n % 2 !== 0;
  const activePlayers = hasOdd ? sorted.slice(0, n - 1) : sorted;
  const byePlayer = hasOdd ? sorted[n - 1] : null;

  const half = activePlayers.length / 2;
  const topHalf = activePlayers.slice(0, half);
  const bottomHalf = activePlayers.slice(half);

  for (let i = 0; i < half; i++) {
    const p1 = topHalf[i];
    const p2 = bottomHalf[i];
    // Alternate colors: board 1 White=Top, board 2 White=Bottom, etc.
    const isWhiteTop = i % 2 === 0;

    matches.push({
      id: `swiss_r1_b${i + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      round: 1,
      boardNumber: i + 1,
      whitePlayerId: isWhiteTop ? p1.id : p2.id,
      blackPlayerId: isWhiteTop ? p2.id : p1.id,
      result: null,
    });
  }

  // Handle Bye
  if (byePlayer) {
    matches.push({
      id: `swiss_r1_bye_${Date.now()}`,
      round: 1,
      boardNumber: half + 1,
      whitePlayerId: byePlayer.id,
      blackPlayerId: '__bye__',
      result: '1-0', // Bye gets auto-point
      isBye: true,
    });
  }

  return matches;
}

// Check if two players have already played
function havePlayedTogether(p1Id: string, p2Id: string, allMatches: SwissMatch[]): boolean {
  return allMatches.some(
    (m) =>
      (m.whitePlayerId === p1Id && m.blackPlayerId === p2Id) ||
      (m.whitePlayerId === p2Id && m.blackPlayerId === p1Id)
  );
}

// Count how many whites and blacks a player had
function getColorStats(playerId: string, allMatches: SwissMatch[]) {
  let whites = 0;
  let blacks = 0;
  let lastColor: 'white' | 'black' | null = null;

  allMatches.forEach((m) => {
    if (m.whitePlayerId === playerId) {
      whites++;
      lastColor = 'white';
    } else if (m.blackPlayerId === playerId) {
      blacks++;
      lastColor = 'black';
    }
  });

  return { whites, blacks, diff: whites - blacks, lastColor };
}

type PairCandidate = { player: Player; points: number; rank: number };
type Pairing = { p1: PairCandidate; p2: PairCandidate };

function colorPenalty(playerId: string, color: 'white' | 'black', allMatches: SwissMatch[]) {
  const stats = getColorStats(playerId, allMatches);
  const nextDiff = stats.diff + (color === 'white' ? 1 : -1);
  const repeatedColor = stats.lastColor === color ? 3 : 0;
  return Math.abs(nextDiff) * 10 + repeatedColor;
}

function chooseColors(p1: PairCandidate, p2: PairCandidate, allMatches: SwissMatch[]) {
  const p1WhitePenalty =
    colorPenalty(p1.player.id, 'white', allMatches) + colorPenalty(p2.player.id, 'black', allMatches);
  const p2WhitePenalty =
    colorPenalty(p1.player.id, 'black', allMatches) + colorPenalty(p2.player.id, 'white', allMatches);

  return p1WhitePenalty <= p2WhitePenalty
    ? { whitePlayerId: p1.player.id, blackPlayerId: p2.player.id }
    : { whitePlayerId: p2.player.id, blackPlayerId: p1.player.id };
}

function pairingCost(p1: PairCandidate, p2: PairCandidate, allMatches: SwissMatch[]) {
  const rematchPenalty = havePlayedTogether(p1.player.id, p2.player.id, allMatches) ? 100000 : 0;
  const scoreGapPenalty = Math.abs(p1.points - p2.points) * 1000;
  const rankGapPenalty = Math.abs(p1.rank - p2.rank);
  const colors = chooseColors(p1, p2, allMatches);
  const colorPenaltyTotal =
    colorPenalty(
      colors.whitePlayerId,
      'white',
      allMatches
    ) +
    colorPenalty(colors.blackPlayerId, 'black', allMatches);

  return rematchPenalty + scoreGapPenalty + rankGapPenalty + colorPenaltyTotal;
}

/**
 * Find a complete matching while keeping score groups together and avoiding
 * repeat opponents. The bounded search handles the small constrained fields
 * common to this dashboard; the greedy fallback still produces a full draw
 * when a rematch is mathematically unavoidable.
 */
function findPairings(candidates: PairCandidate[], allMatches: SwissMatch[]): Pairing[] {
  let visitedNodes = 0;
  const maxNodes = 100000;

  const search = (remaining: PairCandidate[]): Pairing[] | null => {
    if (remaining.length === 0) return [];
    if (++visitedNodes > maxNodes) return null;

    const p1 = remaining[0];
    const opponents = remaining
      .slice(1)
      .map((p2, index) => ({ p2, index }))
      .sort((a, b) => pairingCost(p1, a.p2, allMatches) - pairingCost(p1, b.p2, allMatches));

    for (const { p2, index } of opponents) {
      const next = remaining.filter((_, i) => i !== 0 && i !== index + 1);
      const tail = search(next);
      if (tail) return [{ p1, p2 }, ...tail];
    }

    return null;
  };

  const result = search(candidates);
  if (result) return result;

  const fallback: Pairing[] = [];
  const remaining = [...candidates];
  while (remaining.length >= 2) {
    const p1 = remaining.shift()!;
    let bestIndex = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (pairingCost(p1, remaining[i], allMatches) < pairingCost(p1, remaining[bestIndex], allMatches)) {
        bestIndex = i;
      }
    }
    const [p2] = remaining.splice(bestIndex, 1);
    fallback.push({ p1, p2 });
  }
  return fallback;
}

// Generate Next Round Pairings (Round 2+)
export function generateNextSwissRound(
  roundNumber: number,
  players: Player[],
  allPreviousMatches: SwissMatch[],
  pairingOverrides: SwissPairingOverride[] = []
): SwissMatch[] {
  // 1. Calculate current standings up to now
  const { rows } = calculateSwissStandings(players, allPreviousMatches);

  // 2. Extract players sorted by score/rank and assign the standard lowest
  // ranked eligible player the bye when the field size is odd.
  const candidates: PairCandidate[] = rows.map((r) => ({
    player: r.player,
    points: r.points,
    rank: r.rank,
  }));
  const matches: SwissMatch[] = [];
  let toPair = candidates;

  // Apply explicit admin pairing data first. This is intentionally allowed to
  // override the normal rematch preference when the tournament data requires it.
  const candidateIds = new Set(candidates.map((candidate) => candidate.player.id));
  const forcedIds = new Set<string>();
  const forcedMatches = pairingOverrides.filter((pairing) => {
    const valid =
      pairing.whitePlayerId !== pairing.blackPlayerId &&
      candidateIds.has(pairing.whitePlayerId) &&
      candidateIds.has(pairing.blackPlayerId) &&
      !forcedIds.has(pairing.whitePlayerId) &&
      !forcedIds.has(pairing.blackPlayerId);
    if (valid) {
      forcedIds.add(pairing.whitePlayerId);
      forcedIds.add(pairing.blackPlayerId);
    }
    return valid;
  });

  if (forcedMatches.length > 0) {
    toPair = candidates.filter((candidate) => !forcedIds.has(candidate.player.id));
    forcedMatches.forEach((pairing, index) => {
      matches.push({
        id: `swiss_r${roundNumber}_forced_b${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        round: roundNumber,
        boardNumber: index + 1,
        whitePlayerId: pairing.whitePlayerId,
        blackPlayerId: pairing.blackPlayerId,
        result: null,
      });
    });
  }

  if (candidates.length % 2 !== 0) {
    const byes = toPair.map((candidate) => ({
      candidate,
      count: allPreviousMatches.filter(
        (m) => m.isBye && (m.whitePlayerId === candidate.player.id || m.blackPlayerId === candidate.player.id)
      ).length,
    }));
    const bye = byes
      .filter((entry) => entry.count === 0)
      .sort((a, b) => b.candidate.rank - a.candidate.rank)[0] ??
      byes.sort((a, b) => a.count - b.count || b.candidate.rank - a.candidate.rank)[0];

    toPair = toPair.filter((candidate) => candidate.player.id !== bye.candidate.player.id);
    matches.push({
      id: `swiss_r${roundNumber}_bye_${Date.now()}`,
      round: roundNumber,
      boardNumber: 999,
      whitePlayerId: bye.candidate.player.id,
      blackPlayerId: '__bye__',
      result: '1-0',
      isBye: true,
    });
  }

  // 3. Pair by score group first, avoid rematches, then use a rematch only
  // when the field has no legal alternative (e.g. four players over five rounds).
  const pairings = findPairings(toPair, allPreviousMatches);
  pairings.forEach(({ p1, p2 }, index) => {
    const colors = chooseColors(p1, p2, allPreviousMatches);
    matches.push({
      id: `swiss_r${roundNumber}_b${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      round: roundNumber,
      boardNumber: matches.filter((match) => !match.isBye).length + index + 1,
      ...colors,
      result: null,
    });
  });

  // Re-order boards so bye is at the bottom
  const regularMatches = matches.filter((m) => !m.isBye);
  const byeMatches = matches.filter((m) => m.isBye);

  regularMatches.forEach((m, idx) => {
    m.boardNumber = idx + 1;
  });
  byeMatches.forEach((m, idx) => {
    m.boardNumber = regularMatches.length + idx + 1;
  });

  return [...regularMatches, ...byeMatches];
}

// Calculate Standings with Buchholz & Sonneborn-Berger
export function calculateSwissStandings(
  players: Player[],
  allMatches: SwissMatch[]
): SwissStandingsResult {
  const stats: Record<
    string,
    {
      played: number;
      won: number;
      drawn: number;
      lost: number;
      points: number;
      opponents: string[];
    }
  > = {};

  players.forEach((p) => {
    stats[p.id] = {
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      opponents: [],
    };
  });

  allMatches.forEach((m) => {
    if (!m.result) return;

    if (m.isBye) {
      if (stats[m.whitePlayerId]) {
        stats[m.whitePlayerId].points += 1;
        stats[m.whitePlayerId].won += 1;
        stats[m.whitePlayerId].played += 1;
      }
      return;
    }

    const white = stats[m.whitePlayerId];
    const black = stats[m.blackPlayerId];
    if (!white || !black) return;

    white.played += 1;
    black.played += 1;
    white.opponents.push(m.blackPlayerId);
    black.opponents.push(m.whitePlayerId);

    if (m.result === '1-0') {
      white.won += 1;
      white.points += 1;
      black.lost += 1;
    } else if (m.result === '0-1') {
      black.won += 1;
      black.points += 1;
      white.lost += 1;
    } else if (m.result === '0.5-0.5') {
      white.drawn += 1;
      white.points += 0.5;
      black.drawn += 1;
      black.points += 0.5;
    }
  });

  // Calculate Buchholz and Sonneborn-Berger
  const buchholzMap: Record<string, number> = {};
  const sbMap: Record<string, number> = {};

  players.forEach((p) => {
    const s = stats[p.id];
    let buchholz = 0;
    let sb = 0;

    s.opponents.forEach((oppId) => {
      const oppPoints = stats[oppId]?.points || 0;
      buchholz += oppPoints;

      // Find match result vs this opponent
      const match = allMatches.find(
        (m) =>
          m.result &&
          ((m.whitePlayerId === p.id && m.blackPlayerId === oppId) ||
            (m.blackPlayerId === p.id && m.whitePlayerId === oppId))
      );

      if (match) {
        const isWhite = match.whitePlayerId === p.id;
        if (
          (isWhite && match.result === '1-0') ||
          (!isWhite && match.result === '0-1')
        ) {
          sb += oppPoints;
        } else if (match.result === '0.5-0.5') {
          sb += oppPoints * 0.5;
        }
      }
    });

    buchholzMap[p.id] = buchholz;
    sbMap[p.id] = sb;
  });

  // Sort standings:
  // 1. Points (desc)
  // 2. Buchholz (desc)
  // 3. Sonneborn-Berger (desc)
  // 4. Wins (desc)
  // 5. Rating / Seed
  const sorted = [...players].sort((a, b) => {
    const sA = stats[a.id];
    const sB = stats[b.id];

    if (sB.points !== sA.points) return sB.points - sA.points;
    if (buchholzMap[b.id] !== buchholzMap[a.id]) return buchholzMap[b.id] - buchholzMap[a.id];
    if (sbMap[b.id] !== sbMap[a.id]) return sbMap[b.id] - sbMap[a.id];
    if (sB.won !== sA.won) return sB.won - sA.won;
    return (b.rating || 0) - (a.rating || 0) || a.seed - b.seed;
  });

  const eloReport = calculateTournamentEloReport(players, allMatches);

  const rows: StandingRow[] = sorted.map((p, idx) => {
    const eloSummary = eloReport.playerSummaries.get(p.id);
    return {
      rank: idx + 1,
      player: p,
      played: stats[p.id].played,
      won: stats[p.id].won,
      drawn: stats[p.id].drawn,
      lost: stats[p.id].lost,
      points: stats[p.id].points,
      buchholz: buchholzMap[p.id],
      sonnebornBerger: sbMap[p.id],
      initialRating: eloSummary?.initialRating ?? p.rating ?? 500,
      currentRating: eloSummary?.currentRating ?? p.rating ?? 500,
      ratingChange: eloSummary?.delta ?? 0,
    };
  });

  // Identify completed rounds
  const rounds = Array.from(new Set(allMatches.map((m) => m.round))).sort((a, b) => a - b);
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : 1;
  const currentRoundMatches = allMatches.filter((m) => m.round === maxRound);
  const isRoundComplete = currentRoundMatches.length > 0 && currentRoundMatches.every((m) => m.result !== null);

  return {
    rows,
    currentRoundMatches,
    completedRounds: isRoundComplete ? maxRound : maxRound - 1,
    isRoundComplete,
    eloReport,
  };
}

// Initial default Swiss data for Chess Club Politeknik Sorowako
export const initialSwissPlayers: Player[] = [
  { id: 'p_anxiety99', name: 'Anxiety99', seed: 1, rating: 500, club: 'Politeknik Sorowako' },
  { id: 'p_ziiganteng', name: 'ZiiGanteng', seed: 2, rating: 706, club: 'Politeknik Sorowako' },
  { id: 'p_dewacad', name: 'DEWACAD', seed: 3, rating: 590, club: 'Politeknik Sorowako' },
  { id: 'p_azazeel03', name: 'Azazeel03', seed: 4, rating: 354, club: 'Politeknik Sorowako' },
];

