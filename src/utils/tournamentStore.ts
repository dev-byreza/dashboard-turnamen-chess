import { Player, Tournament, TournamentStore } from '../types/chess';

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Resolve a tournament's players from the roster, in order, with fresh seeds. */
export function playersForTournament(roster: Player[], t: Tournament): Player[] {
  return t.playerIds
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .map((p, i) => ({
      ...p,
      seed: i + 1,
      rating: t.initialRatings?.[p.id] ?? p.rating ?? 500,
      ratedGames: t.initialRatedGames?.[p.id] ?? p.ratedGames ?? 0,
    }));
}

/** Count completed, rated games from tournaments outside the one being calculated. */
export function countCompletedGamesInOtherTournaments(
  tournaments: Tournament[],
  currentTournamentId: string
): Map<string, number> {
  const counts = new Map<string, number>();

  tournaments
    .filter((tournament) => tournament.id !== currentTournamentId)
    .forEach((tournament) => {
      tournament.matches.forEach((match) => {
        if (match.isBye || match.blackPlayerId === '__bye__' || match.result === null) return;
        counts.set(match.whitePlayerId, (counts.get(match.whitePlayerId) || 0) + 1);
        counts.set(match.blackPlayerId, (counts.get(match.blackPlayerId) || 0) + 1);
      });
    });

  return counts;
}

export function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}

export function hasStarted(t: Tournament): boolean {
  const maxRound = t.matches.reduce((m, x) => Math.max(m, x.round), 1);
  return maxRound > 1 || t.matches.some((m) => !m.isBye && m.result !== null);
}

/**
 * Preserve Elo and rated-game baselines for tournaments that were already
 * running before their snapshot fields were introduced.
 */
export function ensureInitialRatings(store: TournamentStore): TournamentStore {
  let changed = false;
  const tournaments = store.tournaments.map((t) => {
    if (!hasStarted(t)) return t;

    const needsInitialRatings = !t.playerIds.every((id) => typeof t.initialRatings?.[id] === 'number');
    const needsInitialRatedGames = !t.playerIds.every((id) => typeof t.initialRatedGames?.[id] === 'number');
    if (!needsInitialRatings && !needsInitialRatedGames) return t;

    changed = true;
    const initialRatings = Object.fromEntries(
      t.playerIds.map((id) => [id, t.initialRatings?.[id] ?? store.roster.find((p) => p.id === id)?.rating ?? 500])
    );
    const initialRatedGames = Object.fromEntries(
      t.playerIds.map((id) => [id, t.initialRatedGames?.[id] ?? store.roster.find((p) => p.id === id)?.ratedGames ?? 0])
    );
    return { ...t, initialRatings, initialRatedGames };
  });

  return changed ? { ...store, tournaments } : store;
}

export function createEmptyStore(): TournamentStore {
  return { roster: [], tournaments: [], activeId: null };
}
