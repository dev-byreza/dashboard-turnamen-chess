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

export type PlayerClubLevel = 'L1' | 'L2' | 'L3' | null;

/**
 * Menentukan level pemain berdasarkan rating Elo dan/atau gelar resmi klub:
 * - L3: Rating >= 1000 Elo (atau gelar L3 / GM / WGM)
 * - L2: Rating 800 - 999 Elo (atau gelar L2 / FM / IM / WIM)
 * - L1: Rating 600 - 799 Elo (atau gelar L1 / CM / NM / WFM / WCM)
 * - null (Rookie): Rating < 600 Elo -> Tanpa badge!
 */
export function getPlayerLevel(rating?: number, explicitTitle?: string): PlayerClubLevel {
  const r = rating ?? DEFAULT_PLAYER_RATING;
  const t = explicitTitle?.trim().toUpperCase();

  if (t === 'L3' || t === 'GM' || t === 'WGM') return 'L3';
  if (t === 'L2' || t === 'FM' || t === 'IM' || t === 'WIM') return 'L2';
  if (t === 'L1' || t === 'CM' || t === 'NM' || t === 'WFM' || t === 'WCM') return 'L1';

  if (r >= 1000) return 'L3';
  if (r >= 800) return 'L2';
  if (r >= 600) return 'L1';
  return null;
}

/**
 * Menghasilkan informasi badge dan styling nama pemain:
 * - Rookie: badgeText = null, isGoldGlowName = false (nama hitam polos tanpa badge)
 * - L1: badgeText = 'L1', badge warna biru muda/langit, nama hitam
 * - L2: badgeText = 'L2', badge warna biru royal solid, nama hitam
 * - L3: badgeText = 'L3', badge emas Clash Royale, nama emas menyala (glow gold)
 */
export function getPlayerBadge(rating?: number, explicitTitle?: string): {
  level: PlayerClubLevel;
  badgeText: string | null;
  badgeClass: string;
  isGoldGlowName: boolean;
} {
  const level = getPlayerLevel(rating, explicitTitle);
  if (level === 'L3') {
    return {
      level: 'L3',
      badgeText: 'L3',
      badgeClass: 'title-tag title-tag-l3',
      isGoldGlowName: true,
    };
  }
  if (level === 'L2') {
    return {
      level: 'L2',
      badgeText: 'L2',
      badgeClass: 'title-tag title-tag-l2',
      isGoldGlowName: false,
    };
  }
  if (level === 'L1') {
    return {
      level: 'L1',
      badgeText: 'L1',
      badgeClass: 'title-tag title-tag-l1',
      isGoldGlowName: false,
    };
  }
  return {
    level: null,
    badgeText: null,
    badgeClass: '',
    isGoldGlowName: false,
  };
}

/**
 * Pemilihan K-factor dinamis berdasarkan level gelar klub:
 * - L3 (1000+ Elo): K = 10 (kasta tertinggi, sangat kokoh)
 * - L2 (800 - 999 Elo): K = 16 (veteran/elit)
 * - L1 (600 - 799 Elo): K = 24 (teruji)
 * - Rookie (< 600 Elo): K = 32 (fleksibel & berkembang cepat)
 */
export function getKFactor(rating: number, ratedGames?: number, explicitTitle?: string): number {
  const level = getPlayerLevel(rating, explicitTitle);
  switch (level) {
    case 'L3':
      return 10;
    case 'L2':
      return 16;
    case 'L1':
      return 24;
    default:
      return 32;
  }
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
