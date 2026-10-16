import { Player, SwissMatch, MatchResult } from '../types/chess';

/**
 * Mekanisme Perhitungan Elo Rating FIDE
 * Sesuai panduan resmi di MEKANISME PERHITUNGAN ELO.md:
 * 
 * Rumus dasar Elo:
 * R' = R + K * (S - E)
 * 
 * Keterangan:
 * - R  = Rating awal pemain
 * - R' = Rating baru pemain setelah pertandingan
 * - S  = Skor hasil pertandingan (1 = Menang, 0.5 = Remis, 0 = Kalah)
 * - E  = Expected score (probabilitas kemenangan teoritis)
 *        E = 1 / (1 + 10^((R_lawan - R) / 400))
 * - K  = Faktor perkembangan FIDE (K = 40 untuk pemain pemula/turnamen terbuka)
 */
export const DEFAULT_PLAYER_RATING = 500;
export const DEFAULT_K_FACTOR = 40;

export interface MatchEloDetail {
  matchId: string;
  round: number;
  whiteId: string;
  blackId: string;
  whiteBefore: number;
  blackBefore: number;
  whiteDelta: number;
  blackDelta: number;
  whiteAfter: number;
  blackAfter: number;
  isBye: boolean;
  // Projected delta if match is still pending
  winWhiteDelta: number;
  drawWhiteDelta: number;
  lossWhiteDelta: number;
}

export interface PlayerEloSummary {
  playerId: string;
  name: string;
  initialRating: number;
  currentRating: number;
  delta: number;
  matchesRated: number;
}

export interface TournamentEloReport {
  playerSummaries: Map<string, PlayerEloSummary>;
  matchDetails: Map<string, MatchEloDetail>;
}

/**
 * FIDE standard expected score formula:
 * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculates rating change for a single game.
 * scoreA: 1 for win, 0.5 for draw, 0 for loss.
 * R' = R + K(S - E)
 */
export function calculateMatchEloChange(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  kFactorA: number = DEFAULT_K_FACTOR,
  kFactorB: number = DEFAULT_K_FACTOR
): { deltaA: number; deltaB: number; expectedA: number; expectedB: number } {
  // Expected score pemain A berdasarkan selisih rating (R_B - R_A)
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  // Expected score pemain B berdasarkan selisih rating (R_A - R_B)
  const expectedB = calculateExpectedScore(ratingB, ratingA);

  const scoreB = 1 - scoreA;

  // Rumus FIDE: R' = R + K * (S - E) => Delta = round(K * (S - E))
  const deltaA = Math.round(kFactorA * (scoreA - expectedA));
  const deltaB = Math.round(kFactorB * (scoreB - expectedB));

  return { deltaA, deltaB, expectedA, expectedB };
}

/**
 * Processes all tournament matches in chronological round order
 * and calculates dynamic round-by-round Elo rating changes.
 */
export function calculateTournamentEloReport(
  players: Player[],
  matches: SwissMatch[],
  kFactor: number = DEFAULT_K_FACTOR
): TournamentEloReport {
  const playerMap = new Map<string, Player>();
  const initialRatings = new Map<string, number>();
  const runningRatings = new Map<string, number>();
  const matchesRatedCount = new Map<string, number>();

  players.forEach((p) => {
    playerMap.set(p.id, p);
    const r = p.rating !== undefined && p.rating !== null ? p.rating : DEFAULT_PLAYER_RATING;
    initialRatings.set(p.id, r);
    runningRatings.set(p.id, r);
    matchesRatedCount.set(p.id, 0);
  });

  // Sort matches chronologically: round asc, boardNumber asc
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.boardNumber - b.boardNumber;
  });

  const matchDetails = new Map<string, MatchEloDetail>();

  for (const match of sortedMatches) {
    const isBye = Boolean(match.isBye || match.blackPlayerId === '__bye__');
    const whiteId = match.whitePlayerId;
    const blackId = match.blackPlayerId;

    const whiteBefore = runningRatings.get(whiteId) ?? DEFAULT_PLAYER_RATING;
    const blackBefore = isBye
      ? whiteBefore
      : (runningRatings.get(blackId) ?? DEFAULT_PLAYER_RATING);

    // Calculate potential projections for pending match
    const projWin = calculateMatchEloChange(whiteBefore, blackBefore, 1, kFactor).deltaA;
    const projDraw = calculateMatchEloChange(whiteBefore, blackBefore, 0.5, kFactor).deltaA;
    const projLoss = calculateMatchEloChange(whiteBefore, blackBefore, 0, kFactor).deltaA;

    if (isBye || !match.result) {
      matchDetails.set(match.id, {
        matchId: match.id,
        round: match.round,
        whiteId,
        blackId,
        whiteBefore,
        blackBefore,
        whiteDelta: 0,
        blackDelta: 0,
        whiteAfter: whiteBefore,
        blackAfter: blackBefore,
        isBye,
        winWhiteDelta: projWin,
        drawWhiteDelta: projDraw,
        lossWhiteDelta: projLoss,
      });
      continue;
    }

    // Determine actual score for white
    let scoreWhite = 0.5;
    if (match.result === '1-0') scoreWhite = 1;
    else if (match.result === '0-1') scoreWhite = 0;
    else if (match.result === '0.5-0.5') scoreWhite = 0.5;

    const { deltaA: deltaWhite, deltaB: deltaBlack } = calculateMatchEloChange(
      whiteBefore,
      blackBefore,
      scoreWhite,
      kFactor
    );

    const whiteAfter = Math.max(100, whiteBefore + deltaWhite);
    const blackAfter = Math.max(100, blackBefore + deltaBlack);

    // Update running ratings
    runningRatings.set(whiteId, whiteAfter);
    runningRatings.set(blackId, blackAfter);

    matchesRatedCount.set(whiteId, (matchesRatedCount.get(whiteId) || 0) + 1);
    matchesRatedCount.set(blackId, (matchesRatedCount.get(blackId) || 0) + 1);

    matchDetails.set(match.id, {
      matchId: match.id,
      round: match.round,
      whiteId,
      blackId,
      whiteBefore,
      blackBefore,
      whiteDelta: deltaWhite,
      blackDelta: deltaBlack,
      whiteAfter,
      blackAfter,
      isBye: false,
      winWhiteDelta: projWin,
      drawWhiteDelta: projDraw,
      lossWhiteDelta: projLoss,
    });
  }

  // Build final player summaries
  const playerSummaries = new Map<string, PlayerEloSummary>();
  players.forEach((p) => {
    const initialRating = initialRatings.get(p.id) ?? DEFAULT_PLAYER_RATING;
    const currentRating = runningRatings.get(p.id) ?? initialRating;
    const delta = currentRating - initialRating;
    const ratedCount = matchesRatedCount.get(p.id) || 0;

    playerSummaries.set(p.id, {
      playerId: p.id,
      name: p.name,
      initialRating,
      currentRating,
      delta,
      matchesRated: ratedCount,
    });
  });

  return { playerSummaries, matchDetails };
}
