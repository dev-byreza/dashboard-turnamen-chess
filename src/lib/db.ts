import { neon } from '@neondatabase/serverless';
import { Player, Tournament, TournamentStore, SwissMatch, SwissPairingOverride } from '../types/chess';
import { BlogPost } from '../types/blog';
import { FUNDAMENTAL_CHESS_BLOG_POSTS } from './blogPostsSeed';
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

// In-memory flags to prevent repeating expensive DDL statements on every query
let tablesEnsured = false;
let blogSeeded = false;
let blogCache: { data: BlogPost[]; at: number } | null = null;
const blogPostSlugCache = new Map<string, { data: BlogPost; at: number }>();

/**
 * Ensure all required tables exist in PostgreSQL.
 */
export async function ensureTables(sql: any) {
  if (tablesEnsured) return;
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

  await sql`
    CREATE TABLE IF NOT EXISTS chess_analysis_cache (
      key VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chess_blog_posts (
      id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(64) DEFAULT 'Fundamental',
      tag VARCHAR(64) DEFAULT 'Fundamental',
      author VARCHAR(100) DEFAULT 'Pelatih Chess Poliwako',
      read_time VARCHAR(30) DEFAULT '5 menit baca',
      cover_image VARCHAR(255) DEFAULT '',
      cover_tone VARCHAR(32) DEFAULT 'is-gold',
      views INT DEFAULT 0,
      is_published BOOLEAN DEFAULT TRUE,
      published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS chess_blog_posts_slug_unique_idx
    ON chess_blog_posts (slug);
  `;

  tablesEnsured = true;
}

/**
 * Fetch cached match analysis from PostgreSQL.
 * Supports fallback lookup by game URL, game ID, or matching tournament matches.
 */
