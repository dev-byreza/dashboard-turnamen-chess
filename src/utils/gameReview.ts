/**
 * Engine-based game review: every position is evaluated by the SAME Stockfish used for the
 * live eval bar, and move quality is derived from the real change in win probability
 * (the same idea Chess.com uses), instead of any heuristic / pseudo-random labelling.
 */
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { analyzeCurrent, analyzePositions } from './stockfishClient';
import type { EvalResult } from './stockfishClient';
import { centipawnsToWinChance } from './stockfishEngine';
import { isBookPosition } from './openingBook';
import {
  getWinProbability,
  calculateMoveAccuracy,
  calculateGameAccuracy,
  detectPieceSacrifice,
  getDirectMaterialBlunderLoss,
  shouldShowBestMoveArrow,
  MoveClassification,
} from './chessAnalysisEngine';

export {
  getWinProbability,
  calculateMoveAccuracy,
  calculateGameAccuracy,
  detectPieceSacrifice,
  getDirectMaterialBlunderLoss,
  shouldShowBestMoveArrow,
};
export type { MoveClassification };

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface PositionScore {
  fen: string;
  cp: number; // white perspective, +-10000 for mate
  mate?: number;
  winWhite: number; // 0..100
  scoreDisplay: string;
  bestUci?: string;
  bestSan?: string;
  /** Top engine candidate lines (MultiPV), white perspective */
  lines?: {
    uci: string;
    san: string;
    continuation?: string;
    cp: number;
    mate?: number;
    winWhite: number;
    scoreDisplay: string;
  }[];
}

export type ReviewLabel =
  | 'brilliant'
  | 'great'
  | 'book'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface ReviewedMove {
  label: ReviewLabel;
  loss: number; // win-probability points lost by mover (0..100)
  accuracy?: number; // 0..100% CAPS accuracy
  /**
   * Langkah terbaik saran engine (HANYA diisi ketika langkah pemain di luar Best / Great / Brilliant / Book,
   * sehingga panah feedback di papan hanya muncul saat pemain tidak memainkan langkah terbaik).
   */
  bestUci?: string;
  bestSan?: string;
  /** Menyimpan bestUci mentah dari engine jika dibutuhkan untuk keperluan internal */
  engineBestUci?: string;
  engineBestSan?: string;
  /**
   * Panah saran langkah terbaik engine. Muncul HANYA jika label langkah terbaik engine LEBIH TINGGI
   * daripada label langkah yang dimainkan (mis. Excellent/Good -> panah Best hijau,
   * Great -> panah Brilliant jika langkah terbaik engine ternyata Brilliant).
   * `color` mengikuti label langkah terbaik tersebut (lihat ARROW_COLORS).
   */
  feedbackArrow?: { from: Square; to: Square; color?: string; label?: ReviewLabel } | null;
  /** Label yang akan didapat langkah terbaik engine (hanya terisi saat panah ditampilkan). */
  bestLabel?: ReviewLabel;
  evalBefore: PositionScore;
  evalAfter: PositionScore;
}

export const COMMON_BOOK_LINES: Record<
  string,
  { uci: string; san: string; continuation: string; cp: number; winWhite: number; scoreDisplay: string }[]
> = {
  // START_FEN (White to move)
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': [
    {
      uci: 'e2e4',
      san: 'e4',
      continuation: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6',
      cp: 20,
      winWhite: 52.0,
      scoreDisplay: '+0.20',
    },
    {
      uci: 'd2d4',
      san: 'd4',
      continuation: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 Be7',
      cp: 18,
      winWhite: 51.8,
      scoreDisplay: '+0.18',
    },
  ],
  // 1. d4 (Black to move - Queen's Pawn Game)
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1': [
    {
      uci: 'g8f6',
      san: 'Nf6',
      continuation: '1... Nf6 2. c4 e6 3. Nf3 d5 4. Nc3 Be7 5. Bf4 O-O',
      cp: 17,
      winWhite: 51.5,
      scoreDisplay: '+0.17',
    },
    {
      uci: 'd7d5',
      san: 'd5',
      continuation: '1... d5 2. Nf3 Nf6 3. c4 e6 4. Nc3 Bb4 5. Bg5 h6',
      cp: 23,
      winWhite: 52.3,
      scoreDisplay: '+0.23',
    },
  ],
  // 1. e4 (Black to move - King's Pawn Game)
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1': [
    {
      uci: 'e7e5',
      san: 'e5',
      continuation: '1... e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O',
      cp: 22,
      winWhite: 52.2,
      scoreDisplay: '+0.22',
    },
    {
      uci: 'c7c5',
      san: 'c5',
      continuation: '1... c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
      cp: 28,
      winWhite: 52.8,
      scoreDisplay: '+0.28',
    },
  ],
};

import { getStockfishEngine } from './stockfishEngine';

/** Jumlah kandidat langkah untuk review seluruh partai (classifyByEngine hanya butuh PV1 dan PV2). */
export const REVIEW_MULTIPV = 2;

/** Batas waktu per posisi: engine berhenti saat depth tercapai ATAU batas ini habis. */
function reviewMovetimeCap(depth: number): number {
  return Math.min(6000, Math.max(1500, depth * 250));
}

function evalResultToScore(r: EvalResult): PositionScore {
  return {
    fen: r.fen,
    cp: r.scoreCp,
    mate: r.mateIn,
    winWhite: r.winChanceWhite,
    scoreDisplay: r.scoreDisplay,
    bestUci: r.bestMoveUci || undefined,
    bestSan: r.bestMoveSan || undefined,
    lines: r.lines.map((l) => ({
      uci: l.uci,
      san: l.san,
      continuation: l.continuation,
      cp: l.scoreCp,
      mate: l.mateIn,
      winWhite: l.winChanceWhite,
      scoreDisplay: l.scoreDisplay,
    })),
  };
}

/**
 * Review seluruh partai: Stockfish Lite berjalan di Web Worker browser (beberapa worker paralel).
 * onScore dipanggil setiap satu posisi selesai; hasil akhir mencakup semua FEN yang diminta.
 * Cache hasil partai tetap ditangani modal (match.chessComAnalysis, /api/analysis, localStorage).
 */
