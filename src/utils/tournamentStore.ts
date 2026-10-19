import { Player, Tournament, TournamentStore } from '../types/chess';
import { initialSwissPlayers } from './swissEngine';

export const STORE_KEY = 'CHESS_TOURNAMENT_STORE_V3';
const LEGACY_KEY = 'CHESS_SWISS_POLTEK_SOROWAKO_V2';

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

export function createDefaultStore(): TournamentStore {
  const roster = initialSwissPlayers.map((p) => ({ ...p }));
  const tournament: Tournament = {
    id: 'tn_rookie_tour_chess',
    name: 'ROOKIE TOUR CHESS',
    date: '2026-10-16',
    location: 'C2 Only',
    totalRounds: 5,
    playerIds: roster.map((p) => p.id),
    matches: [
      {
        id: 'swiss_r1_b1_rookie',
        round: 1,
        boardNumber: 1,
        whitePlayerId: 'p_ziiganteng',
        blackPlayerId: 'p_dewacad',
        result: null,
      },
      {
        id: 'swiss_r1_b2_rookie',
        round: 1,
        boardNumber: 2,
        whitePlayerId: 'p_azazeel03',
        blackPlayerId: 'p_anxiety99',
        result: null,
      },
    ],
    pairingOverrides: {
      2: [
        { whitePlayerId: 'p_ziiganteng', blackPlayerId: 'p_azazeel03' },
        { whitePlayerId: 'p_dewacad', blackPlayerId: 'p_anxiety99' },
      ],
      3: [
        { whitePlayerId: 'p_ziiganteng', blackPlayerId: 'p_anxiety99' },
        { whitePlayerId: 'p_dewacad', blackPlayerId: 'p_azazeel03' },
      ],
    },
    createdAt: 1729056000000,
  };
  return { roster, tournaments: [tournament], activeId: tournament.id };
}

function isValidStore(value: unknown): value is TournamentStore {
  const v = value as TournamentStore;
  return (
    !!v &&
    Array.isArray(v.roster) &&
    Array.isArray(v.tournaments) &&
    (v.activeId === null || typeof v.activeId === 'string')
  );
}

/** Load saved data; migrates the single-tournament V2 save if present. */
export function loadStore(): TournamentStore | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidStore(parsed)) {
        // Auto-upgrade if store only contained the old initial template placeholder
        if (
          parsed.tournaments.length === 1 &&
          parsed.tournaments[0].id === 'tn_default' &&
          parsed.roster.some((p) => p.id === 'sp1')
        ) {
          return createDefaultStore();
        }
        return parsed;
      }
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      if (Array.isArray(old.players) && Array.isArray(old.matches)) {
        const tournament: Tournament = {
          id: 'tn_default',
          name: 'Turnamen Catur Sistem Swiss',
          date: '',
          location: '',
          totalRounds: old.totalRounds || 5,
          playerIds: old.players.map((p: Player) => p.id),
          matches: old.matches,
          createdAt: 0,
        };
        return { roster: old.players, tournaments: [tournament], activeId: tournament.id };
      }
    }
  } catch (e) {
    console.error('Failed to load tournament data', e);
  }
  return null;
}

export function saveStore(store: TournamentStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save tournament data', e);
  }
}
