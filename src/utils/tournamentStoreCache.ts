import { TournamentStore } from '../types/chess';
import { ensureInitialRatings } from './tournamentStore';

const CACHE_KEY = 'CHESS_TOURNAMENT_STORE_V1';
const DB_STATUS_KEY = 'CHESS_DB_STATUS_V1';

let inMemoryStore: TournamentStore | null = null;
let inMemoryDbStatus: 'connected' | 'offline' | 'unconfigured' | null = null;

/**
 * Retrieve cached tournament store from client memory or sessionStorage.
 * This ensures navigating between the tournament list and tournament details
 * is nearly instant without waiting for full database round-trips.
 */
export function getCachedTournamentStore(): TournamentStore | null {
  if (inMemoryStore) return inMemoryStore;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.tournaments) && Array.isArray(parsed.roster)) {
      inMemoryStore = ensureInitialRatings(parsed);
      return inMemoryStore;
    }
  } catch {
    // Ignore storage parse error
  }
  return null;
}

/**
 * Save store and connection status to client memory and sessionStorage.
 */
export function setCachedTournamentStore(
  store: TournamentStore,
  dbStatus: 'connected' | 'offline' | 'unconfigured' = 'connected'
): void {
  inMemoryStore = store;
  inMemoryDbStatus = dbStatus;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(store));
    sessionStorage.setItem(DB_STATUS_KEY, dbStatus);
  } catch {
    // Ignore storage write error
  }
}

/**
 * Get cached database status ('connected' | 'offline' | 'unconfigured').
 */
export function getCachedDbStatus(): 'connected' | 'offline' | 'unconfigured' | null {
  if (inMemoryDbStatus) return inMemoryDbStatus;
  if (typeof window === 'undefined') return null;
  try {
    const status = sessionStorage.getItem(DB_STATUS_KEY);
    if (status === 'connected' || status === 'offline' || status === 'unconfigured') {
      inMemoryDbStatus = status;
      return status;
    }
  } catch {
    // Ignore storage read error
  }
  return null;
}
