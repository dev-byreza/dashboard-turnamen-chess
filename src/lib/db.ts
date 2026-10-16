import { neon } from '@neondatabase/serverless';
import { Player, Tournament, TournamentStore, SwissMatch } from '../types/chess';

export const DEFAULT_ROSTER: Player[] = [
  { id: 'p_anxiety99', name: 'Anxiety99', seed: 1, rating: 757, club: 'Politeknik Sorowako' },
  { id: 'p_ziiganteng', name: 'ZiiGanteng', seed: 2, rating: 706, club: 'Politeknik Sorowako' },
  { id: 'p_dewacad', name: 'DEWACAD', seed: 3, rating: 590, club: 'Politeknik Sorowako' },
  { id: 'p_azazeel03', name: 'Azazeel03', seed: 4, rating: 354, club: 'Politeknik Sorowako' },
];

export const DEFAULT_TOURNAMENT: Tournament = {
  id: 'tn_rookie_tour_chess',
  name: 'ROOKIE TOUR CHESS',
  date: '2026-10-16',
  location: 'C2 Only',
  totalRounds: 5,
  playerIds: ['p_anxiety99', 'p_ziiganteng', 'p_dewacad', 'p_azazeel03'],
  matches: [
    {
      id: 'swiss_r1_b1_rookie',
      round: 1,
      boardNumber: 1,
      whitePlayerId: 'p_anxiety99',
      blackPlayerId: 'p_dewacad',
      result: null,
    },
    {
      id: 'swiss_r1_b2_rookie',
      round: 1,
      boardNumber: 2,
      whitePlayerId: 'p_azazeel03',
      blackPlayerId: 'p_ziiganteng',
      result: null,
    },
  ],
  createdAt: 1729056000000,
};

