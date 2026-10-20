/**
 * Utility for interacting with the public Chess.com API (pubapi)
 * Documentation: https://www.chess.com/news/view/published-data-api
 */

export interface ChessComProfile {
  username: string;
  name?: string;
  title?: string;
  avatar?: string;
  url: string;
  countryCode?: string;
  status?: string;
  joined?: number;
  location?: string;
}

export interface ChessComRatingCategory {
  rating: number;
  date?: number;
  record?: {
    win: number;
    loss: number;
    draw: number;
  };
}

export interface ChessComStats {
  rapid?: ChessComRatingCategory;
  blitz?: ChessComRatingCategory;
  bullet?: ChessComRatingCategory;
  fide?: number;
}

export interface ChessComPlayerDetails {
  profile: ChessComProfile;
  stats: ChessComStats;
  recommendedRating: number;
  bestTitle?: string;
}

export interface ChessComRecentGame {
  url: string;
  pgn: string;
  timeClass: string;
  timeControl: string;
  endTime: number;
  white: {
    username: string;
    rating: number;
    result: string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
  };
  /** Normalized result from the perspective of White: '1-0' | '0-1' | '0.5-0.5' */
  tournamentScore: '1-0' | '0-1' | '0.5-0.5';
  matchedWhiteUser: string;
  matchedBlackUser: string;
}

const USER_AGENT = 'SwissChessTournamentDashboard/1.0 (Politeknik Sorowako Chess Club)';

/**
 * Clean username (lowercase, trim)
 */
export function sanitizeChessComUsername(username: string): string {
  return username.trim().toLowerCase().replace(/^@/, '');
}

/**
 * Fetch public player profile from Chess.com
 */
