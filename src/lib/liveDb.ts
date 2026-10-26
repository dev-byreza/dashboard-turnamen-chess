import { Chess } from 'chess.js';
import { getDb } from './db';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type LiveResult = '1-0' | '0-1' | '1/2-1/2';
export type LiveStatus = 'live' | 'finished';
export type LiveMoveInput = string | { from: string; to: string; promotion?: string };
export type LiveErrorCode =
  | 'NOT_FOUND'
  | 'FINISHED'
  | 'CONFLICT'
  | 'GAME_EXISTS'
  | 'ILLEGAL'
  | 'EMPTY'
  | 'BAD_FEN'
  | 'CORRUPT';

export interface LiveGame {
  id: string;
  whiteName: string;
  blackName: string;
  status: LiveStatus;
  result: LiveResult | null;
  startFen: string;
  /** Daftar langkah dalam notasi SAN */
  moves: string[];
  moveCount: number;
  fen: string;
  pgn: string;
  /** Naik 1 setiap perubahan; dipakai untuk optimistic locking dan polling */
  version: number;
  tournamentId: string | null;
  matchId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type LiveOutcome =
  | { ok: true; game: LiveGame }
  | { ok: false; error: LiveErrorCode; game?: LiveGame };

export interface StartLiveGameInput {
  id: string;
  whiteName: string;
  blackName: string;
  tournamentId?: string | null;
  matchId?: string | null;
  startFen?: string;
  force?: boolean;
}

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */

function requireSql(): any {
  const sql = getDb();
  if (!sql) throw new Error('DB_NOT_CONFIGURED');
  return sql;
}

let tableReady: Promise<void> | null = null;

async function ensureLiveTable(sql: any): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS chess_live_games (
          id VARCHAR(100) PRIMARY KEY,
          white_name VARCHAR(100) NOT NULL DEFAULT 'White',
          black_name VARCHAR(100) NOT NULL DEFAULT 'Black',
          status VARCHAR(16) NOT NULL DEFAULT 'live',
          result VARCHAR(8),
          start_fen TEXT NOT NULL,
          moves JSONB NOT NULL DEFAULT '[]'::jsonb,
          fen TEXT NOT NULL,
          pgn TEXT NOT NULL DEFAULT '',
          version INT NOT NULL DEFAULT 1,
          tournament_id VARCHAR(64),
          match_id VARCHAR(128),
          created_at BIGINT NOT NULL DEFAULT 0,
          updated_at BIGINT NOT NULL DEFAULT 0
        );
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS chess_live_games_status_idx
        ON chess_live_games (status, updated_at DESC);
      `;
    })().catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

function toGame(r: any): LiveGame {
  const moves: string[] = Array.isArray(r.moves)
    ? r.moves
    : typeof r.moves === 'string'
    ? JSON.parse(r.moves)
    : [];
  return {
    id: r.id,
    whiteName: r.white_name,
    blackName: r.black_name,
    status: r.status === 'finished' ? 'finished' : 'live',
    result: (r.result as LiveResult | null) || null,
    startFen: r.start_fen,
    moves,
    moveCount: moves.length,
    fen: r.fen,
    pgn: r.pgn || '',
    version: Number(r.version),
    tournamentId: r.tournament_id || null,
    matchId: r.match_id || null,
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
  };
}

/* ------------------------------------------------------------------ */
/* chess.js helpers (kompatibel dengan v0.13 dan v1.x)                  */
/* ------------------------------------------------------------------ */

function newChess(startFen: string): Chess | null {
  try {
    return startFen === START_FEN ? new Chess() : new Chess(startFen);
  } catch {
    return null;
  }
}

function tryMove(chess: Chess, input: LiveMoveInput): string | null {
  try {
    const r: any = (chess as any).move(input, { sloppy: true });
    return r && r.san ? (r.san as string) : null;
  } catch {
    return null;
  }
}

function replay(startFen: string, moves: string[]): Chess | null {
  const chess = newChess(startFen);
  if (!chess) return null;
  for (const m of moves) {
    if (!tryMove(chess, m)) return null;
  }
  return chess;
}

function call(chess: any, modern: string, legacy: string): boolean {
  if (typeof chess[modern] === 'function') return !!chess[modern]();
  if (typeof chess[legacy] === 'function') return !!chess[legacy]();
  return false;
}

/** Hasil otomatis hanya untuk skakmat, pat, dan materi tidak cukup. */
function autoResult(chess: Chess): LiveResult | null {
  if (call(chess, 'isCheckmate', 'in_checkmate')) {
    // Giliran jalan milik pihak yang dimatikan
    return chess.turn() === 'b' ? '1-0' : '0-1';
  }
  if (call(chess, 'isStalemate', 'in_stalemate') || call(chess, 'isInsufficientMaterial', 'insufficient_material')) {
    return '1/2-1/2';
  }
  return null;
}

function setHeader(chess: any, key: string, value: string) {
  if (typeof chess.setHeader === 'function') chess.setHeader(key, value);
  else if (typeof chess.header === 'function') chess.header(key, value);
}

function buildPgn(
  startFen: string,
  moves: string[],
  names: { white: string; black: string },
  result: LiveResult | null,
  createdAt: number
): { fen: string; pgn: string } | null {
  const chess = replay(startFen, moves);
  if (!chess) return null;
  const d = new Date(createdAt || Date.now());
  const date = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
  setHeader(chess, 'Event', 'Live Game');
  setHeader(chess, 'Site', 'Chess Club Politeknik Sorowako');
  setHeader(chess, 'Date', date);
  setHeader(chess, 'White', names.white);
  setHeader(chess, 'Black', names.black);
  setHeader(chess, 'Result', result || '*');
  return { fen: chess.fen(), pgn: chess.pgn() };
}

/* ------------------------------------------------------------------ */
/* Query publik                                                        */
/* ------------------------------------------------------------------ */

export async function getLiveGame(id: string): Promise<LiveGame | null> {
  const sql = requireSql();
  await ensureLiveTable(sql);
  const rows = (await sql`SELECT * FROM chess_live_games WHERE id = ${id} LIMIT 1;`) as any[];
  return rows.length ? toGame(rows[0]) : null;
}

export async function listLiveGames(): Promise<LiveGame[]> {
  const sql = requireSql();
  await ensureLiveTable(sql);
  const rows = (await sql`
    SELECT * FROM chess_live_games
    WHERE status = 'live'
    ORDER BY updated_at DESC
    LIMIT 50;
  `) as any[];
  return rows.map(toGame);
}

/* ------------------------------------------------------------------ */
/* Mutasi                                                              */
/* ------------------------------------------------------------------ */

async function commit(
  sql: any,
  current: LiveGame,
  moves: string[],
  status: LiveStatus,
  result: LiveResult | null
): Promise<LiveOutcome> {
  const built = buildPgn(
    current.startFen,
    moves,
    { white: current.whiteName, black: current.blackName },
    result,
    current.createdAt
  );
  if (!built) return { ok: false, error: 'CORRUPT', game: current };

  const rows = (await sql`
    UPDATE chess_live_games
    SET moves = ${JSON.stringify(moves)}::jsonb,
        fen = ${built.fen},
        pgn = ${built.pgn},
        status = ${status},
        result = ${result},
        version = version + 1,
        updated_at = ${Date.now()}
    WHERE id = ${current.id} AND version = ${current.version}
    RETURNING *;
  `) as any[];

  if (!rows.length) {
    const latest = await getLiveGame(current.id);
    return { ok: false, error: 'CONFLICT', game: latest || undefined };
  }
  return { ok: true, game: toGame(rows[0]) };
}

export async function startLiveGame(input: StartLiveGameInput): Promise<LiveOutcome> {
  const sql = requireSql();
  await ensureLiveTable(sql);

  const startFen = input.startFen || START_FEN;
  const chess = newChess(startFen);
  if (!chess) return { ok: false, error: 'BAD_FEN' };

  const existing = await getLiveGame(input.id);
  if (existing && existing.moves.length > 0 && !input.force) {
    return { ok: false, error: 'GAME_EXISTS', game: existing };
  }

  const now = Date.now();
  const built = buildPgn(
    startFen,
    [],
    { white: input.whiteName, black: input.blackName },
    null,
    now
  );
  if (!built) return { ok: false, error: 'BAD_FEN' };

  const rows = (await sql`
    INSERT INTO chess_live_games
      (id, white_name, black_name, status, result, start_fen, moves, fen, pgn, version,
       tournament_id, match_id, created_at, updated_at)
    VALUES
      (${input.id}, ${input.whiteName}, ${input.blackName}, 'live', NULL, ${startFen}, '[]'::jsonb,
       ${built.fen}, ${built.pgn}, 1, ${input.tournamentId ?? null}, ${input.matchId ?? null}, ${now}, ${now})
    ON CONFLICT (id) DO UPDATE SET
      white_name = EXCLUDED.white_name,
      black_name = EXCLUDED.black_name,
      status = 'live',
      result = NULL,
      start_fen = EXCLUDED.start_fen,
      moves = '[]'::jsonb,
      fen = EXCLUDED.fen,
      pgn = EXCLUDED.pgn,
      version = chess_live_games.version + 1,
      tournament_id = EXCLUDED.tournament_id,
      match_id = EXCLUDED.match_id,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
    RETURNING *;
  `) as any[];

  return { ok: true, game: toGame(rows[0]) };
}

export async function appendLiveMove(
  id: string,
  expectedVersion: number,
  move: LiveMoveInput
): Promise<LiveOutcome> {
  const sql = requireSql();
  const game = await getLiveGame(id);
  if (!game) return { ok: false, error: 'NOT_FOUND' };
  if (game.status === 'finished') return { ok: false, error: 'FINISHED', game };
  if (game.version !== expectedVersion) return { ok: false, error: 'CONFLICT', game };

  const chess = replay(game.startFen, game.moves);
  if (!chess) return { ok: false, error: 'CORRUPT', game };

  const san = tryMove(chess, move);
  if (!san) return { ok: false, error: 'ILLEGAL', game };

  const result = autoResult(chess);
  return commit(sql, game, [...game.moves, san], result ? 'finished' : 'live', result);
}

/** Membatalkan langkah terakhir. Partai yang sudah selesai dibuka kembali. */
export async function undoLiveMove(id: string, expectedVersion: number): Promise<LiveOutcome> {
  const sql = requireSql();
  const game = await getLiveGame(id);
  if (!game) return { ok: false, error: 'NOT_FOUND' };
  if (game.version !== expectedVersion) return { ok: false, error: 'CONFLICT', game };
  if (game.moves.length === 0) return { ok: false, error: 'EMPTY', game };

  return commit(sql, game, game.moves.slice(0, -1), 'live', null);
}

export async function finishLiveGame(id: string, result: LiveResult): Promise<LiveOutcome> {
  const sql = requireSql();
  // Coba ulang bila bentrok dengan langkah yang masuk bersamaan
  for (let attempt = 0; attempt < 3; attempt++) {
    const game = await getLiveGame(id);
    if (!game) return { ok: false, error: 'NOT_FOUND' };
    const outcome = await commit(sql, game, game.moves, 'finished', result);
    if (outcome.ok || outcome.error !== 'CONFLICT') return outcome;
  }
  const latest = await getLiveGame(id);
  return { ok: false, error: 'CONFLICT', game: latest || undefined };
}
