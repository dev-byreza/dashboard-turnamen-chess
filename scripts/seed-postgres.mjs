import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local or .env if exists
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error('\n❌ POSTGRES_URL atau DATABASE_URL belum ditemukan!');
  console.error('Silakan set di file .env.local atau di Vercel Environment Variables:');
  console.error('Contoh di .env.local:');
  console.error('POSTGRES_URL="postgres://user:pass@ep-example.neon.tech/neondb?sslmode=require"\n');
  process.exit(1);
}

console.log('🔗 Menghubungkan ke PostgreSQL...');
const sql = neon(connectionString);

async function main() {
  try {
    console.log('⚙️ Membuat tabel chess_roster, chess_tournaments, chess_settings...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS chess_roster (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        seed INT DEFAULT 0,
        rating INT DEFAULT 500,
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
        initial_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
        pairing_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
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

    console.log('♟️ Memasukkan data 4 peserta Politeknik Sorowako...');
    const players = [
      { id: 'p_anxiety99', name: 'Anxiety99', seed: 1, rating: 500, club: 'Politeknik Sorowako' },
      { id: 'p_ziiganteng', name: 'ZiiGanteng', seed: 2, rating: 500, club: 'Politeknik Sorowako' },
      { id: 'p_dewacad', name: 'DEWACAD', seed: 3, rating: 500, club: 'Politeknik Sorowako' },
      { id: 'p_azazeel03', name: 'Azazeel03', seed: 4, rating: 500, club: 'Politeknik Sorowako' },
    ];

    for (const p of players) {
      await sql`
        INSERT INTO chess_roster (id, name, seed, rating, club)
        VALUES (${p.id}, ${p.name}, ${p.seed}, ${p.rating}, ${p.club})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          seed = EXCLUDED.seed,
          rating = EXCLUDED.rating,
          club = EXCLUDED.club,
          updated_at = CURRENT_TIMESTAMP;
      `;
    }

    await sql`
      ALTER TABLE chess_tournaments
      ADD COLUMN IF NOT EXISTS initial_ratings JSONB NOT NULL DEFAULT '{}'::jsonb;
    `;

    await sql`
      ALTER TABLE chess_tournaments
      ADD COLUMN IF NOT EXISTS pairing_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;
    `;

    console.log('🏆 Memasukkan turnamen ROOKIE TOUR CHESS (Babak 1 aktif)...');
    const playerIdsJson = JSON.stringify(players.map((p) => p.id));
    const pairingOverridesJson = JSON.stringify({
      2: [{ whitePlayerId: 'p_ziiganteng', blackPlayerId: 'p_azazeel03' }],
    });
    const matchesJson = JSON.stringify([
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
    ]);

    await sql`
      INSERT INTO chess_tournaments (id, name, date, location, total_rounds, player_ids, matches, initial_ratings, pairing_overrides, created_at, is_active)
      VALUES (
        'tn_rookie_tour_chess',
        'ROOKIE TOUR CHESS',
        '2026-10-16',
        'C2 Only',
        5,
        ${playerIdsJson}::jsonb,
        ${matchesJson}::jsonb,
        '{}'::jsonb,
        ${pairingOverridesJson}::jsonb,
        1729056000000,
        TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        date = EXCLUDED.date,
        location = EXCLUDED.location,
        total_rounds = EXCLUDED.total_rounds,
        player_ids = EXCLUDED.player_ids,
        matches = EXCLUDED.matches,
        initial_ratings = EXCLUDED.initial_ratings,
        pairing_overrides = EXCLUDED.pairing_overrides,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
    `;

    await sql`
      INSERT INTO chess_settings (key, value)
      VALUES ('active_tournament_id', 'tn_rookie_tour_chess')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    `;

    console.log('\n✅ BERHASIL! Data berhasil dimasukkan ke PostgreSQL di Vercel:');
    console.log('   - 4 Peserta: Anxiety99 (500), ZiiGanteng (500), DEWACAD (500), Azazeel03 (500)');
    console.log('   - Turnamen: ROOKIE TOUR CHESS (16 Oktober 2026, C2 Only, 5 Babak)');
    console.log('   - Status: Aktif (Babak 1 siap dimainkan)\n');
  } catch (err) {
    console.error('❌ Gagal menjalankan seed:', err);
    process.exit(1);
  }
}

main();