export async function getCachedAnalysisFromDb(
  key: string,
  gameUrl?: string | null
): Promise<any | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    await ensureTables(sql);

    // 1. Direct key match in chess_analysis_cache
    const rows = (await sql`
      SELECT data FROM chess_analysis_cache
      WHERE key = ${key}
      LIMIT 1;
    `) as Array<{ data: any }>;
    if (rows && rows.length > 0 && rows[0].data) {
      return rows[0].data;
    }

    // 2. Extract game ID from URL or key if present (e.g. 185792388348)
    const urlToTest = gameUrl || key;
    const gameIdMatch = urlToTest.match(/(\d{9,15})/);
    const gameId = gameIdMatch ? gameIdMatch[1] : null;

    if (gameId) {
      // 2a. Search cache by game ID pattern
      const pattern = `%${gameId}%`;
      const patternRows = (await sql`
        SELECT data FROM chess_analysis_cache
        WHERE key LIKE ${pattern}
        ORDER BY updated_at DESC
        LIMIT 1;
      `) as Array<{ data: any }>;
      if (patternRows && patternRows.length > 0 && patternRows[0].data) {
        return patternRows[0].data;
      }

      // 2b. Search chess_tournaments matches for this game
      const tourneyRows = (await sql`
        SELECT matches FROM chess_tournaments
        WHERE matches::text LIKE ${pattern}
        LIMIT 3;
      `) as Array<{ matches: any }>;

      for (const t of tourneyRows) {
        const matches = typeof t.matches === 'string' ? JSON.parse(t.matches) : t.matches;
        if (Array.isArray(matches)) {
          for (const m of matches) {
            if (
              (m.chessComUrl && m.chessComUrl.includes(gameId)) ||
              (m.id && m.id.includes(gameId))
            ) {
              if (m.chessComAnalysis && typeof m.chessComAnalysis === 'object') {
                const keysCount = Object.keys(m.chessComAnalysis).length;
                if (keysCount > 5) {
                  return m.chessComAnalysis;
                }
              }
            }
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error(`Failed to get analysis cache for ${key}:`, err);
    return null;
  }
}

/**
 * Save cached match analysis to PostgreSQL for shared instant loading.
 * Optionally saves under extra key aliases (e.g. gameUrl or gameId).
 */
export async function saveCachedAnalysisToDb(
  key: string,
  data: any,
  extraKeys: string[] = []
): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    await ensureTables(sql);
    const dataJson = JSON.stringify(data);

    const allKeys = Array.from(new Set([key, ...extraKeys].filter(Boolean)));
    for (const k of allKeys) {
      await sql`
        INSERT INTO chess_analysis_cache (key, data, updated_at)
        VALUES (${k}, ${dataJson}::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = CURRENT_TIMESTAMP;
      `;
    }
    return true;
  } catch (err) {
    console.error(`Failed to save analysis cache for ${key}:`, err);
    return false;
  }
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

/**
 * Format timestamp to Indonesian date string (e.g. "18 Oktober 2026")
 */
export function formatBlogDate(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Seed fundamental chess articles into PostgreSQL if table is empty.
 */
export async function seedBlogPostsIfEmpty(sql: any): Promise<void> {
  if (blogSeeded) return;
  try {
    const existing = await sql`
      SELECT COUNT(*)::int AS count FROM chess_blog_posts;
    `;
    const count = Number(existing?.[0]?.count ?? 0);
    if (count === 0) {
      for (const post of FUNDAMENTAL_CHESS_BLOG_POSTS) {
        await sql`
          INSERT INTO chess_blog_posts (
            id, slug, title, excerpt, content, category, tag, author, read_time,
            cover_image, cover_tone, views, is_published, published_at, created_at, updated_at
          )
          VALUES (
            ${post.id},
            ${post.slug},
            ${post.title},
            ${post.excerpt},
            ${post.content},
            ${post.category},
            ${post.tag},
            ${post.author},
            ${post.readTime},
            ${post.coverImage},
            ${post.coverTone},
            ${post.views},
            ${post.isPublished},
            ${post.publishedAt}::timestamptz,
            ${post.publishedAt}::timestamptz,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (slug) DO NOTHING;
        `;
      }
    }
    blogSeeded = true;
  } catch (err) {
    console.error('Error seeding fundamental blog posts:', err);
  }
}

/**
 * Get all published blog posts from PostgreSQL database.
 */
export async function getDbBlogPosts(options?: {
  publishedOnly?: boolean;
  limit?: number;
}): Promise<BlogPost[]> {
  // Fast memory cache check (60s TTL)
  const now = Date.now();
  if (blogCache && now - blogCache.at < 60000 && (!options?.limit || options.limit >= blogCache.data.length)) {
    return options?.limit ? blogCache.data.slice(0, options.limit) : blogCache.data;
  }

  const sql = getDb();
  if (!sql) return blogCache ? blogCache.data : [];
  try {
    await ensureTables(sql);
    await seedBlogPostsIfEmpty(sql);

    const isPublishedOnly = options?.publishedOnly !== false;
    const limit = options?.limit && options.limit > 0 ? options.limit : 100;

    const rows = (await sql`
      SELECT 
        id, slug, title, excerpt, content, category, tag, author,
        read_time AS "readTime",
        cover_image AS "coverImage",
        cover_tone AS "coverTone",
        views, is_published AS "isPublished",
        published_at AS "publishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM chess_blog_posts
      WHERE (${isPublishedOnly} = FALSE OR is_published = TRUE)
      ORDER BY published_at DESC
      LIMIT ${limit};
    `) as any[];

    const result: BlogPost[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content,
      category: r.category || 'Fundamental',
      tag: r.tag || 'Catur',
      author: r.author || 'Pelatih Chess Poliwako',
      readTime: r.readTime || '5 menit baca',
      coverImage: r.coverImage || '',
      coverTone: r.coverTone || 'is-gold',
      views: Number(r.views || 0),
      isPublished: Boolean(r.isPublished),
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : new Date().toISOString(),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      date: formatBlogDate(r.publishedAt),
    }));

    if (!options?.limit || options.limit >= 6) {
      blogCache = { data: result, at: now };
    }

    return result;
  } catch (err) {
    console.error('Failed to get blog posts from PostgreSQL:', err);
    return blogCache ? blogCache.data : [];
  }
}

/**
 * Get single blog post by slug from PostgreSQL database.
 */
export async function getDbBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const now = Date.now();
  const cached = blogPostSlugCache.get(slug);
  if (cached && now - cached.at < 60000) {
    return cached.data;
  }

  const sql = getDb();
  if (!sql) return cached?.data || null;
  try {
    await ensureTables(sql);
    await seedBlogPostsIfEmpty(sql);

    const rows = (await sql`
      SELECT 
        id, slug, title, excerpt, content, category, tag, author,
        read_time AS "readTime",
        cover_image AS "coverImage",
        cover_tone AS "coverTone",
        views, is_published AS "isPublished",
        published_at AS "publishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM chess_blog_posts
      WHERE slug = ${slug}
      LIMIT 1;
    `) as any[];

    if (!rows || rows.length === 0) return null;
    const r = rows[0];

    // Asynchronously increment views counter
    sql`UPDATE chess_blog_posts SET views = views + 1 WHERE slug = ${slug}`.catch(() => {});

    const item: BlogPost = {
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content,
      category: r.category || 'Fundamental',
      tag: r.tag || 'Catur',
      author: r.author || 'Pelatih Chess Poliwako',
      readTime: r.readTime || '5 menit baca',
      coverImage: r.coverImage || '',
      coverTone: r.coverTone || 'is-gold',
      views: Number(r.views || 0) + 1,
      isPublished: Boolean(r.isPublished),
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : new Date().toISOString(),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      date: formatBlogDate(r.publishedAt),
    };

    blogPostSlugCache.set(slug, { data: item, at: now });
    return item;
  } catch (err) {
    console.error(`Failed to get blog post for slug ${slug}:`, err);
    return cached?.data || null;
  }
}

