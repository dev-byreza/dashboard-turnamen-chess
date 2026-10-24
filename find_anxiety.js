const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="?([^"\r\n]+)"?/);
const sql = neon(match[1]);

async function run() {
  const row = await sql`SELECT data FROM chess_analysis_cache WHERE key = 'chesscom_review_match_real_tour_chess_r5_b2_d20'`;
  const data = row[0].data;
  console.log('Keys in data:', Object.keys(data).slice(0, 10));
  // Print moves if any, or find where g8g2 is
  for (const [k, v] of Object.entries(data)) {
    const s = JSON.stringify(v);
    if (s.includes('g8g2')) {
      console.log('Found in FEN:', k, v);
    }
  }
}
run().catch(console.error);
