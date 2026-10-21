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
 * - K  = Faktor perkembangan FIDE (40 untuk <30 laga, 20 untuk rating <2400,
 *        dan 10 untuk rating >=2400)
 */
export const DEFAULT_PLAYER_RATING = 500;
/** Default K used by the standalone calculator API when no player history is supplied. */
export const DEFAULT_K_FACTOR = 20;
export const NEW_PLAYER_K_FACTOR = 40;
export const ESTABLISHED_PLAYER_K_FACTOR = 20;
export const ELITE_PLAYER_K_FACTOR = 10;
export const NEW_PLAYER_RATED_GAME_LIMIT = 30;
export const RATING_FLOOR = 100;

/** FIDE-style K selection using the player's rating, lifetime rated-game count, and titles. */
export function getKFactor(rating: number, ratedGames: number, title?: string): number {
  const completedGames = Number.isFinite(ratedGames) ? Math.max(0, Math.floor(ratedGames)) : 0;
  if (title === 'GM' || title === 'IM') return ELITE_PLAYER_K_FACTOR; // 10
  if (title === 'FM' || title === 'CM' || rating >= 2400) return 16;
  if (completedGames >= NEW_PLAYER_RATED_GAME_LIMIT) {
    if (rating >= 2000) return 16;
    return ESTABLISHED_PLAYER_K_FACTOR; // 20
  }
  // Emerging / Provisional Tier:
  // Pemain dengan rating berkembang di atas 530 memiliki stabilitas K=32,
  // sedangkan pemain pemula memiliki K=40 agar lonjakan awal cepat.
  if (rating >= 530) return 32;
  return NEW_PLAYER_K_FACTOR; // 40
}

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
  whiteKFactor: number;
  blackKFactor: number;
  whiteBonus?: number;
  blackBonus?: number;
}

