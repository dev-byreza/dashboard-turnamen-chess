import { Player, Tournament, TournamentStore } from '../types/chess';

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const slugify = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '');

export function normalizeTournamentSlug(value: string): string {
  return slugify(value);
}

function makeSlugUnique(base: string, used: Set<string>) {
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function createUniqueTournamentSlugFromValue(
  value: string,
  tournaments: Pick<Tournament, 'slug'>[]
): string {
  const used = new Set(
    tournaments
      .map((tournament) => normalizeTournamentSlug(tournament.slug || ''))
      .filter(Boolean)
  );
  return makeSlugUnique(normalizeTournamentSlug(value) || 'turnamen', used);
}

function uniqueTournamentSlug(name: string, date: string, createdAt: number, used: Set<string>) {
  const datePart = date || new Date(createdAt || Date.now()).toISOString().slice(0, 10);
  const base = `${slugify(name) || 'turnamen'}-${slugify(datePart) || 'tanpa-tanggal'}`;
  return makeSlugUnique(base, used);
}

/** Create a readable slug that is unique across existing tournaments, including completed ones. */
export function createUniqueTournamentSlug(
  name: string,
  date: string,
  tournaments: Pick<Tournament, 'slug'>[],
  createdAt = Date.now()
): string {
  const used = new Set(
    tournaments
      .map((tournament) => normalizeTournamentSlug(tournament.slug || ''))
      .filter(Boolean)
  );
  return uniqueTournamentSlug(name, date, createdAt, used);
}

/** Backfill legacy tournaments and resolve any duplicate slugs in a stable creation order. */
export function ensureUniqueTournamentSlugs(store: TournamentStore): TournamentStore {
  const used = new Set<string>();
  const slugById = new Map<string, string>();
  const chronological = [...store.tournaments].sort((a, b) => a.createdAt - b.createdAt);

  chronological.forEach((tournament) => {
    const existing = normalizeTournamentSlug(tournament.slug || '');
    const slug = existing && !used.has(existing)
      ? existing
      : uniqueTournamentSlug(tournament.name, tournament.date, tournament.createdAt, used);
    used.add(slug);
    slugById.set(tournament.id, slug);
  });

  let changed = false;
  const tournaments = store.tournaments.map((tournament) => {
    const slug = slugById.get(tournament.id)!;
    if (tournament.slug === slug) return tournament;
    changed = true;
    return { ...tournament, slug };
  });

  return changed ? { ...store, tournaments } : store;
}

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
