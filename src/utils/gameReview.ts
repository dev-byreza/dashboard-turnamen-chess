/**
 * Engine-based game review: every position is evaluated by the SAME Stockfish used for the
 * live eval bar, and move quality is derived from the real change in win probability
 * (the same idea Chess.com uses), instead of any heuristic / pseudo-random labelling.
 */
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { centipawnsToWinChance } from './stockfishEngine';
import { isBookPosition } from './openingBook';
import {
  getWinProbability,
  calculateMoveAccuracy,
  calculateGameAccuracy,
  detectPieceSacrifice,
  MoveClassification,
} from './chessAnalysisEngine';

export {
  getWinProbability,
  calculateMoveAccuracy,
  calculateGameAccuracy,
  detectPieceSacrifice,
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
  | 'blunder'
  | 'forced';

export interface ReviewedMove {
  label: ReviewLabel;
  loss: number; // win-probability points lost by mover (0..100)
  accuracy?: number; // 0..100% CAPS accuracy
  bestUci?: string;
  bestSan?: string;
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

export async function fetchPositionScore(
  fen: string,
  depth: number,
  signal?: AbortSignal,
  fresh = false
): Promise<PositionScore | null> {
  // Pure Stockfish 19 Lite engine evaluation via API route
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(
      `/api/stockfish?fen=${encodeURIComponent(fen)}&depth=${depth}&multipv=3${fresh ? '&fresh=1' : ''}`,
      { signal: signal || controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      if (d && d.success) {
        const cp = typeof d.scoreCp === 'number' ? d.scoreCp : 0;
        return {
          fen,
          cp,
          mate: d.mateIn,
          winWhite: d.winChanceWhite ?? centipawnsToWinChance(cp, d.mateIn),
          scoreDisplay: d.scoreDisplay ?? '0.0',
          bestUci: d.bestMoveUci || undefined,
          bestSan: d.bestMoveSan || undefined,
          lines: Array.isArray(d.lines)
            ? d.lines.map((l: any) => ({
                uci: l.uci,
                san: l.san,
                continuation: l.continuation,
                cp: l.scoreCp,
                mate: l.mateIn ?? l.mate,
                winWhite: l.winChanceWhite,
                scoreDisplay: l.scoreDisplay,
              }))
            : undefined,
        };
      }
    }
  } catch {
    // API route failed or timed out, fallback to client-side Web Worker
  }

  // 3. Fallback: Client-side Stockfish Web Worker
  try {
    if (typeof window !== 'undefined') {
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
        };
      }
    }
  } catch {
    // Both failed
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
  const isTopEngineChoice = playedMoveUci === pv1.moveUci || epLoss <= 0.015;
  if (!isTopEngineChoice) return false;

  // GERBANG 2: Posisi setelah pengorbanan tidak boleh kalah (EP >= 0.45 / setara minimal -0.35 cp)
  if (playedEP < 0.45) return false;

  // GERBANG 3: Filter posisi yang sudah menang telak (Already Completely Winning)
  // Jika EP1 > 92% DAN langkah alternatif kedua (EP2) juga masih menang mudah (> 82%),
  // maka pengorbanan tersebut hanya "pamer" di posisi menang, bukan Brilliant krusial.
  if (ep1 > 0.92 && ep2 > 0.82 && pv1.mate === undefined) {
    return false;
  }

  // GERBANG 4: Pengecekan Pengorbanan Materi menggunakan SEE + Hanging Piece Check
  const sacResult = isMaterialSacrifice(fenBefore, playedMoveUci);
  if (!sacResult.isSacrifice) {
    return false;
  }

  // GERBANG 5: Pastikan bukan kondisi "terpaksa buang perwira karena semua perwira terjebak"
  // Jika langkah hanya mempertahankan posisi yang sudah jatuh bebas, kita pastikan EP tetap kompetitif
  return true;
}

function legalMoveCount(fen: string): number {
  try {
    return new Chess(fen).moves().length;
  } catch {
    return 99;
  }
}

export interface GreatMoveContext {
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
  const { playedMoveUci, legalMovesCount, isSimpleRecapture, pv1, pv2, prevPlayerEP, playedEP } = ctx;

  // 1. Jika hanya ada 1 langkah legal (misal: satu-satunya langkah keluar dari skak), bukan Great Move
  if (legalMovesCount <= 1 || !pv2) {
    return false;
  }

  const ep1 = evalToExpectedPoints(pv1.cp, pv1.mate);
  const ep2 = evalToExpectedPoints(pv2.cp, pv2.mate);
  const epLoss = Math.max(0, ep1 - playedEP);

  // 2. Syarat Wajib: Harus merupakan Best Move (atau selisih EP <= 1.5%)
  const isBestMove = playedMoveUci === pv1.moveUci || epLoss <= 0.015;
  if (!isBestMove) {
    return false;
  }

  // 3. Syarat Wajib: Posisi setelah melangkah tidak boleh masih kalah telak (EP >= 0.20)
  if (playedEP < 0.20) {
    return false;
  }

  // 4. Filter Noise: Jika posisi sudah menang mutlak sejak awal DAN langkah ke-2 juga masih menang mutlak
  // Contoh: PV1 (+9.0 / EP 0.99) vs PV2 (+5.0 / EP 0.92) -> keduanya menang mudah, bukan Great Move
  if (ep1 > 0.92 && ep2 > 0.80) {
    return false;
  }

  // Hitung selisih eksklusivitas antara pilihan #1 dan pilihan #2 (MultiPV Gap)
  const multiPvGap = ep1 - ep2;

  // 5. Filter Recapture Sederhana:
  // Jika lawan makan perwira kita dan kita hanya makan balik, butuh gap yang sangat ekstrem
  if (isSimpleRecapture && multiPvGap < 0.35) {
    return false;
  }

  // ============================================================================
  // SKENARIO 1: "THE ONLY MOVE" (Langkah Tunggal Penyelamat / Penjaga Keunggulan)
  // ============================================================================
  // Langkah #1 unggul minimal 15% peluang menang dibanding langkah terbaik #2
  if (multiPvGap >= 0.15) {
    return true;
  }

  // ============================================================================
  // SKENARIO 2: "GAME CHANGER" (Membalikkan Keadaan Setelah Lawan Lengah)
  // ============================================================================
  // a. Dari posisi tertekan/kalah (<= 0.35) berbalik menjadi imbang/unggul (>= 0.50)
  const savedLostGame = prevPlayerEP <= 0.35 && playedEP >= 0.50 && multiPvGap >= 0.10;
  
  // b. Dari posisi seimbang (<= 0.55) melonjak menjadi menang (>= 0.72)
  const seizedWinningAdvantage = prevPlayerEP <= 0.55 && playedEP >= 0.72 && multiPvGap >= 0.10;

  if (savedLostGame || seizedWinningAdvantage) {
    return true;
  }

  // ============================================================================
  // SKENARIO 3: MENEMUKAN SKAKMAT PAKSA KRUSIAL (Mate in 2+)
  // ============================================================================
  // PV1 adalah skakmat (>= 2 langkah), sedangkan PV2 bukan skakmat dan EP2 < 0.85
  if (pv1.mate !== undefined && pv1.mate >= 2 && pv2.mate === undefined && ep2 < 0.85) {
    return true;
  }

  return false;
}

export function classifyByEngine(
  m: { ply: number; color: 'w' | 'b'; san: string; from: string; to: string; piece: string; captured?: string; promotion?: string; fen: string },
  before: PositionScore,
  after: PositionScore,
  prevLoss: number, // loss of opponent's previous move (0..100)
  prevMove?: { to: string; captured?: string; classification?: ReviewLabel; loss?: number }
): ReviewedMove {
  return classifyCore(m, before, after, prevLoss, prevMove);
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
  const bestMoveUci = before.bestUci || (before.lines?.[0]?.uci ?? playedUci);

  const cpBefore = moverCp(before);
  const mateBefore = moverMate(before);
  const cpAfter = moverCp(after);
  const mateAfter = moverMate(after);

  const winProbBefore = getWinProbability(cpBefore, mateBefore);
  const winProbAfter = getWinProbability(cpAfter, mateAfter);
  const winProbLost = Math.max(0, winProbBefore - winProbAfter);
  const loss = Math.round(winProbLost * 1000) / 10;
  const accuracy = calculateMoveAccuracy(winProbLost);

  const base = {
    loss,
    accuracy,
    bestUci: before.bestUci,
    bestSan: before.bestSan,
    evalBefore: before,
    evalAfter: after,
  };

  const legalMoves = legalMoveCount(before.fen);

  // 1. FORCED MOVE (⚪)
  // Hanya ada 1 langkah legal pada posisi before
  if (legalMoves <= 1) {
    return { ...base, loss: 0, accuracy: 100, label: 'forced' };
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

  const isBestOrNearlyBest = playedUci === bestMoveUci || winProbLost <= 0.015;

  // 3. BRILLIANT MOVE (!!)
  // Sesuai Section 4 & 5 Chess Analysis Architecture:
  // - Langkah adalah Top Move (winProbLost <= 0.015 atau playedUci === bestMoveUci)
  // - Terdeteksi pengorbanan materi perwira nyata (detectPieceSacrifice atau isMaterialSacrifice)
  // - Posisi belum menang telak (winProbBefore < 0.88)
  // - Setelah melangkah posisi tetap prima / tidak kalah (winProbAfter >= 0.40)
  // - Bukan sekadar pertukaran bidak yang sama (recapture)
  const isRecapture = !!prevMove?.captured && prevMove.to === m.to && !!m.captured;
  const isSacrifice =
    detectPieceSacrifice(before.fen, playedUci) ||
    isMaterialSacrifice(before.fen, playedUci).isSacrifice;

  if (isBestOrNearlyBest && isSacrifice && !isRecapture && winProbBefore < 0.88 && winProbAfter >= 0.40) {
    return { ...base, accuracy: 100, label: 'brilliant' };
  }

  // 4. GREAT MOVE (!)
  // Sesuai Section 4 Chess Analysis Architecture:
  // - Langkah adalah #1 bestMove (winProbLost <= 0.01 atau playedUci === bestMoveUci)
  // - Selisih WinProb antara kandidat #1 dan kandidat #2 >= 15% (Uniqueness Gap)
  // - Posisi bukan di tempat yang sudah menang telak (0.25 <= winProbAfter dan winProbBefore <= 0.92)
  const secondLine = before.lines && before.lines.length >= 2 ? before.lines[1] : undefined;
  if (secondLine && (playedUci === bestMoveUci || winProbLost <= 0.01)) {
    const secondCp = moverCp({ cp: secondLine.cp } as any);
    const secondMate = moverMate({ mate: secondLine.mate } as any);
    const winProbSecondBest = getWinProbability(secondCp, secondMate);
    const uniquenessGap = winProbBefore - winProbSecondBest;

    if (uniquenessGap >= 0.15 && winProbAfter >= 0.25 && winProbBefore <= 0.92) {
      return { ...base, accuracy: 100, label: 'great' };
    }
  }

  // 5. BEST MOVE (★)
  // Langkah pilihan pertama engine atau selisih penurunan win probability <= 1%
  if (playedUci === bestMoveUci || winProbLost <= 0.01) {
    return { ...base, label: 'best' };
  }

  // 6. BLUNDER (MATE) (??)
  // Membuang forced mate atau melangkah masuk ke forced mate lawan
  const missedForcedMate =
    mateBefore !== null &&
    mateBefore !== undefined &&
    mateBefore > 0 &&
    (mateAfter === null || mateAfter === undefined || mateAfter < 0) &&
    winProbAfter < 0.75;

  const steppedIntoForcedMate =
    (mateBefore === null || mateBefore === undefined || mateBefore > 0) &&
    mateAfter !== null &&
    mateAfter !== undefined &&
    mateAfter < 0 &&
    winProbBefore >= 0.20;

  if (missedForcedMate || steppedIntoForcedMate) {
    return { ...base, loss: Math.max(loss, 25), label: 'blunder' };
  }

  // 7. MISS (❌)
  // Lawan baru saja Blunder atau Mistake pada langkah sebelumnya (delta W prev >= 0.12),
  // namun pemain gagal mengeksekusi keunggulan tersebut (winProbLost > 0.12 dan posisi belum hancur winProbAfter >= 0.35)
  const opponentBlunderedLastTurn =
    prevMove?.classification === 'blunder' ||
    prevMove?.classification === 'mistake' ||
    (prevMove?.loss !== undefined ? prevMove.loss >= 12 : prevLoss >= 12);

  if (opponentBlunderedLastTurn && winProbLost > 0.12 && winProbAfter >= 0.35) {
    return { ...base, label: 'miss' };
  }

  // 8 - 12. STANDARD WIN-LOSS THRESHOLDS (Sesuai Matriks Tabel Section 4 Architecture.md)
  if (winProbLost <= 0.025) return { ...base, label: 'excellent' };
  if (winProbLost <= 0.055) return { ...base, label: 'good' };
  if (winProbLost <= 0.105) return { ...base, label: 'inaccuracy' };
  if (winProbLost <= 0.20) return { ...base, label: 'mistake' };
  return { ...base, label: 'blunder' };
}

/**
 * Calculates estimated Chess.com Game Performance Rating based on CAPS Accuracy & move quality
 */
export function calculateGameRating(
  accuracy: number,
  counts: { brilliant?: number; great?: number; best?: number; mistake?: number; blunder?: number },
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
  forced: 'Forced Move ⚪ (Langkah Tunggal Paksaan)',
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
    case 'forced':
      return `${san} - Langkah Paksaan ⚪ Satu-satunya langkah legal yang dapat dimainkan pada posisi ini. ${tactics} ${ev}`;
  }
}
