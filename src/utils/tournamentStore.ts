import { Player, Tournament, TournamentStore } from '../types/chess';
import { generateSwissRound1, initialSwissPlayers } from './swissEngine';

export const STORE_KEY = 'CHESS_TOURNAMENT_STORE_V3';
const LEGACY_KEY = 'CHESS_SWISS_POLTEK_SOROWAKO_V2';

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Resolve a tournament's players from the roster, in order, with fresh seeds. */
export function playersForTournament(roster: Player[], t: Tournament): Player[] {
  return t.playerIds
    .map((id) => roster.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .map((p, i) => ({ ...p, seed: i + 1 }));
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

export function createDefaultStore(): TournamentStore {
  const roster = initialSwissPlayers.map((p) => ({ ...p }));
  const tournament: Tournament = {
    id: 'tn_default',
    name: 'Turnamen Catur Sistem Swiss',
    date: '',
    location: '',
    totalRounds: 5,
    playerIds: roster.map((p) => p.id),
    matches: generateSwissRound1(roster),
    createdAt: 0,
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
      if (isValidStore(parsed)) return parsed;
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
