// dump-eval.mjs
// Memutar ulang satu PGN, memanggil endpoint /api/stockfish milik webmu untuk setiap posisi,
// lalu menyimpan hasil MENTAH ke eval-dump.json (belum ada klasifikasi, tidak mengimpor kode webmu).
//
// Cara pakai (di folder project, dengan `npm run dev` sedang berjalan):
//   node dump-eval.mjs game.pgn 18
//   node dump-eval.mjs game.pgn 18 http://localhost:3000
//
// Argumen: <file.pgn> <depth, default 18> <base url, default http://localhost:3000>
// Butuh chess.js (sudah ada di project) dan Node 18+ (fetch bawaan).

import fs from 'node:fs';
import { Chess } from 'chess.js';

const [, , pgnPath = 'game.pgn', depthArg = '18', baseArg = 'http://localhost:3000'] = process.argv;
const depth = Number(depthArg);
const base = baseArg.replace(/\/$/, '');

// Buang komentar {...} (termasuk [%clk ...] dan [%c_effect ...]) dan NAG seperti $1
const pgn = fs
  .readFileSync(pgnPath, 'utf8')
  .replace(/\{[^}]*\}/g, ' ')
  .replace(/\$\d+/g, ' ');

const game = new Chess();
game.loadPgn(pgn);
const history = game.history({ verbose: true });

const replay = new Chess();
const moves = history.map((m, i) => {
  const fenBefore = replay.fen();
  replay.move(m.san);
  return {
    ply: i + 1,
    color: m.color,
    san: m.san,
    uci: `${m.from}${m.to}${m.promotion ?? ''}`,
    fenBefore,
    fenAfter: replay.fen(),
  };
});

function isOver(fen) {
  const c = new Chess(fen);
  return typeof c.isGameOver === 'function' ? c.isGameOver() : c.game_over();
}

// Semua FEN unik (fenAfter langkah N sama dengan fenBefore langkah N+1)
const fens = [];
const seen = new Set();
for (const m of moves) {
  for (const f of [m.fenBefore, m.fenAfter]) {
    if (!seen.has(f)) {
      seen.add(f);
      fens.push(f);
    }
  }
}

async function evalFen(fen) {
  const url = `${base}/api/stockfish?fen=${encodeURIComponent(fen)}&depth=${depth}&multipv=3&fresh=1`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (res.ok) {
        const d = await res.json();
        if (d && d.success) return d;
      }
    } catch {
      // coba lagi
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  return null;
}

const evals = {};
const failed = [];
let done = 0;
for (const fen of fens) {
  if (isOver(fen)) {
    evals[fen] = { terminal: true };
  } else {
    const d = await evalFen(fen);
    if (d) evals[fen] = d;
    else failed.push(fen);
  }
  done++;
  if (done % 5 === 0 || done === fens.length) {
    console.log(`${done}/${fens.length} posisi`);
  }
}

const out = {
  meta: { depth, base, generatedAt: new Date().toISOString(), plies: moves.length, failed: failed.length },
  moves,
  evals,
};
fs.writeFileSync('eval-dump.json', JSON.stringify(out, null, 2));
console.log(`Selesai: ${Object.keys(evals).length} posisi tersimpan, ${failed.length} gagal -> eval-dump.json`);
if (failed.length) {
  console.log('FEN gagal:\n' + failed.join('\n'));
  process.exitCode = 1;
}
