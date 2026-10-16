-- ========================================================
-- SCHEMA & DATA AWAL POSTGRESQL TURNAMEN CATUR
-- Kompatibel dengan: Vercel Postgres / Neon Serverless
-- ========================================================

-- 1. Buat tabel roster (peserta)
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

-- 2. Buat tabel turnamen
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

-- 3. Buat tabel pengaturan turnamen
CREATE TABLE IF NOT EXISTS chess_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Masukkan data 4 peserta Politeknik Sorowako
INSERT INTO chess_roster (id, name, seed, rating, club)
VALUES 
  ('p_anxiety99', 'Anxiety99', 1, 757, 'Politeknik Sorowako'),
  ('p_ziiganteng', 'ZiiGanteng', 2, 706, 'Politeknik Sorowako'),
  ('p_dewacad', 'DEWACAD', 3, 590, 'Politeknik Sorowako'),
  ('p_azazeel03', 'Azazeel03', 4, 354, 'Politeknik Sorowako')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  seed = EXCLUDED.seed,
  rating = EXCLUDED.rating,
  club = EXCLUDED.club,
  updated_at = CURRENT_TIMESTAMP;

-- 5. Masukkan data turnamen "ROOKIE TOUR CHESS"
INSERT INTO chess_tournaments (id, name, date, location, total_rounds, player_ids, matches, created_at, is_active)
VALUES (
  'tn_rookie_tour_chess',
  'ROOKIE TOUR CHESS',
  '2026-10-16',
  'C2 Only',
  5,
  '["p_anxiety99", "p_ziiganteng", "p_dewacad", "p_azazeel03"]'::jsonb,
  '[
    {"id": "swiss_r1_b1_rookie", "round": 1, "boardNumber": 1, "whitePlayerId": "p_anxiety99", "blackPlayerId": "p_dewacad", "result": null},
    {"id": "swiss_r1_b2_rookie", "round": 1, "boardNumber": 2, "whitePlayerId": "p_azazeel03", "blackPlayerId": "p_ziiganteng", "result": null}
  ]'::jsonb,
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
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- 6. Set turnamen aktif
INSERT INTO chess_settings (key, value)
VALUES ('active_tournament_id', 'tn_rookie_tour_chess')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