export interface PlayerEloSummary {
  playerId: string;
  name: string;
  initialRating: number;
  currentRating: number;
  delta: number;
  matchesRated: number;
  kFactor: number;
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
 * Calculates rating change for a single game using Asymmetric K and USCF Performance Bonus.
 * scoreA: 1 for win, 0.5 for draw, 0 for loss.
 * Non-zero sum: Underdogs and outstanding performances earn bonus rating without overly penalizing opponents.
 */
export function calculateMatchEloChange(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  kFactorA: number = DEFAULT_K_FACTOR,
  kFactorB: number = DEFAULT_K_FACTOR
): {
  deltaA: number;
  deltaB: number;
  expectedA: number;
  expectedB: number;
  bonusA: number;
  bonusB: number;
} {
  // Expected score pemain A berdasarkan selisih rating (R_B - R_A)
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  // Expected score pemain B berdasarkan selisih rating (R_A - R_B)
  const expectedB = calculateExpectedScore(ratingB, ratingA);

  const scoreB = 1 - scoreA;

  // Rumus FIDE: R' = R + K * (S - E)
  const rawDeltaA = Math.round(kFactorA * (scoreA - expectedA));
  const rawDeltaB = Math.round(kFactorB * (scoreB - expectedB));

  // USCF Performance & Underdog / Upset Bonus (Sistem Non-Zero Sum):
  let bonusA = 0;
  let bonusB = 0;

  if (scoreA === 1) {
    if (expectedA < 0.5) {
      // Underdog win: bonus sebanding dengan tingkat kejutan
      bonusA = Math.max(1, Math.round((0.5 - expectedA) * 14));
    } else {
      // Dominant win
      bonusA = Math.max(0, Math.round((1 - expectedA) * 2));
    }
  } else if (scoreA === 0.5) {
    // Remis: underdog yang mampu menahan imbang unggulan mendapat bonus apresiasi
    if (expectedA < 0.45) {
      bonusA = Math.max(1, Math.round((0.45 - expectedA) * 10));
    }
    if (expectedB < 0.45) {
      bonusB = Math.max(1, Math.round((0.45 - expectedB) * 10));
    }
  } else if (scoreA === 0) {
    if (expectedB < 0.5) {
      bonusB = Math.max(1, Math.round((0.5 - expectedB) * 14));
    } else {
      bonusB = Math.max(0, Math.round((1 - expectedB) * 2));
    }
  }

  const deltaA = rawDeltaA + bonusA;
  const deltaB = rawDeltaB + bonusB;

  return { deltaA, deltaB, expectedA, expectedB, bonusA, bonusB };
}

/**
 * Processes all tournament matches in chronological round order
 * and calculates dynamic round-by-round Elo rating changes.
 */
export function calculateTournamentEloReport(
  players: Player[],
  matches: SwissMatch[]
): TournamentEloReport {
  const playerMap = new Map<string, Player>();
  const initialRatings = new Map<string, number>();
  const runningRatings = new Map<string, number>();
  const matchesRatedCount = new Map<string, number>();
  const ratedGamesBeforeTournament = new Map<string, number>();

  players.forEach((p) => {
    playerMap.set(p.id, p);
    const r = p.rating !== undefined && p.rating !== null ? p.rating : DEFAULT_PLAYER_RATING;
    initialRatings.set(p.id, r);
    runningRatings.set(p.id, r);
    matchesRatedCount.set(p.id, 0);
    ratedGamesBeforeTournament.set(p.id, Math.max(0, Math.floor(p.ratedGames ?? 0)));
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
    const whitePlayer = playerMap.get(whiteId);
    const blackPlayer = isBye ? undefined : playerMap.get(blackId);
    const whiteGamesBefore = (ratedGamesBeforeTournament.get(whiteId) || 0) + (matchesRatedCount.get(whiteId) || 0);
    const blackGamesBefore = (ratedGamesBeforeTournament.get(blackId) || 0) + (matchesRatedCount.get(blackId) || 0);
    const whiteKFactor = getKFactor(whiteBefore, whiteGamesBefore, whitePlayer?.title);
    const blackKFactor = isBye ? whiteKFactor : getKFactor(blackBefore, blackGamesBefore, blackPlayer?.title);

    // Calculate potential projections for pending match
    const projWin = calculateMatchEloChange(whiteBefore, blackBefore, 1, whiteKFactor, blackKFactor).deltaA;
    const projDraw = calculateMatchEloChange(whiteBefore, blackBefore, 0.5, whiteKFactor, blackKFactor).deltaA;
    const projLoss = calculateMatchEloChange(whiteBefore, blackBefore, 0, whiteKFactor, blackKFactor).deltaA;

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
        whiteKFactor,
        blackKFactor,
      });
      continue;
    }

    // Determine actual score for white
    let scoreWhite = 0.5;
    if (match.result === '1-0') scoreWhite = 1;
    else if (match.result === '0-1') scoreWhite = 0;
    else if (match.result === '0.5-0.5') scoreWhite = 0.5;

    const { deltaA: deltaWhite, deltaB: deltaBlack, bonusA: bonusWhite, bonusB: bonusBlack } = calculateMatchEloChange(
      whiteBefore,
      blackBefore,
      scoreWhite,
      whiteKFactor,
      blackKFactor
    );

    // Apply Rating Floor (minimum 100)
    const whiteAfter = Math.max(RATING_FLOOR, whiteBefore + deltaWhite);
    const blackAfter = Math.max(RATING_FLOOR, blackBefore + deltaBlack);

    const effectiveDeltaWhite = whiteAfter - whiteBefore;
    const effectiveDeltaBlack = blackAfter - blackBefore;

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
      whiteDelta: effectiveDeltaWhite,
      blackDelta: effectiveDeltaBlack,
      whiteAfter,
      blackAfter,
      isBye: false,
      winWhiteDelta: projWin,
      drawWhiteDelta: projDraw,
      lossWhiteDelta: projLoss,
      whiteKFactor,
      blackKFactor,
      whiteBonus: bonusWhite,
      blackBonus: bonusBlack,
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
      kFactor: getKFactor(currentRating, (ratedGamesBeforeTournament.get(p.id) || 0) + ratedCount),
    });
  });

  return { playerSummaries, matchDetails };
}
