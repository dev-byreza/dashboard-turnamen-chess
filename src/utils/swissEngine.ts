import { Player, SwissMatch, MatchResult, StandingRow } from '../types/chess';
import { calculateTournamentEloReport, TournamentEloReport } from './eloRating';

export interface SwissStandingsResult {
  rows: StandingRow[];
  currentRoundMatches: SwissMatch[];
  completedRounds: number;
  isRoundComplete: boolean;
  eloReport: TournamentEloReport;
}

// Generate Round 1 pairings (Top half vs Bottom half)
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

// Generate Next Round Pairings (Round 2+)
export function generateNextSwissRound(
  roundNumber: number,
  players: Player[],
  allPreviousMatches: SwissMatch[]
): SwissMatch[] {
  // 1. Calculate current standings up to now
  const { rows } = calculateSwissStandings(players, allPreviousMatches);

  // 2. Extract player list sorted by score/rank
  const candidates = rows.map((r) => r.player);
  const n = candidates.length;
  const pairedIds = new Set<string>();
  const matches: SwissMatch[] = [];
  let boardCounter = 1;

  // Handle Bye if odd players: give bye to lowest ranked player who hasn't had a bye yet
  if (n % 2 !== 0) {
    for (let i = candidates.length - 1; i >= 0; i--) {
      const candidate = candidates[i];
      const hadBye = allPreviousMatches.some(
        (m) => m.isBye && (m.whitePlayerId === candidate.id || m.blackPlayerId === candidate.id)
      );
      if (!hadBye) {
        pairedIds.add(candidate.id);
        matches.push({
          id: `swiss_r${roundNumber}_bye_${Date.now()}`,
          round: roundNumber,
          boardNumber: 999, // will re-number later
          whitePlayerId: candidate.id,
          blackPlayerId: '__bye__',
          result: '1-0',
          isBye: true,
        });
        break;
      }
    }
  }

  // 3. Pair remaining players using greedy matching with lookahead
  const toPair = candidates.filter((p) => !pairedIds.has(p.id));

  for (let i = 0; i < toPair.length; i++) {
    const p1 = toPair[i];
    if (pairedIds.has(p1.id)) continue;

    // Find best compatible opponent j > i
    let bestOpponentIndex = -1;

    for (let j = i + 1; j < toPair.length; j++) {
      const p2 = toPair[j];
      if (pairedIds.has(p2.id)) continue;

      if (!havePlayedTogether(p1.id, p2.id, allPreviousMatches)) {
        bestOpponentIndex = j;
        break;
      }
    }

    // Fallback if everyone in queue played (rare in early rounds): pair with first available
    if (bestOpponentIndex === -1) {
      for (let j = i + 1; j < toPair.length; j++) {
        if (!pairedIds.has(toPair[j].id)) {
          bestOpponentIndex = j;
          break;
        }
      }
    }

    if (bestOpponentIndex !== -1) {
      const p2 = toPair[bestOpponentIndex];
      pairedIds.add(p1.id);
      pairedIds.add(p2.id);

      // Determine colors based on color balance
      const c1 = getColorStats(p1.id, allPreviousMatches);
      const c2 = getColorStats(p2.id, allPreviousMatches);

      let p1IsWhite = true;
      if (c1.diff > c2.diff) {
        p1IsWhite = false; // p1 played more whites, give black
      } else if (c1.diff < c2.diff) {
        p1IsWhite = true;
      } else {
        // Equal diff: alternate from p1's last game
        p1IsWhite = c1.lastColor !== 'white';
      }

      matches.push({
        id: `swiss_r${roundNumber}_b${boardCounter}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        round: roundNumber,
        boardNumber: boardCounter++,
        whitePlayerId: p1IsWhite ? p1.id : p2.id,
        blackPlayerId: p1IsWhite ? p2.id : p1.id,
        result: null,
      });
    }
  }

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
  { id: 'p_anxiety99', name: 'Anxiety99', seed: 1, rating: 757, club: 'Politeknik Sorowako' },
  { id: 'p_ziiganteng', name: 'ZiiGanteng', seed: 2, rating: 706, club: 'Politeknik Sorowako' },
  { id: 'p_dewacad', name: 'DEWACAD', seed: 3, rating: 590, club: 'Politeknik Sorowako' },
  { id: 'p_azazeel03', name: 'Azazeel03', seed: 4, rating: 354, club: 'Politeknik Sorowako' },
];