export async function fetchChessComProfile(rawUsername: string): Promise<ChessComProfile | null> {
  const username = sanitizeChessComUsername(rawUsername);
  if (!username) return null;

  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Chess.com error: ${res.status}`);
    }

    const data = await res.json();
    const countryCode = data.country ? data.country.split('/').pop()?.toUpperCase() : undefined;

    return {
      username: data.username,
      name: data.name || undefined,
      title: data.title || undefined,
      avatar: data.avatar || undefined,
      url: data.url,
      countryCode,
      status: data.status,
      joined: data.joined,
      location: data.location || undefined,
    };
  } catch (err) {
    console.error(`Failed to fetch Chess.com profile for ${username}:`, err);
    return null;
  }
}

/**
 * Fetch player ratings and stats from Chess.com
 */
export async function fetchChessComStats(rawUsername: string): Promise<ChessComStats | null> {
  const username = sanitizeChessComUsername(rawUsername);
  if (!username) return null;

  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const stats: ChessComStats = {};

    if (data.chess_rapid?.last?.rating) {
      stats.rapid = {
        rating: data.chess_rapid.last.rating,
        date: data.chess_rapid.last.date,
        record: data.chess_rapid.record,
      };
    }
    if (data.chess_blitz?.last?.rating) {
      stats.blitz = {
        rating: data.chess_blitz.last.rating,
        date: data.chess_blitz.last.date,
        record: data.chess_blitz.record,
      };
    }
    if (data.chess_bullet?.last?.rating) {
      stats.bullet = {
        rating: data.chess_bullet.last.rating,
        date: data.chess_bullet.last.date,
        record: data.chess_bullet.record,
      };
    }
    if (data.fide) {
      stats.fide = data.fide;
    }

    return stats;
  } catch (err) {
    console.error(`Failed to fetch Chess.com stats for ${username}:`, err);
    return null;
  }
}

/**
 * Fetch combined profile and stats for player autofill
 */
export async function fetchFullChessComPlayer(rawUsername: string): Promise<ChessComPlayerDetails | null> {
  const username = sanitizeChessComUsername(rawUsername);
  if (!username) return null;

  const [profile, stats] = await Promise.all([
    fetchChessComProfile(username),
    fetchChessComStats(username),
  ]);

  if (!profile) return null;

  const resolvedStats = stats || {};

  // Best recommended starting Elo for Swiss Tournament
  // Priority: Rapid > Blitz > Bullet > FIDE > default 500
  const recommendedRating =
    resolvedStats.rapid?.rating ||
    resolvedStats.blitz?.rating ||
    resolvedStats.bullet?.rating ||
    resolvedStats.fide ||
    500;

  return {
    profile,
    stats: resolvedStats,
    recommendedRating,
    bestTitle: profile.title,
  };
}

/**
 * Helper to determine match score from chess.com result strings
 */
function determineScore(whiteResult: string, blackResult: string): '1-0' | '0-1' | '0.5-0.5' {
  if (whiteResult === 'win') return '1-0';
  if (blackResult === 'win') return '0-1';
  return '0.5-0.5';
}

/**
 * Fetch games for a user in a specific month
 */
async function fetchUserMonthlyGames(username: string, year: number, month: number): Promise<any[]> {
  const monthStr = String(month).padStart(2, '0');
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/${year}/${monthStr}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.games) ? data.games : [];
  } catch {
    return [];
  }
}

/**
 * Search recent games between two Chess.com users to automatically populate match score and URL.
 * Checks current month, and optionally previous month if no game is found yet.
 *
 * @param expectedWhiteUser Username expected on White board in Swiss tournament
 * @param expectedBlackUser Username expected on Black board in Swiss tournament
 */
export async function fetchRecentGameBetween(
  expectedWhiteUser: string,
  expectedBlackUser: string
): Promise<ChessComRecentGame | null> {
  const u1 = sanitizeChessComUsername(expectedWhiteUser);
  const u2 = sanitizeChessComUsername(expectedBlackUser);

  if (!u1 || !u2 || u1 === u2) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 1. Fetch current month games
  let games = await fetchUserMonthlyGames(u1, currentYear, currentMonth);

  // 2. Fallback to previous month if early in the month (<= 5 days) or no games found
  if (games.length === 0 || now.getDate() <= 7) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevGames = await fetchUserMonthlyGames(u1, prevYear, prevMonth);
    games = [...games, ...prevGames];
  }

  // Filter games played between u1 and u2
  const mutualGames = games.filter((g) => {
    const whiteName = sanitizeChessComUsername(g.white?.username || '');
    const blackName = sanitizeChessComUsername(g.black?.username || '');
    return (
      (whiteName === u1 && blackName === u2) ||
      (whiteName === u2 && blackName === u1)
    );
  });

  if (mutualGames.length === 0) return null;

  // Sort by end_time DESC (latest finished game first)
  mutualGames.sort((a, b) => (b.end_time || 0) - (a.end_time || 0));
  const latestGame = mutualGames[0];

  const actualWhiteUser = sanitizeChessComUsername(latestGame.white.username);
  const actualBlackUser = sanitizeChessComUsername(latestGame.black.username);

  const whiteResult = latestGame.white.result || '';
  const blackResult = latestGame.black.result || '';
  const rawScore = determineScore(whiteResult, blackResult);

  // Map to the tournament perspective (expectedWhiteUser vs expectedBlackUser)
  let tournamentScore: '1-0' | '0-1' | '0.5-0.5' = rawScore;
  if (actualWhiteUser === u2 && actualBlackUser === u1) {
    // Colors were inverted in the online game
    if (rawScore === '1-0') tournamentScore = '0-1';
    else if (rawScore === '0-1') tournamentScore = '1-0';
    else tournamentScore = '0.5-0.5';
  }

  return {
    url: latestGame.url,
    pgn: latestGame.pgn || '',
    timeClass: latestGame.time_class || 'rapid',
    timeControl: latestGame.time_control || '',
    endTime: latestGame.end_time || 0,
    white: {
      username: latestGame.white.username,
      rating: latestGame.white.rating,
      result: latestGame.white.result,
    },
    black: {
      username: latestGame.black.username,
      rating: latestGame.black.rating,
      result: latestGame.black.result,
    },
    tournamentScore,
    matchedWhiteUser: actualWhiteUser,
    matchedBlackUser: actualBlackUser,
  };
}