export const DEFAULT_STORE: TournamentStore = {
  roster: DEFAULT_ROSTER,
  tournaments: [DEFAULT_TOURNAMENT],
  activeId: DEFAULT_TOURNAMENT.id,
};

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
      rating INT DEFAULT 1200,
      club VARCHAR(255) DEFAULT 'Politeknik Sorowako',
      title VARCHAR(10),
      avatar VARCHAR(255),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chess_tournaments (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date VARCHAR(50) DEFAULT '',
      location VARCHAR(255) DEFAULT '',
      total_rounds INT DEFAULT 5,
      player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      matches JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at BIGINT DEFAULT 0,
      is_active BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
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
 * Initialize PostgreSQL schema and seed the initial data if empty or forced.
 */
export async function initDb(force = false) {
  const sql = getDb();
  if (!sql) {
    return {
      success: false,
      error: 'Variabel POSTGRES_URL atau DATABASE_URL belum dikonfigurasi.',
    };
  }

  // 1. Ensure tables exist
  await ensureTables(sql);

  // 2. Check existing roster count
  const rosterCountRes = await sql`SELECT COUNT(*)::int as count FROM chess_roster`;
  const rosterCount = (rosterCountRes[0] as { count: number })?.count || 0;

  if (rosterCount === 0 || force) {
    for (const p of DEFAULT_ROSTER) {
      await sql`
        INSERT INTO chess_roster (id, name, seed, rating, club, title)
        VALUES (${p.id}, ${p.name}, ${p.seed}, ${p.rating || 1200}, ${p.club || 'Politeknik Sorowako'}, ${p.title || null})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          rating = EXCLUDED.rating,
          club = EXCLUDED.club,
          seed = EXCLUDED.seed,
          updated_at = CURRENT_TIMESTAMP;
      `;
    }
  }

  // 3. Check existing tournaments count
  const tournCountRes = await sql`SELECT COUNT(*)::int as count FROM chess_tournaments`;
  const tournCount = (tournCountRes[0] as { count: number })?.count || 0;

  if (tournCount === 0 || force) {
    const playerIdsJson = JSON.stringify(DEFAULT_TOURNAMENT.playerIds);
    const matchesJson = JSON.stringify(DEFAULT_TOURNAMENT.matches);

    await sql`
      INSERT INTO chess_tournaments (id, name, date, location, total_rounds, player_ids, matches, created_at, is_active)
      VALUES (
        ${DEFAULT_TOURNAMENT.id},
        ${DEFAULT_TOURNAMENT.name},
        ${DEFAULT_TOURNAMENT.date},
        ${DEFAULT_TOURNAMENT.location},
        ${DEFAULT_TOURNAMENT.totalRounds},
        ${playerIdsJson}::jsonb,
        ${matchesJson}::jsonb,
        ${DEFAULT_TOURNAMENT.createdAt},
        TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        date = EXCLUDED.date,
        location = EXCLUDED.location,
        total_rounds = EXCLUDED.total_rounds,
        player_ids = EXCLUDED.player_ids,
        matches = EXCLUDED.matches,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
    `;

    await sql`
      INSERT INTO chess_settings (key, value)
      VALUES ('active_tournament_id', ${DEFAULT_TOURNAMENT.id})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    `;
  }

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
      SELECT id, name, seed, rating, club, title, avatar
      FROM chess_roster
      ORDER BY rating DESC NULLS LAST, seed ASC
    `) as Array<{
      id: string;
      name: string;
      seed: number;
      rating: number;
      club?: string;
      title?: Player['title'];
      avatar?: string;
    }>;

    // 2. Fetch tournaments
    const tourneyRows = (await sql`
      SELECT id, name, date, location, total_rounds, player_ids, matches, created_at, is_active
      FROM chess_tournaments
      ORDER BY created_at DESC
    `) as Array<{
      id: string;
      name: string;
      date: string;
      location: string;
      total_rounds: number;
      player_ids: string[] | string;
      matches: SwissMatch[] | string;
      created_at: number | string;
      is_active: boolean;
    }>;

    // 3. Fetch active id setting
    const settingRows = (await sql`
      SELECT value FROM chess_settings WHERE key = 'active_tournament_id' LIMIT 1
    `) as Array<{ value: string }>;

    if (rosterRows.length === 0 && tourneyRows.length === 0) {
      // Database exists but is empty -> auto seed
      await initDb(false);
      return DEFAULT_STORE;
    }

    const roster: Player[] = rosterRows.map((r, idx) => ({
      id: r.id,
      name: r.name,
      seed: r.seed || idx + 1,
      rating: r.rating || 1200,
      club: r.club || 'Politeknik Sorowako',
      title: r.title || undefined,
      avatar: r.avatar || undefined,
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

      return {
        id: t.id,
        name: t.name,
        date: t.date || '',
        location: t.location || '',
        totalRounds: Number(t.total_rounds) || 5,
        playerIds,
        matches,
        createdAt: Number(t.created_at) || 0,
      };
    });

    const activeId =
      settingRows[0]?.value ||
      tournaments.find((t) => (t as any).is_active)?.id ||
      tournaments[0]?.id ||
      null;

    return {
      roster,
      tournaments,
      activeId,
    };
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

    // 1. Save roster players
    for (const p of store.roster) {
      await sql`
        INSERT INTO chess_roster (id, name, seed, rating, club, title, avatar)
        VALUES (
          ${p.id},
          ${p.name},
          ${p.seed || 0},
          ${p.rating || 1200},
          ${p.club || 'Politeknik Sorowako'},
          ${p.title || null},
          ${p.avatar || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          seed = EXCLUDED.seed,
          rating = EXCLUDED.rating,
          club = EXCLUDED.club,
          title = EXCLUDED.title,
          avatar = EXCLUDED.avatar,
          updated_at = CURRENT_TIMESTAMP;
      `;
    }

    // Safely delete removed players from roster
    if (store.roster.length > 0) {
      const activeIdsJson = JSON.stringify(store.roster.map((p) => p.id));
      await sql`
        DELETE FROM chess_roster
        WHERE id NOT IN (SELECT jsonb_array_elements_text(${activeIdsJson}::jsonb));
      `;
    }

    // 2. Save tournaments
    for (const t of store.tournaments) {
      const isActive = t.id === store.activeId;
      const playerIdsJson = JSON.stringify(t.playerIds);
      const matchesJson = JSON.stringify(t.matches);

      await sql`
        INSERT INTO chess_tournaments (id, name, date, location, total_rounds, player_ids, matches, created_at, is_active)
        VALUES (
          ${t.id},
          ${t.name},
          ${t.date || ''},
          ${t.location || ''},
          ${t.totalRounds || 5},
          ${playerIdsJson}::jsonb,
          ${matchesJson}::jsonb,
          ${t.createdAt || 0},
          ${isActive}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          date = EXCLUDED.date,
          location = EXCLUDED.location,
          total_rounds = EXCLUDED.total_rounds,
          player_ids = EXCLUDED.player_ids,
          matches = EXCLUDED.matches,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP;
      `;
    }

    // Safely delete removed tournaments
    if (store.tournaments.length > 0) {
      const activeTourneyIdsJson = JSON.stringify(store.tournaments.map((t) => t.id));
      await sql`
        DELETE FROM chess_tournaments
        WHERE id NOT IN (SELECT jsonb_array_elements_text(${activeTourneyIdsJson}::jsonb));
      `;
    }

    // 3. Save active tournament ID setting
    if (store.activeId) {
      await sql`
        INSERT INTO chess_settings (key, value)
        VALUES ('active_tournament_id', ${store.activeId})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
      `;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving tournament store to PostgreSQL:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan ke PostgreSQL' };
  }
}