export async function analyzeGameScores(
  fens: string[],
  depth: number,
  opts: {
    signal?: AbortSignal;
    fresh?: boolean;
    onScore?: (fen: string, score: PositionScore) => void;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<Record<string, PositionScore>> {
  const out: Record<string, PositionScore> = {};
  if (!fens.length || typeof window === 'undefined') return out;

  try {
    const results = await analyzePositions(fens, {
      movetime: reviewMovetimeCap(depth),
      maxDepth: depth,
      multipv: REVIEW_MULTIPV,
      minDepth: Math.min(depth, 10),
      useServerCache: false, // cache server sudah ditangani /api/analysis (PostgreSQL)
      fresh: opts.fresh,
      signal: opts.signal,
      onProgress: (done, total, fen, r) => {
        if (r) opts.onScore?.(fen, evalResultToScore(r));
        opts.onProgress?.(done, total);
      },
    });
    for (const [fen, r] of results) out[fen] = evalResultToScore(r);
  } catch (err) {
    // Engine gagal dimuat (mis. file .js/.wasm tidak ditemukan di /engines/stockfish)
    console.error('[Review] Stockfish Web Worker gagal:', err);
  }
  return out;
}

/** Satu posisi (posisi yang sedang dilihat / langkah manual): Web Worker dengan MultiPV 3. */
export async function fetchPositionScore(
  fen: string,
  depth: number,
  signal?: AbortSignal,
  fresh = false
): Promise<PositionScore | null> {
  if (typeof window === 'undefined' || signal?.aborted) return null;

  try {
    const r = await analyzeCurrent(fen, {
      movetime: reviewMovetimeCap(depth),
      maxDepth: depth,
      multipv: 3,
      minDepth: Math.min(depth, 10),
      useServerCache: false,
      fresh,
    });
    return evalResultToScore(r);
  } catch {
    // Worker utama gagal: coba engine client lama sebagai cadangan
  }

  try {
    const engine = getStockfishEngine();
    const evalRes = await engine.evaluatePosition(fen, Math.min(depth, 12));
    if (evalRes) {
      return {
        fen,
        cp: evalRes.scoreCp,
        mate: evalRes.mateIn,
        winWhite: evalRes.winChanceWhite,
        scoreDisplay: evalRes.scoreDisplay,
        bestUci: evalRes.bestMoveUci,
        bestSan: evalRes.bestMoveSan,
        lines: Array.isArray((evalRes as any).lines) ? (evalRes as any).lines : undefined,
      };
    }
  } catch {
    // keduanya gagal
  }

  return null;
}

// Nilai standar materi (dalam satuan poin pion)
export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 99, // Raja memiliki nilai tak terhingga dalam pertukaran
};

export interface EngineLine {
  moveUci: string; // Contoh: "f3g5"
  cp?: number;
  mate?: number;
}

export interface BrilliantCheckInput {
  fenBefore: string;       // FEN papan SEBELUM pemain melangkah
  playedMoveUci: string;   // Langkah pemain dalam format UCI (misal: "b2b4" atau "e7e8q")
  pv1: EngineLine;         // Langkah terbaik #1 dari Stockfish (MultiPV 1)
  pv2?: EngineLine;        // Langkah terbaik #2 dari Stockfish (MultiPV 2)
  playedEP: number;        // Expected Points (0.0 - 1.0) setelah langkah dimainkan
}

/**
 * Konversi Centipawn / Mate ke Expected Points (0.00 - 1.00)
 */
export function evalToEP(cp?: number, mate?: number): number {
  if (mate !== undefined) return mate > 0 ? 1.0 : 0.0;
  if (cp === undefined) return 0.5;
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 1 / (1 + Math.exp(-0.00368208 * clamped));
}

export const evalToExpectedPoints = evalToEP;

/**
 * Menghitung Static Exchange Evaluation (SEE) pada satu petak spesifik
 * dari sudut pandang pemain yang BARU SAJA giliran jalan di state papan saat ini.
 * Mengembalikan berapa poin yang bisa dimenangkan oleh pemain yang sedang giliran jalan (side to move)
 * jika dia memutuskan untuk memakan bidak di `targetSquare`.
 */
function calculateCaptureGainOnSquare(chess: Chess, targetSquare: Square, depth = 0): number {
  if (depth > 12) return 0;
  // Cari semua langkah legal yang bisa memakan ke targetSquare
  const legalCaptures = chess
    .moves({ verbose: true })
    .filter((m) => m.to === targetSquare);

  if (legalCaptures.length === 0) {
    return 0; // Tidak ada yang bisa memakan ke petak ini
  }

  // Pilih penangkap dengan nilai paling kecil (Least Valuable Attacker - LVA)
  legalCaptures.sort((a, b) => PIECE_VALUES[a.piece] - PIECE_VALUES[b.piece]);
  const lvaMove = legalCaptures[0];

  const capturedPieceValue = lvaMove.captured ? PIECE_VALUES[lvaMove.captured] : 0;

  // Eksekusi tangkapan di papan simulasi
  chess.move(lvaMove);

  // Rekursif: Lawan bisa memilih untuk memakan balik (jika menguntungkan) atau berhenti (Math.max(0, ...))
  const opponentCounterGain = calculateCaptureGainOnSquare(chess, targetSquare, depth + 1);

  // Kembalikan state papan
  chess.undo();

  // Pihak yang memakan bisa memilih untuk TIDAK memakan jika hasilnya rugi (< 0)
  return Math.max(0, capturedPieceValue - opponentCounterGain);
}

/**
 * Mengecek apakah terdapat pengorbanan materi (Direct Sacrifice maupun Passive/Hanging Sacrifice)
 */
export function isMaterialSacrifice(fenBefore: string, playedMoveUci: string): {
  isSacrifice: boolean;
  netMaterialLost: number;
  sacrificeType: 'DIRECT_SEE' | 'PASSIVE_HANGING' | 'NONE';
} {
  let board: Chess;
  try {
    board = new Chess(fenBefore);
  } catch {
    return { isSacrifice: false, netMaterialLost: 0, sacrificeType: 'NONE' };
  }
  const playerColor: Color = board.turn();

  const from = playedMoveUci.slice(0, 2) as Square;
  const to = playedMoveUci.slice(2, 4) as Square;
  const promotion = (playedMoveUci.length > 4 ? playedMoveUci[4] : undefined) as PieceSymbol | undefined;

  let moveObj;
  try {
    moveObj = board.move({ from, to, promotion });
  } catch {
    return { isSacrifice: false, netMaterialLost: 0, sacrificeType: 'NONE' };
  }
  if (!moveObj) {
    return { isSacrifice: false, netMaterialLost: 0, sacrificeType: 'NONE' };
  }

  // ---------------------------------------------------------------------------
  // 1. CEK DIRECT SACRIFICE (Pengorbanan di petak tujuan langkah baru)
  // ---------------------------------------------------------------------------
  const initialGain = moveObj.captured ? PIECE_VALUES[moveObj.captured] : 0;
  // Jika langkah promosi, nilai bidak di petak tujuan adalah bidak promosi
  const movedPieceValue = moveObj.promotion
    ? PIECE_VALUES[moveObj.promotion]
    : PIECE_VALUES[moveObj.piece];

  // Hanya perwira (Kuda, Gajah, Benteng, Menteri) yang dihitung sebagai pengorbanan Brilliant
  if (movedPieceValue >= 3) {
    // Berapa keuntungan bersih lawan jika lawan memakan bidak kita yang baru saja pindah ke petak `to`?
    const opponentGainOnTarget = calculateCaptureGainOnSquare(board, to);
    const netDirectSEE = initialGain - opponentGainOnTarget;

    // Jika kita rugi bersih >= 2 poin (misal: Kuda gratis = -3, Benteng tukar Gajah = -2)
    if (netDirectSEE <= -2) {
      return {
        isSacrifice: true,
        netMaterialLost: Math.abs(netDirectSEE),
        sacrificeType: 'DIRECT_SEE',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. CEK PASSIVE SACRIFICE (Meninggalkan perwira lain tergantung / En Prise)
  // ---------------------------------------------------------------------------
  // Cari semua petak yang berisi perwira milik pemain (selain pion dan raja, dan selain petak `to`)
  let maxHangingLoss = 0;
  const boardArray = board.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = boardArray[r][c];
      if (
        cell &&
        cell.color === playerColor &&
        cell.square !== to &&
        PIECE_VALUES[cell.type] >= 3 &&
        cell.type !== 'k'
      ) {
        // Berapa keuntungan bersih lawan jika lawan memakan perwira kita di petak ini?
        const opponentGainOnHanging = calculateCaptureGainOnSquare(board, cell.square);
        // Kurangi dengan keuntungan yang baru saja kita dapat di langkah `moveObj` (misal kita baru saja makan Menteri lawan)
        const netPassiveLoss = opponentGainOnHanging - initialGain;

        if (netPassiveLoss > maxHangingLoss) {
          maxHangingLoss = netPassiveLoss;
        }
      }
    }
  }

  if (maxHangingLoss >= 2) {
    return {
      isSacrifice: true,
      netMaterialLost: maxHangingLoss,
      sacrificeType: 'PASSIVE_HANGING',
    };
  }

  return { isSacrifice: false, netMaterialLost: 0, sacrificeType: 'NONE' };
}

/**
 * FUNGSI UTAMA: Menentukan apakah langkah berhak mendapat label BRILLIANT (!!)
 */
export function isBrilliantMove(input: BrilliantCheckInput): boolean {
  const { fenBefore, playedMoveUci, pv1, pv2, playedEP } = input;

  const ep1 = evalToEP(pv1.cp, pv1.mate);
  const ep2 = pv2 ? evalToEP(pv2.cp, pv2.mate) : 0;
  const epLoss = Math.max(0, ep1 - playedEP);

  // GERBANG 1: Harus merupakan Best Move (atau selisih EP <= 1.5%)
  const isTopEngineChoice = !pv1.moveUci || playedMoveUci === pv1.moveUci || epLoss <= 0.015;
  if (!isTopEngineChoice) return false;

  // GERBANG 2: Posisi setelah pengorbanan tidak boleh kalah (EP >= 0.40)
  if (playedEP < 0.40) return false;

  // GERBANG 3: Filter posisi yang sudah menang telak (Already Completely Winning)
  // Jika EP1 > 92% DAN langkah alternatif kedua (EP2) juga masih menang mudah (> 85%),
  // maka pengorbanan tersebut hanya "pamer" di posisi menang, bukan Brilliant krusial —
  // KECUALI langkah tersebut menghasilkan skakmat paksa (pv1.mate > 0).
  if (ep1 > 0.92 && pv2 !== undefined && ep2 > 0.85 && pv1.mate === undefined) {
    return false;
  }

  // GERBANG 4: Pengecekan Pengorbanan Materi menggunakan SEE + Hanging Piece Check
  const sacResult = isMaterialSacrifice(fenBefore, playedMoveUci);
  if (!sacResult.isSacrifice && !detectPieceSacrifice(fenBefore, playedMoveUci)) {
    return false;
  }

  // GERBANG 5: Pastikan bukan kondisi "terpaksa buang perwira karena semua perwira terjebak"
  return true;
}

function legalMoveCount(fen: string): number {
  try {
    return new Chess(fen).moves().length;
  } catch {
    return 99;
  }
}

/**
 * Memeriksa apakah sebuah langkah memanfaatkan pin mutlak (absolute pin) ke Raja lawan:
 * Pemain melangkahkan perwira bernilai (Q, R, B, N) ke petak `to`.
 * Petak `to` tersebut berada dalam jangkauan pukul perwira lawan `P`,
 * TETAPI perwira lawan `P` tidak dapat memukul karena ter-PIN MUTLAK ke Raja lawan
 * oleh perwira penyerang kita yang berada di garis yang sama.
 */
export function isTacticalPinExploit(fenBefore: string, playedMoveUci: string): boolean {
  if (!fenBefore || !playedMoveUci || playedMoveUci.length < 4) return false;
  try {
    const board = new Chess(fenBefore);
    const from = playedMoveUci.slice(0, 2) as Square;
    const to = playedMoveUci.slice(2, 4) as Square;
    const movingPiece = board.get(from);
    // Hanya perwira (Queen, Rook, Bishop, Knight), bukan pion biasa atau raja
    if (!movingPiece || movingPiece.type === 'p' || movingPiece.type === 'k') return false;

    const moverColor = board.turn();
    const enemyColor: Color = moverColor === 'w' ? 'b' : 'w';

    // Eksekusi langkah pada board simulasi
    const moveRes = board.move({ from, to, promotion: (playedMoveUci[4] as any) || 'q' });
    if (!moveRes) return false;

    // Temukan posisi Raja lawan
    let enemyKingSq: Square | null = null;
    const b = board.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && p.color === enemyColor && p.type === 'k') {
          enemyKingSq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
          break;
        }
      }
      if (enemyKingSq) break;
    }
    if (!enemyKingSq) return false;

    const kFile = enemyKingSq.charCodeAt(0) - 97;
    const kRank = parseInt(enemyKingSq[1], 10) - 1;
    const toFile = to.charCodeAt(0) - 97;
    const toRank = parseInt(to[1], 10) - 1;

    // 8 arah sinar (ray directions) dari Raja lawan
    const directions = [
      [1, 0], [-1, 0], [0, 1], [0, -1], // Lurus (Rook, Queen)
      [1, 1], [1, -1], [-1, 1], [-1, -1], // Diagonal (Bishop, Queen)
    ];

    for (const [df, dr] of directions) {
      let f = kFile + df;
      let r = kRank + dr;

      let pinnedPieceSq: Square | null = null;
      let pinnedPiece: { type: PieceSymbol; color: Color } | null = null;

      // Telusuri sepanjang garis dari Raja
      while (f >= 0 && f < 8 && r >= 0 && r < 8) {
        const sq = (String.fromCharCode(97 + f) + (r + 1)) as Square;
        const piece = board.get(sq);

        if (piece) {
          if (!pinnedPieceSq) {
            // Perwira pertama yang ditemui harus perwira lawan (kandidat perwira yang ter-pin)
            if (piece.color === enemyColor) {
              pinnedPieceSq = sq;
              pinnedPiece = piece;
            } else {
              // Jika perwira pertama adalah perwira kita, bukan pin
              break;
            }
          } else {
            // Perwira kedua yang ditemui sepanjang garis:
            // Harus perwira kita yang melakukan pin (Rook/Queen untuk lurus, Bishop/Queen untuk diagonal)
            const isStraight = df === 0 || dr === 0;
            const isDiag = Math.abs(df) === Math.abs(dr);
            const isPinningSlider =
              piece.color === moverColor &&
              ((isStraight && (piece.type === 'r' || piece.type === 'q')) ||
                (isDiag && (piece.type === 'b' || piece.type === 'q')));

            if (isPinningSlider && pinnedPieceSq && pinnedPiece) {
              // DITEMUKAN PIN MUTLAK ASLI!
              // Pinned piece berada di pinnedPieceSq.
              // Sekarang periksa: Apakah pinned piece ini secara geometris bisa memukul `to`?
              const pFile = pinnedPieceSq.charCodeAt(0) - 97;
              const pRank = parseInt(pinnedPieceSq[1], 10) - 1;

              let canReachTo = false;

              if (pinnedPiece.type === 'p') {
                // Pion lawan memukul diagonal 1 petak ke arah moverColor
                const pawnCaptureRank = enemyColor === 'w' ? pRank + 1 : pRank - 1;
                if (toRank === pawnCaptureRank && Math.abs(toFile - pFile) === 1) {
                  canReachTo = true;
                }
              } else if (pinnedPiece.type === 'n') {
                // Kuda
                const dff = Math.abs(toFile - pFile);
                const drr = Math.abs(toRank - pRank);
                if ((dff === 1 && drr === 2) || (dff === 2 && drr === 1)) {
                  canReachTo = true;
                }
              } else if (pinnedPiece.type === 'b' || pinnedPiece.type === 'r' || pinnedPiece.type === 'q') {
                // Cek apakah jalur antara pinnedPieceSq dan `to` kosong
                const dff = toFile - pFile;
                const drr = toRank - pRank;
                const stepF = dff === 0 ? 0 : dff > 0 ? 1 : -1;
                const stepR = drr === 0 ? 0 : drr > 0 ? 1 : -1;
                const isStraightMove = (dff === 0 && drr !== 0) || (drr === 0 && dff !== 0);
                const isDiagMove = Math.abs(dff) === Math.abs(drr) && dff !== 0;

                const pieceCanMove =
                  (pinnedPiece.type === 'b' && isDiagMove) ||
                  (pinnedPiece.type === 'r' && isStraightMove) ||
                  (pinnedPiece.type === 'q' && (isDiagMove || isStraightMove));

                if (pieceCanMove) {
                  let pathClear = true;
                  let curF = pFile + stepF;
                  let curR = pRank + stepR;
                  while (curF !== toFile || curR !== toRank) {
                    const checkSq = (String.fromCharCode(97 + curF) + (curR + 1)) as Square;
                    if (board.get(checkSq)) {
                      pathClear = false;
                      break;
                    }
                    curF += stepF;
                    curR += stepR;
                  }
                  if (pathClear) {
                    canReachTo = true;
                  }
                }
              }

              if (canReachTo) {
                // Periksa apakah `to` TIDAK berada di garis pin yang sama!
                // Jika `to` berada di luar garis pin, pinned piece TIDAK BISA memukulnya karena ter-pin ke Raja!
                const legalMoves = board.moves({ square: pinnedPieceSq, verbose: true });
                const isLegallyAbleToCapture = legalMoves.some((m) => m.to === to);
                if (!isLegallyAbleToCapture) {
                  // INILAH EKSPLOITASI PIN ASLI!
                  return true;
                }
              }
            }
            // Sinar terhalang setelah perwira kedua
            break;
          }
        }
        f += df;
        r += dr;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface GreatMoveContext {
  fenBefore?: string;
  playedMoveUci: string;
  legalMovesCount: number;
  isSimpleRecapture: boolean; // True jika hanya memukul balik di petak yang sama dengan nilai setara
  pv1: EngineLine;            // Langkah terbaik #1 dari Stockfish sebelum melangkah
  pv2?: EngineLine;           // Langkah terbaik #2 dari Stockfish sebelum melangkah
  prevPlayerEP: number;       // Expected Points pemain pada 1 langkah sebelumnya (sebelum lawan jalan)
  playedEP: number;           // Expected Points setelah langkah pemain dieksekusi
}

/**
 * Fungsi utama penentu apakah sebuah langkah adalah Great Move (!)
 */
export function isGreatMove(ctx: GreatMoveContext): boolean {
  const { fenBefore, playedMoveUci, legalMovesCount, isSimpleRecapture, pv1, pv2, prevPlayerEP, playedEP } = ctx;

  // 1. Jika hanya ada 1 langkah legal (misal: satu-satunya langkah keluar dari skak), bukan Great Move
  if (legalMovesCount <= 1) {
    return false;
  }

  const ep1 = evalToExpectedPoints(pv1.cp, pv1.mate);
  const ep2 = pv2 ? evalToExpectedPoints(pv2.cp, pv2.mate) : ep1;
  const epLoss = Math.max(0, ep1 - playedEP);

  // Hitung selisih eksklusivitas antara pilihan #1 dan pilihan #2 (MultiPV Gap)
  const multiPvGap = pv2 ? Math.max(0, ep1 - ep2) : 0;

  // SKENARIO 0: Eksploitasi Pin Taktis Asli (seperti Qd7-h3! di mana pion g2 ter-pin mutlak ke Raja g1 oleh Rg8)
  if (fenBefore && isTacticalPinExploit(fenBefore, playedMoveUci) && playedEP >= 0.85 && epLoss <= 0.05) {
    return true;
  }

  // 2. Syarat Wajib: Harus merupakan Best Move (atau selisih EP <= 1.5%)
  const isBestMove = !pv1.moveUci || playedMoveUci === pv1.moveUci || epLoss <= 0.015;
  if (!isBestMove) {
    return false;
  }

  // 3. Syarat Wajib: Posisi setelah melangkah tidak boleh masih kalah telak (EP >= 0.20)
  if (playedEP < 0.20) {
    return false;
  }

  if (!pv2) {
    return false;
  }

  // 4. Filter Noise: Jika posisi sudah menang mutlak sejak awal DAN langkah ke-2 juga masih menang mutlak
  if (ep1 > 0.92 && ep2 > 0.80 && pv1.mate === undefined) {
    return false;
  }

  // 5. Filter Recapture Sederhana:
  // Jika lawan makan perwira kita dan kita hanya makan balik, butuh gap yang sangat ekstrem
  if (isSimpleRecapture && multiPvGap < 0.35) {
    return false;
  }

  // ============================================================================
  // SKENARIO 1: "THE ONLY MOVE" (Langkah Tunggal Penyelamat / Penjaga Keunggulan)
  // ============================================================================
  if (multiPvGap >= 0.15) {
    return true;
  }

  // ============================================================================
  // SKENARIO 2: "GAME CHANGER" (Membalikkan Keadaan Setelah Lawan Lengah)
  // ============================================================================
  const savedLostGame = prevPlayerEP <= 0.35 && playedEP >= 0.50 && multiPvGap >= 0.10;
  const seizedWinningAdvantage = prevPlayerEP <= 0.55 && playedEP >= 0.72 && multiPvGap >= 0.10;

  if (savedLostGame || seizedWinningAdvantage) {
    return true;
  }

  // ============================================================================
  // SKENARIO 3: MENEMUKAN SKAKMAT PAKSA KRUSIAL (Mate in 2+)
  // ============================================================================
  if (pv1.mate !== undefined && pv1.mate >= 2 && pv2.mate === undefined && ep2 < 0.85) {
    return true;
  }

  return false;
}

/** Warna panah feedback per jenis langkah terbaik (samakan dengan warna ikon di UI jika berbeda). */
export const ARROW_COLORS: Record<'best' | 'great' | 'brilliant', string> = {
  best: '#81b64c', // hijau (default)
  great: '#749bbf', // biru
  brilliant: '#1baca6', // teal, warna ikon Brilliant
};

export function arrowColorForLabel(label?: ReviewLabel | null): string {
  if (label === 'brilliant') return ARROW_COLORS.brilliant;
  if (label === 'great') return ARROW_COLORS.great;
  return ARROW_COLORS.best;
}

/** Peringkat kualitas label. Panah muncul jika peringkat langkah terbaik engine > peringkat langkah yang dimainkan. */
const LABEL_RANK: Record<ReviewLabel, number> = {
  blunder: 0,
  mistake: 1,
  miss: 1,
  inaccuracy: 2,
  good: 3,
  excellent: 4,
  best: 5,
  book: 5,
  great: 6,
  brilliant: 7,
};

/**
 * Label yang AKAN didapat langkah terbaik engine seandainya dimainkan
 * (Best / Great / Brilliant), memakai logika classifyCore yang sama.
 * Mengembalikan null jika tidak bisa ditentukan.
 */
function labelOfEngineTopMove(
  m: { ply: number; color: 'w' | 'b'; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; fen: string },
  before: PositionScore,
  prevLoss: number,
  prevMove?: { to: string; captured?: string; classification?: ReviewLabel; loss?: number }
): ReviewLabel | null {
  const top = before.lines?.[0];
  const bestUci = before.bestUci || top?.uci;
  if (!top || !bestUci || bestUci.length < 4) return null;
  try {
    const board = new Chess(before.fen);
    const mv = board.move({
      from: bestUci.slice(0, 2) as Square,
      to: bestUci.slice(2, 4) as Square,
      promotion: bestUci.length > 4 ? (bestUci[4] as PieceSymbol) : undefined,
    });
    if (!mv) return null;

    // Skor mat pada baris engine dihitung dari posisi SEBELUM langkah (sudut pandang Putih).
    // Jika yang mengejar mat adalah pemain yang melangkah, setelah langkah itu sisa mat berkurang 1.
    const sign = m.color === 'w' ? 1 : -1;
    let afterMate: number | undefined = top.mate;
    if (afterMate !== undefined && afterMate * sign > 0) {
      const remaining = Math.abs(afterMate) - 1;
      afterMate = remaining === 0 ? undefined : sign * remaining;
    }

    const afterScore: PositionScore = {
      fen: board.fen(),
      cp: top.cp,
      mate: afterMate,
      winWhite: top.winWhite,
      scoreDisplay: top.scoreDisplay,
    };
    const fakeMove = {
      ply: m.ply,
      color: m.color,
      san: mv.san,
      from: mv.from,
      to: mv.to,
      piece: mv.piece,
      captured: mv.captured,
      promotion: mv.promotion,
      fen: board.fen(),
    };
    const label = classifyCore(fakeMove, before, afterScore, prevLoss, prevMove).label;
    return label === 'book' ? 'best' : label;
  } catch {
    return null;
  }
}

/**
 * Menentukan panah feedback. Panah ditampilkan jika langkah yang dimainkan BUKAN langkah terbaik engine
 * DAN label langkah terbaik engine lebih tinggi daripada label langkah yang dimainkan.
 * Contoh: Excellent/Good -> panah hijau (Best); Great padahal ada Brilliant -> panah Brilliant.
 */
function finalizeReviewedMove(
  result: ReviewedMove,
  playedUci: string,
  rawBestUci?: string,
  rawBestSan?: string,
  bestLabel: ReviewLabel | null = null
): ReviewedMove {
  const hasBest = !!rawBestUci && rawBestUci.length >= 4;
  const sameMove = hasBest && playedUci.slice(0, 4) === rawBestUci!.slice(0, 4);
  const targetLabel: ReviewLabel = bestLabel ?? 'best';
  const showArrow =
    hasBest &&
    !sameMove &&
    result.label !== 'book' &&
    LABEL_RANK[targetLabel] > LABEL_RANK[result.label];

  return {
    ...result,
    bestUci: showArrow ? rawBestUci : undefined,
    bestSan: showArrow ? rawBestSan : undefined,
    engineBestUci: rawBestUci,
    engineBestSan: rawBestSan,
    bestLabel: showArrow ? targetLabel : undefined,
    feedbackArrow: showArrow
      ? {
        from: rawBestUci!.slice(0, 2) as Square,
        to: rawBestUci!.slice(2, 4) as Square,
        color: arrowColorForLabel(targetLabel),
        label: targetLabel,
      }
      : null,
  };
}

export function classifyByEngine(
  m: { ply: number; color: 'w' | 'b'; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; fen: string },
  before: PositionScore,
  after: PositionScore,
  prevLoss: number, // loss of opponent's previous move (0..100)
  prevMove?: { to: string; captured?: string; classification?: ReviewLabel; loss?: number }
): ReviewedMove {
  const playedUci = `${m.from}${m.to}${m.promotion || ''}`;
  const rawBestUci = before.bestUci || before.lines?.[0]?.uci || undefined;
  const rawBestSan = before.bestSan || before.lines?.[0]?.san || undefined;
  const rawResult = classifyCore(m, before, after, prevLoss, prevMove);
  const bestLabel = labelOfEngineTopMove(m, before, prevLoss, prevMove);
  return finalizeReviewedMove(rawResult, playedUci, rawBestUci, rawBestSan, bestLabel);
}

function classifyCore(
  m: { ply: number; color: 'w' | 'b'; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; fen: string },
  before: PositionScore,
  after: PositionScore,
  prevLoss: number,
  prevMove?: { to: string; captured?: string; classification?: ReviewLabel; loss?: number }
): ReviewedMove {
  const moverCp = (s: PositionScore) => (m.color === 'w' ? s.cp : -s.cp);
  const moverMate = (s: PositionScore) => (s.mate !== undefined ? (m.color === 'w' ? s.mate : -s.mate) : null);

  const playedUci = `${m.from}${m.to}${m.promotion || ''}`;
  const bestMoveUci = before.bestUci || before.lines?.[0]?.uci || '';

  const cpBefore = moverCp(before);
  const mateBefore = moverMate(before);
  const cpAfter = moverCp(after);
  const mateAfter = moverMate(after);

  const winProbBefore = getWinProbability(cpBefore, mateBefore);
  const winProbAfter = getWinProbability(cpAfter, mateAfter);
  const winProbLost = Math.max(0, winProbBefore - winProbAfter);
  const cpLoss = Math.max(0, cpBefore - cpAfter);
  const loss = Math.round(winProbLost * 1000) / 10;
  const accuracy = calculateMoveAccuracy(winProbLost);

  // cpLoss TIDAK boleh dipakai jika ada skor mat (cp mat = +-10000 -> selisih palsu raksasa)
  // atau jika posisi sudah di ekor datar sigmoid (sudah menang / kalah mutlak), karena selisih cp
  // di sana hampir tidak mengubah peluang menang dan chess.com tidak memberi label apa pun.
  const hasMateScore =
    (mateBefore !== null && mateBefore !== undefined) || (mateAfter !== null && mateAfter !== undefined);
  const inFlatTail = winProbBefore < 0.03 || winProbBefore > 0.97;
  const cpLossUsed = hasMateScore || inFlatTail ? 0 : cpLoss;

  const base = {
    loss,
    accuracy,
    bestUci: bestMoveUci || before.bestUci || before.lines?.[0]?.uci || undefined,
    bestSan: before.bestSan || before.lines?.[0]?.san || undefined,
    evalBefore: before,
    evalAfter: after,
  };

  // Hasil dengan loss minimum yang dipaksa (mat hilang / masuk mat). WAJIB ikut menurunkan accuracy,
  // karena winProbLost untuk skor mat hampir 0 sehingga accuracy bawaan ~100% dan menggelembungkan rating.
  const forcedLoss = (label: ReviewLabel, minLoss: number): ReviewedMove => {
    const effLoss = Math.max(loss, minLoss);
    return { ...base, loss: effLoss, accuracy: calculateMoveAccuracy(effLoss / 100), label };
  };

  const legalMoves = legalMoveCount(before.fen);

  if (m.san.includes('#')) return { ...base, label: 'best' };

  // 1. FORCED MOVE
  // Hanya ada 1 langkah legal pada posisi before -> diklasifikasikan sebagai Best Move (★)
  if (legalMoves <= 1) {
    return { ...base, loss: 0, accuracy: 100, label: 'best' };
  }

  // 2. BOOK MOVE (📖)
  // Selama langkah sesuai teori buku pembukaan (ECO Explorer database dan ply <= 24)
  const isOpeningBook =
    (m.ply <= 24 && isBookPosition(m.fen)) ||
    (m.ply <= 2 &&
      ['e4', 'd4', 'c4', 'Nf3', 'g3', 'b3', 'f4', 'e5', 'd5', 'c5', 'e6', 'c6', 'Nf6', 'g6', 'd6', 'Nc6'].includes(
        m.san
      ));
  if (isOpeningBook) return { ...base, loss: 0, accuracy: 100, label: 'book' };

  // Fallback jika bestMoveUci kosong (misal dari Web Worker), namun langkah tidak kehilangan winProb atau mengarah ke skakmat
  const isEngineTopMove = (!!bestMoveUci && playedUci === bestMoveUci) || (!bestMoveUci && winProbLost <= 0.005);

  const hadForcedMate = mateBefore !== null && mateBefore !== undefined && mateBefore > 0;
  const hasForcedMateAfter = mateAfter !== null && mateAfter !== undefined && mateAfter > 0;

  const secondLine = before.lines && before.lines.length >= 2 ? before.lines[1] : undefined;
  let winProbSecondBest = winProbBefore;
  let secondBestHasForcedMate = false;
  let uniquenessGap = 0;

  if (secondLine) {
    const secondCp = moverCp({ cp: secondLine.cp } as any);
    const secondMate = moverMate({ mate: secondLine.mate } as any);
    secondBestHasForcedMate = secondMate !== null && secondMate !== undefined && secondMate > 0;
    winProbSecondBest = getWinProbability(secondCp, secondMate);
    uniquenessGap = Math.max(0, winProbBefore - winProbSecondBest);
  }

  const directMaterialBlunderLoss = getDirectMaterialBlunderLoss(before.fen, playedUci);
  const isUnsoundPieceHangInLostPos =
    !isEngineTopMove && directMaterialBlunderLoss >= 300 && winProbAfter < 0.25 && cpLoss >= 250;

  // 3. BRILLIANT MOVE (!!)
  // Sesuai Section 4 & 5 Chess Analysis Architecture:
  // - Langkah adalah Top Move (#1 engine atau hampir terbaik winProbLost <= 0.015, atau menghasilkan skakmat paksa)
  // - Terdeteksi pengorbanan materi perwira nyata (detectPieceSacrifice atau isMaterialSacrifice)
  // - Setelah melangkah posisi tetap prima / tidak kalah (winProbAfter >= 0.40)
  // - Bukan sekadar pertukaran bidak yang sama (recapture)
  // - Filter anti-showoff: Diizinkan pada posisi menang/skakmat paksa (misal Rxg2+!! menuju -M2) atau jika opsi ke-2 belum menang mudah
  const isRecapture = !!prevMove?.captured && prevMove.to === m.to && !!m.captured;
  const isSacrifice =
    detectPieceSacrifice(before.fen, playedUci) ||
    isMaterialSacrifice(before.fen, playedUci).isSacrifice;

  const isNotTrivialWinningShowoff =
    winProbBefore < 0.92 ||
    hasForcedMateAfter ||
    hadForcedMate ||
    (secondLine !== undefined && winProbSecondBest < 0.85 && !secondBestHasForcedMate);

  if (
    !isUnsoundPieceHangInLostPos &&
    (isEngineTopMove || winProbLost <= 0.015 || hasForcedMateAfter) &&
    isSacrifice &&
    !isRecapture &&
    isNotTrivialWinningShowoff &&
    winProbAfter >= 0.40
  ) {
    return { ...base, accuracy: 100, label: 'brilliant' };
  }

  // 4. GREAT MOVE (!)
  // Skenario A: Eksploitasi Pin Taktis Asli (Pseudo-Sacrifice seperti Qd7-h3! di mana pion g2 ter-pin mutlak ke Kg1 oleh Rg8)
  const isPinExploit = isTacticalPinExploit(before.fen, playedUci);
  if (
    legalMoves > 1 &&
    isPinExploit &&
    winProbAfter >= 0.30 &&
    (isEngineTopMove || (winProbAfter >= 0.85 && winProbLost <= 0.05)) &&
    (!secondLine || uniquenessGap >= 0.05 || hasForcedMateAfter || winProbAfter >= 0.85)
  ) {
    return { ...base, loss: 0, accuracy: 100, label: 'great' };
  }

  // Syarat Standar Chess.com untuk Great Move lainnya:
  // - WAJIB merupakan langkah #1 terbaik engine (isEngineTopMove === true)
  // - Bukan langkah paksa (legalMoves > 1)
  // - Posisi setelah melangkah tetap prima / terjaga (winProbAfter >= 0.30)
  if (isEngineTopMove && legalMoves > 1 && winProbAfter >= 0.30) {
    // Skenario B: Menemukan Skakmat Paksa (Mate in 2+) dari posisi non-mate, atau satu-satunya langkah skakmat paksa
    const foundNewForcedMate =
      (!hadForcedMate && hasForcedMateAfter) ||
      (hasForcedMateAfter && secondLine !== undefined && !secondBestHasForcedMate && winProbSecondBest < 0.90);
    if (foundNewForcedMate && (!secondLine || uniquenessGap >= 0.05 || !secondBestHasForcedMate)) {
      return { ...base, accuracy: 100, label: 'great' };
    }

    if (winProbBefore <= 0.95) {
      // Skenario C: "The Only Move" (Langkah #1 mutlak unggul >= 15% dibanding langkah terbaik #2)
      if (uniquenessGap >= 0.15) {
        return { ...base, accuracy: 100, label: 'great' };
      }

      // Skenario D: Game Changer (Menyelamatkan game kalah / melonjak dari seimbang menjadi menang dengan gap >= 10%)
      const savedLostGame = winProbBefore <= 0.35 && winProbAfter >= 0.50 && uniquenessGap >= 0.10;
      const seizedWin = winProbBefore <= 0.55 && winProbAfter >= 0.72 && uniquenessGap >= 0.10;
      if (savedLostGame || seizedWin) {
        return { ...base, accuracy: 100, label: 'great' };
      }
    }
  }

  // 5. BEST MOVE (★)
  // HANYA diberikan jika pemain benar-benar menemukan langkah pilihan pertama engine (#1 Best Move)
  if (isEngineTopMove) {
    return { ...base, label: 'best' };
  }

  // 6. PENANGANAN KHUSUS MENARUH PERWIRA GRATIS DI POSISI KALAH (Sigmoid Flat-Tail Guard)
  // Contoh: Gambar Qe4 (image_6df7a2.png) di mana Putih sudah kalah telak (-18.0 / winProbBefore ~ 0.025)
  // lalu melangkahkan Menteri ke e4 yang langsung dapat dimakan gratis oleh Kuda f6 (...Nxe4, eval menjadi -29.7).
  // Karena kedua nilai cp sudah terkena clamp -1000 di fungsi sigmoid, winProbLost menjadi 0.000.
  // Tanpa guard ini, membuang Menteri gratis di posisi kalah akan salah diberi label "Excellent 👍"!
  if (directMaterialBlunderLoss >= 300 && cpLoss >= 250 && winProbAfter < 0.30) {
    if (directMaterialBlunderLoss >= 700 && cpBefore > -1500) {
      const effLoss = Math.max(loss, 12);
      return {
        ...base,
        loss: effLoss,
        accuracy: calculateMoveAccuracy(effLoss / 100),
        label: 'mistake',
      };
    }
    const effLoss = Math.max(loss, 6);
    return {
      ...base,
      loss: effLoss,
      accuracy: calculateMoveAccuracy(effLoss / 100),
      label: 'inaccuracy',
    };
  }

  // 7. BLUNDER (MATE) & MISSED MATE (?? / ❌)
  // Memeriksa kasus khusus skakmat paksa (Missed Forced Mate)
  if (hadForcedMate && !isEngineTopMove) {
    // Jika membuang forced mate dan posisi berbalik imbang/kalah (winProbAfter < 0.50) -> Blunder
    if (!hasForcedMateAfter && winProbAfter < 0.50) {
      return forcedLoss('blunder', 30);
    }

    // Membuang forced mate sama sekali -> Miss, MESKIPUN posisi masih menang besar
    // (mis. 22...Qh1+ dan 25...Rxf1+ pada partai contoh, di mana Qxg2# tersedia).
    if (!hasForcedMateAfter) {
      return forcedLoss('miss', 15);
    }

    // Mat masih ada tetapi LEBIH LAMBAT dari mat terbaik (mis. 21...e3 padahal ada Qxg2#).
    // Langkah mat tercepat menyisakan (mateBefore - 1) setelah dimainkan, jadi mateAfter >= mateBefore
    // berarti satu langkah lebih lambat atau lebih. Dibatasi mat pendek (<= 2) agar
    // "M6 -> M7" tidak ikut dihukum.
    if (mateBefore !== null && mateBefore <= 2 && (mateAfter as number) >= mateBefore) {
      return forcedLoss('miss', 15);
    }
  }

  // Melangkah masuk ke skakmat paksa lawan:
  // Hanya dihitung Blunder jika posisi sebelumnya belum kalah telak (winProbBefore >= 0.30).
  const steppedIntoForcedMate =
    !hadForcedMate &&
    (mateBefore === null || mateBefore === undefined || mateBefore >= 0) &&
    mateAfter !== null &&
    mateAfter !== undefined &&
    mateAfter < 0 &&
    winProbBefore >= 0.30;

  if (steppedIntoForcedMate) {
    return forcedLoss('blunder', 25);
  }

  // 8. MISS (❌)
  // Lawan baru saja Blunder atau Mistake pada langkah sebelumnya (delta W prev >= 15%),
  // namun pemain gagal mengeksekusi keunggulan tersebut (winProbLost >= 0.15 dan posisi belum menang mutlak winProbBefore <= 0.90)
  const opponentBlunderedLastTurn =
    prevMove?.classification === 'blunder' ||
    prevMove?.classification === 'mistake' ||
    (prevMove?.loss !== undefined ? prevMove.loss >= 15 : prevLoss >= 15);

  if (opponentBlunderedLastTurn && winProbLost >= 0.15 && winProbAfter >= 0.35 && winProbBefore <= 0.90) {
    return { ...base, label: 'miss' };
  }

  // 9 - 13. STANDARD WIN-PROBABILITY THRESHOLDS
  if (winProbLost >= 0.20) {
    return { ...base, label: 'blunder' };
  }
  if (winProbLost >= 0.10) {
    return { ...base, label: 'mistake' };
  }
  if (winProbLost >= 0.05) {
    return { ...base, label: 'inaccuracy' };
  }
  if (winProbLost <= 0.02 && cpLossUsed < 150) {
    return { ...base, label: 'excellent' };
  }
  if (cpLossUsed < 300) {
    return { ...base, label: 'good' };
  }
  const effLoss = Math.max(loss, 6);
  return {
    ...base,
    loss: effLoss,
    accuracy: calculateMoveAccuracy(effLoss / 100),
    label: 'inaccuracy',
  };
}

/**
 * Calculates estimated Chess.com Game Performance Rating based on CAPS Accuracy & move quality
 */
/**
 * Menghitung jumlah tiap label dari daftar langkah hasil review.
 * Tidak peka huruf besar/kecil ('miss' / 'Miss') dan membaca field `label` maupun `classification`,
 * supaya Miss tidak pernah terbaca 0 hanya karena beda penulisan.
 */
export function countReviewLabels(
  moves: Array<{ label?: string; classification?: string } | null | undefined>
): Record<ReviewLabel, number> {
  const out: Record<ReviewLabel, number> = {
    brilliant: 0, great: 0, book: 0, best: 0, excellent: 0,
    good: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0,
  };
  for (const mv of moves) {
    const key = String(mv?.label ?? mv?.classification ?? '').toLowerCase() as ReviewLabel;
    if (key in out) out[key] += 1;
  }
  return out;
}

export function calculateGameRating(
  accuracy: number,
  counts: { brilliant?: number; great?: number; best?: number; mistake?: number; miss?: number; blunder?: number },
  baseRating?: number
): number {
  let est = 0;
  if (accuracy >= 98) est = 2500 + (accuracy - 98) * 150;
  else if (accuracy >= 95) est = 2200 + (accuracy - 95) * 100;
  else if (accuracy >= 90) est = 1850 + (accuracy - 90) * 70;
  else if (accuracy >= 80) est = 1450 + (accuracy - 80) * 40;
  else if (accuracy >= 70) est = 1100 + (accuracy - 70) * 35;
  else if (accuracy >= 60) est = 800 + (accuracy - 60) * 30;
  else if (accuracy >= 50) est = 550 + (accuracy - 50) * 25;
  else est = Math.max(250, 300 + accuracy * 5);

  est += (counts.brilliant || 0) * 40;
  est += (counts.great || 0) * 20;
  est -= (counts.mistake || 0) * 15;
  est -= (counts.miss || 0) * 20; // estimasi, belum dikalibrasi terhadap chess.com
  est -= (counts.blunder || 0) * 35;

  if (baseRating && baseRating > 300 && baseRating < 3000) {
    est = Math.round(est * 0.75 + baseRating * 0.25);
  }

  const rounded = Math.round(est / 25) * 25;
  return Math.max(350, Math.min(2900, rounded));
}

export const LABEL_TITLE: Record<ReviewLabel, string> = {
  brilliant: 'Brilliant !! (Sangat Cemerlang)',
  great: 'Great Move ! (Langkah Hebat)',
  book: 'Book Move 📖 (Langkah Teori/Buku)',
  best: 'Best Move ★ (Langkah Terbaik)',
  excellent: 'Excellent 👍 (Sangat Bagus)',
  good: 'Good ✔ (Bagus)',
  inaccuracy: 'Inaccuracy ?! (Ketidakakuratan)',
  mistake: 'Mistake ? (Kesalahan)',
  miss: 'Miss ✖ (Melewatkan Peluang)',
  blunder: 'Blunder ?? (Kesalahan Fatal)',
};

export function describeMoveTactics(m: string | {
  san: string;
  piece?: string;
  from?: string;
  to?: string;
  captured?: string;
  promotion?: string;
}): string {
  const san = typeof m === 'string' ? m : m.san;
  if (!san) return 'Langkah posisi catur.';
  if (san === 'O-O') return 'Rokade sayap raja untuk mengamankan raja dan mengaktifkan benteng ke pusat.';
  if (san === 'O-O-O') return 'Rokade sayap ratu yang dinamis, menyiapkan serangan sayap berlawanan.';
  if (san.includes('#')) return 'Skakmat! Manuver pamungkas yang menyegel kemenangan mutlak.';
  if (san.includes('+')) return 'Melancarkan skak tajam terhadap raja lawan, merebut tempo dan inisiatif.';

  const to = typeof m === 'object' && m.to ? m.to : san.replace(/[^a-h1-8]/g, '').slice(-2);
  const isCap = san.includes('x') || (typeof m === 'object' && !!m.captured);

  if (isCap) {
    return `Memukul perwira lawan di ${to || 'petak target'} untuk merebut materi dan mempertahankan inisiatif serangan.`;
  }

  const p = typeof m === 'object' && m.piece ? m.piece.toLowerCase() : san[0] >= 'A' && san[0] <= 'Z' ? san[0].toLowerCase() : 'p';
  switch (p) {
    case 'p':
      if (['e4', 'd4', 'e5', 'd5'].includes(to)) {
        return `Mendorong pion pusat ke ${to} untuk menguasai petak sentral dan membuka ruang pengembangan perwira.`;
      }
      if (['c4', 'f4', 'c5', 'f5'].includes(to)) {
        return `Mendorong pion ke ${to} untuk menantang dominasi struktur petak tengah lawan.`;
      }
      return `Mendorong pion ke ${to} untuk memperkuat rantai bidak dan memperluas ruang permainan.`;
    case 'n':
      return `Mengembangkan kuda ke ${to}, mengontrol petak-petak penting di pusat dan memperkuat pertahanan.`;
    case 'b':
      return `Mengembangkan gajah ke diagonal terbuka di ${to} untuk meningkatkan daya tekan dan keharmonisan perwira.`;
    case 'r':
      return `Mengaktifkan benteng ke petak ${to} untuk menguasai lajur tengah yang penting.`;
    case 'q':
      return `Memposisikan ratu ke ${to} untuk menghubungkan benteng-benteng dan melancarkan tekanan ofensif.`;
    case 'k':
      return `Menggeser raja ke ${to} untuk perlindungan posisi yang lebih aman.`;
    default:
      return `Menempatkan perwira ke ${to || 'petak strategis'} untuk mengontrol posisi.`;
  }
}

export function describeReview(
  moveOrSan: string | { san: string; piece?: string; from?: string; to?: string; captured?: string; promotion?: string },
  r: ReviewedMove
): string {
  const san = typeof moveOrSan === 'string' ? moveOrSan : moveOrSan.san;
  const tactics = describeMoveTactics(moveOrSan);
  const drop = r.loss.toFixed(1);
  const best = r.bestSan ? ` Saran langkah terbaik: ${r.bestSan}.` : '';
  const ev = `(Eval: ${r.evalAfter.scoreDisplay})`;

  switch (r.label) {
    case 'brilliant':
      return `${san} - Langkah Brilian!! Pengorbanan perwira akurat yang membuka serangan mematikan. ${tactics} ${ev}`;
    case 'great':
      return `${san} - Langkah Hebat! Satu-satunya langkah terbaik yang mempertahankan posisi krusial. ${tactics} ${ev}`;
    case 'book':
      return `${san} - Langkah Buku Pembukaan (Book Move). ${tactics} Mengikuti teori master. ${ev}`;
    case 'best':
      return `${san} - Langkah Terbaik ★ Pilihan nomor satu Stockfish. ${tactics} ${ev}`;
    case 'excellent':
      return `${san} - Langkah Sangat Bagus. ${tactics} Posisi tetap prima (kehilangan hanya ${drop}% peluang menang). ${ev}`;
    case 'good':
      return `${san} - Langkah Bagus. ${tactics} Pilihan aman dan masuk akal. ${ev}`;
    case 'inaccuracy':
      return `${san} - Ketidakakuratan ?! Melepaskan sedikit keunggulan inisiatif (-${drop}% peluang menang). ${ev}${best}`;
    case 'mistake':
      return `${san} - Kesalahan ? Merusak kestabilan posisi (-${drop}% peluang menang hilang). ${ev}${best}`;
    case 'miss':
      return `${san} - Melewatkan Peluang ✖ Melewatkan kesempatan taktis untuk menghukum lawan (-${drop}%). ${ev}${best}`;
    case 'blunder':
      return `${san} - Blunder Fatal ?? Mengubah jalannya permainan secara drastis (-${drop}%). ${ev}${best}`;
  }
}