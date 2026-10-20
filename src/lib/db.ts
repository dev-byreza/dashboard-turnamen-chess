import { neon } from '@neondatabase/serverless';
import { Player, Tournament, TournamentStore, SwissMatch, SwissPairingOverride } from '../types/chess';
import { ensureUniqueTournamentSlugs } from '../utils/tournamentStore';

/** Get the active connection string from environment */
export function getConnectionString(): string | null {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

/** Check if database connection string is available */
export function isDbConfigured(): boolean {
  return Boolean(getConnectionString());
}

/** Get neon SQL client instance */
export function getDb() {
  const url = getConnectionString();
  if (!url) return null;
  return neon(url);
}

/**
 * Ensure all required tables exist in PostgreSQL.
 */
export async function ensureTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS chess_roster (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      seed INT DEFAULT 0,
      rating INT DEFAULT 500,
      rated_games INT NOT NULL DEFAULT 0,
      club VARCHAR(255) DEFAULT 'Politeknik Sorowako',
      title VARCHAR(10),
      avatar VARCHAR(255),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    ALTER TABLE chess_roster
    ADD COLUMN IF NOT EXISTS rated_games INT NOT NULL DEFAULT 0;
  `;

  await sql`
    ALTER TABLE chess_roster
    ADD COLUMN IF NOT EXISTS chess_com_username VARCHAR(100);
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chess_tournaments (
      id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      date VARCHAR(50) DEFAULT '',
      location VARCHAR(255) DEFAULT '',
      total_rounds INT DEFAULT 5,
      player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      matches JSONB NOT NULL DEFAULT '[]'::jsonb,
      initial_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
      initial_rated_games JSONB NOT NULL DEFAULT '{}'::jsonb,
      pairing_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
      round_schedules JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at BIGINT DEFAULT 0,
      is_active BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    ALTER TABLE chess_tournaments
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS chess_tournaments_slug_unique_idx
    ON chess_tournaments (slug)
    WHERE slug IS NOT NULL;
  `;

  await sql`
    ALTER TABLE chess_tournaments
    ADD COLUMN IF NOT EXISTS initial_ratings JSONB NOT NULL DEFAULT '{}'::jsonb;
  `;

  await sql`
    ALTER TABLE chess_tournaments
    ADD COLUMN IF NOT EXISTS initial_rated_games JSONB NOT NULL DEFAULT '{}'::jsonb;
  `;

  await sql`
    ALTER TABLE chess_tournaments
    ADD COLUMN IF NOT EXISTS pairing_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
  `;

  await sql`
    ALTER TABLE chess_tournaments
    ADD COLUMN IF NOT EXISTS round_schedules JSONB NOT NULL DEFAULT '{}'::jsonb;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chess_settings (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

/**
 * Initialize only the PostgreSQL schema; tournament/player data must be entered by an administrator.
 */
export async function initDb() {
  const sql = getDb();
  if (!sql) {
    return {
      success: false,
      error: 'Variabel POSTGRES_URL atau DATABASE_URL belum dikonfigurasi.',
    };
  }

  // 1. Ensure tables exist
  await ensureTables(sql);

  return { success: true };
}

/**
 * Load full tournament store from PostgreSQL.
 */
export async function getStoreFromDb(): Promise<TournamentStore | null> {
  const sql = getDb();
  if (!sql) return null;

  try {
    // 0. Ensure tables exist
    await ensureTables(sql);

    // 1. Fetch roster
    const rosterRows = (await sql`
      SELECT id, name, seed, rating, rated_games, club, title, avatar, chess_com_username
      FROM chess_roster
      ORDER BY rating DESC NULLS LAST, seed ASC
    `) as Array<{
      id: string;
      name: string;
      seed: number;
      rating: number;
      rated_games: number;
      club?: string;
      title?: Player['title'];
      avatar?: string;
      chess_com_username?: string;
    }>;

    // 2. Fetch tournaments
    const tourneyRows = (await sql`
      SELECT id, slug, name, date, location, total_rounds, player_ids, matches, initial_ratings, initial_rated_games, pairing_overrides, round_schedules, created_at, is_active
      FROM chess_tournaments
      ORDER BY created_at DESC
    `) as Array<{
      id: string;
      slug: string | null;
      name: string;
      date: string;
      location: string;
      total_rounds: number;
      player_ids: string[] | string;
      matches: SwissMatch[] | string;
      initial_ratings: Record<string, number> | string;
      initial_rated_games: Record<string, number> | string;
      pairing_overrides: Record<string, SwissPairingOverride[]> | string;
      round_schedules: Record<number, string> | string;
      created_at: number | string;
      is_active: boolean;
    }>;

    // 3. Fetch active id setting
    const settingRows = (await sql`
      SELECT value FROM chess_settings WHERE key = 'active_tournament_id' LIMIT 1
    `) as Array<{ value: string }>;

    const roster: Player[] = rosterRows.map((r, idx) => ({
      id: r.id,
      name: r.name,
      seed: r.seed || idx + 1,
      rating: r.rating ?? 500,
      ratedGames: r.rated_games ?? 0,
      club: r.club || 'Politeknik Sorowako',
      title: r.title || undefined,
      avatar: r.avatar || undefined,
      chessComUsername: r.chess_com_username || undefined,
    }));

    const tournaments: Tournament[] = tourneyRows.map((t) => {
      const playerIds: string[] =
        typeof t.player_ids === 'string'
          ? JSON.parse(t.player_ids)
          : Array.isArray(t.player_ids)
          ? t.player_ids
          : [];

      const matches: SwissMatch[] =
        typeof t.matches === 'string'
          ? JSON.parse(t.matches)
          : Array.isArray(t.matches)
          ? t.matches
          : [];

      const initialRatings: Record<string, number> =
        typeof t.initial_ratings === 'string'
          ? JSON.parse(t.initial_ratings)
          : t.initial_ratings && typeof t.initial_ratings === 'object'
          ? t.initial_ratings
          : {};

      const pairingOverrides: Record<string, SwissPairingOverride[]> =
        typeof t.pairing_overrides === 'string'
          ? JSON.parse(t.pairing_overrides)
          : t.pairing_overrides && typeof t.pairing_overrides === 'object'
          ? t.pairing_overrides
          : {};

      const initialRatedGames: Record<string, number> =
        typeof t.initial_rated_games === 'string'
          ? JSON.parse(t.initial_rated_games)
          : t.initial_rated_games && typeof t.initial_rated_games === 'object'
          ? t.initial_rated_games
          : {};

      const roundSchedules: Record<number, string> =
        typeof t.round_schedules === 'string'
          ? JSON.parse(t.round_schedules)
          : t.round_schedules && typeof t.round_schedules === 'object'
          ? t.round_schedules
          : {};

      return {
        id: t.id,
        slug: t.slug || undefined,
        name: t.name,
        date: t.date || '',
        location: t.location || '',
        totalRounds: Number(t.total_rounds) || 5,
        playerIds,
        matches,
        initialRatings: Object.keys(initialRatings).length > 0 ? initialRatings : undefined,
        initialRatedGames: Object.keys(initialRatedGames).length > 0 ? initialRatedGames : undefined,
        pairingOverrides: Object.keys(pairingOverrides).length > 0 ? pairingOverrides : undefined,
        roundSchedules: Object.keys(roundSchedules).length > 0 ? roundSchedules : undefined,
        createdAt: Number(t.created_at) || 0,
      };
    });

    const activeId =
      settingRows[0]?.value ||
      tournaments.find((t) => (t as any).is_active)?.id ||
      tournaments[0]?.id ||
      null;

    return ensureUniqueTournamentSlugs({
      roster,
      tournaments,
      activeId,
    });
  } catch (err) {
    console.error('Error fetching tournament store from PostgreSQL:', err);
    return null;
  }
}

/**
 * Persist the entire tournament store into PostgreSQL.
 */
export async function saveStoreToDb(store: TournamentStore): Promise<{ success: boolean; error?: string }> {
  const sql = getDb();
  if (!sql) {
    return { success: false, error: 'Variabel POSTGRES_URL atau DATABASE_URL belum dikonfigurasi.' };
  }

  try {
    // 0. Ensure tables exist before inserting
    await ensureTables(sql);
    const queries: any[] = [];

    // 1. Save roster players
    for (const p of store.roster) {
      queries.push(sql`
        INSERT INTO chess_roster (id, name, seed, rating, rated_games, club, title, avatar, chess_com_username)
        VALUES (
          ${p.id},
          ${p.name},
          ${p.seed || 0},
          ${p.rating ?? 500},
          ${p.ratedGames ?? 0},
          ${p.club || 'Politeknik Sorowako'},
          ${p.title || null},
          ${p.avatar || null},
          ${p.chessComUsername || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          seed = EXCLUDED.seed,
          rating = EXCLUDED.rating,
          rated_games = EXCLUDED.rated_games,
          club = EXCLUDED.club,
          title = EXCLUDED.title,
          avatar = EXCLUDED.avatar,
          chess_com_username = EXCLUDED.chess_com_username,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }

    // Delete removed players from roster, including all rows for an empty roster.
    if (store.roster.length === 0) {
      queries.push(sql`DELETE FROM chess_roster`);
    } else {
      const activeIdsJson = JSON.stringify(store.roster.map((p) => p.id));
      queries.push(sql`
        DELETE FROM chess_roster
        WHERE id NOT IN (SELECT jsonb_array_elements_text(${activeIdsJson}::jsonb));
      `);
    }

    // 2. Save tournaments, backfilling stable slugs for older rows when needed.
    const tournaments = ensureUniqueTournamentSlugs(store).tournaments;
    for (const t of tournaments) {
      const isActive = t.id === store.activeId;
      const playerIdsJson = JSON.stringify(t.playerIds);
      const matchesJson = JSON.stringify(t.matches);
      const initialRatingsJson = JSON.stringify(t.initialRatings || {});
      const initialRatedGamesJson = JSON.stringify(t.initialRatedGames || {});
      const pairingOverridesJson = JSON.stringify(t.pairingOverrides || {});
      const roundSchedulesJson = JSON.stringify(t.roundSchedules || {});

      queries.push(sql`
        INSERT INTO chess_tournaments (id, slug, name, date, location, total_rounds, player_ids, matches, initial_ratings, initial_rated_games, pairing_overrides, round_schedules, created_at, is_active)
        VALUES (
          ${t.id},
          ${t.slug || ''},
          ${t.name},
          ${t.date || ''},
          ${t.location || ''},
          ${t.totalRounds || 5},
          ${playerIdsJson}::jsonb,
          ${matchesJson}::jsonb,
          ${initialRatingsJson}::jsonb,
          ${initialRatedGamesJson}::jsonb,
          ${pairingOverridesJson}::jsonb,
          ${roundSchedulesJson}::jsonb,
          ${t.createdAt || 0},
          ${isActive}
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          date = EXCLUDED.date,
          location = EXCLUDED.location,
          total_rounds = EXCLUDED.total_rounds,
          player_ids = EXCLUDED.player_ids,
          matches = EXCLUDED.matches,
          initial_ratings = EXCLUDED.initial_ratings,
          initial_rated_games = EXCLUDED.initial_rated_games,
          pairing_overrides = EXCLUDED.pairing_overrides,
          round_schedules = EXCLUDED.round_schedules,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }

    // Delete removed tournaments, including all rows for an empty tournament list.
    if (tournaments.length === 0) {
      queries.push(sql`DELETE FROM chess_tournaments`);
    } else {
      const activeTourneyIdsJson = JSON.stringify(tournaments.map((t) => t.id));
      queries.push(sql`
        DELETE FROM chess_tournaments
        WHERE id NOT IN (SELECT jsonb_array_elements_text(${activeTourneyIdsJson}::jsonb));
      `);
    }

    // 3. Save active tournament ID setting
    queries.push(sql`
      INSERT INTO chess_settings (key, value)
      VALUES ('active_tournament_id', ${store.activeId})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    `);

    await sql.transaction(queries);

    return { success: true };
  } catch (err: any) {
    console.error('Error saving tournament store to PostgreSQL:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan ke PostgreSQL' };
  }
}
