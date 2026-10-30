/**
 * chessAnalysisEngine.ts
 * Implementasi lengkap & akurat untuk:
 * 1. Normalisasi Evaluasi Stockfish (MultiPV)
 * 2. Kalkulasi Win Probability (Sigmoid) & Move/Game Accuracy (CAPS Model)
 * 3. Deteksi Pengorbanan Materi (Sacrifice Detector & Static Exchange Evaluation / SEE)
 * 4. Klasifikasi Langkah Sesuai Matriks Prioritas Chess.com:
 *    (Forced, Book, Brilliant, Great, Best, Miss, Blunder (Mate), Excellent, Good, Inaccuracy, Mistake, Blunder)
 * 5. UCI Engine Queue Controller & Backward Analysis Pipeline
 *
 * Sesuai arsitektur resmi di:
 * - Chess Analysis Architecture.md
 * - Chess.com libcee.so (Chess Explanation Engine / TEP)
 */

import { Chess, Move, PieceSymbol, Square, Color } from 'chess.js';
import { isTacticalPinExploit } from './gameReview';

// ============================================================================
// 1. DATA CONTRACTS & INTERFACES
// ============================================================================

export type MoveClassification =
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Book'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Miss'
  | 'Blunder';

export interface EngineLine {
  multipv: number;
  /** Skor centipawn yang SUDAH dinormalisasi ke sudut pandang pemain yang melangkah */
  cp: number | null;
  /** Skor mate yang SUDAH dinormalisasi (positif = pemain menang, negatif = pemain kena mate) */
  mate: number | null;
  /** Principal Variation dalam format UCI, contoh: ['e2e4', 'e7e5'] */
  pv: string[];
}

export interface RawPositionEval {
  fen: string;
  depth: number;
  /** Evaluasi langsung dari sudut pandang giliran jalan pada FEN tersebut */
  lines: EngineLine[];
}

export interface ClassifyMoveParams {
  fenBefore: string;
  fenAfter: string;
  playedUci: string;             // contoh: "e2e4" atau "e7e8q"
  evalBefore: EngineLine;        // MultiPV 1 pada fenBefore (perspektif pemain)
  evalSecondBest?: EngineLine;   // MultiPV 2 pada fenBefore (perspektif pemain)
  evalAfter: EngineLine;         // MultiPV 1 pada fenAfter (SUDAH dibalik ke perspektif pemain)
  legalMovesCount: number;
  isBookMove?: boolean;
  previousOpponentMoveClass?: MoveClassification;
  previousOpponentWinLoss?: number;
  previousOpponentMoveTo?: string;
}

export interface AnalyzedMoveResult {
  ply: number;
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  classification: MoveClassification;
  isSacrifice: boolean;
  winProbBefore: number;
  winProbAfter: number;
  winProbLost: number;
  accuracy: number;
  bestMoveUci: string;
  /** Panah saran langkah terbaik (null jika langkah pemain sudah Best / Great / Brilliant / Book) */
  feedbackArrow: { from: Square; to: Square } | null;
  evalBefore: EngineLine;
  evalAfter: EngineLine;
}

// ============================================================================
// 2. CONSTANTS & PIECE VALUES
// ============================================================================

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 20000,
};

export const SIGMOID_MULTIPLIER = 0.00368208; // Konstanta empiris model Lichess / Chess.com

// ============================================================================
// 3. MATHEMATICAL FUNCTIONS (WIN PROBABILITY & ACCURACY)
// ============================================================================

/**
 * Mengonversi skor skakmat (mate in N moves) ke ekuivalen centipawn
 * Sesuai implementasi resmi CEE Chess.com (TEP::to_score):
 * cp = sign(mate) * (1000 - min(50, |mate|) * 10)
 *
 * Contoh:
 * Mate in 1 = +990 cp (Win probability ~ 97.45%)
 * Mate in 3 = +970 cp (Win probability ~ 97.26%)
 * Mate in 10 = +900 cp (Win probability ~ 96.49%)
 */
export function mateToCentipawns(mate: number): number {
  if (mate === 0) return 1000;
  const absMate = Math.min(50, Math.abs(mate));
  const score = 1000 - absMate * 10;
  return mate > 0 ? score : -score;
}

/**
 * Mengonversi nilai Centipawn / Mate (dari perspektif pemain) ke Win Probability [0.0 - 1.0]
 * Menggunakan model Sigmoid resmi Chess.com / Lichess dengan normalisasi TEP::to_score untuk mate.
 */
export function getWinProbability(
  cp: number | null | undefined,
  mate: number | null | undefined
): number {
  let effectiveCp: number;

  if (mate !== null && mate !== undefined) {
    effectiveCp = mateToCentipawns(mate);
  } else if (cp !== null && cp !== undefined) {
    effectiveCp = Math.max(-1000, Math.min(1000, cp));
  } else {
    return 0.5;
  }

  return 1 / (1 + Math.exp(-SIGMOID_MULTIPLIER * effectiveCp));
}

/**
 * Menghitung akurasi satu langkah (0 - 100%) berdasarkan kehilangan peluang menang (0.0 - 1.0)
 * Model empiris kurva eksponensial Chess.com CAPS
 */
export function calculateMoveAccuracy(winProbLost: number, isBookOrForced = false): number {
  if (isBookOrForced) return 100;
  const winLossPercent = Math.max(0, winProbLost * 100);
  const rawAccuracy = 103.1668 * Math.exp(-0.04354 * winLossPercent) - 3.1669;
  return Number(Math.max(0, Math.min(100, rawAccuracy)).toFixed(1));
}

/**
 * Menghitung total akurasi pemain dalam 1 pertandingan menggunakan kombinasi
 * Volatility-Weighted Mean dan Harmonic Mean.
 */
export function calculateGameAccuracy(
  moves: { winProbBefore: number; accuracy: number; classification: MoveClassification | string }[]
): number {
  const validMoves = moves.filter(
    (m) => m.classification !== 'Book' && m.classification !== 'book'
  );
  if (validMoves.length === 0) return 100;

  // 1. Volatility-Weighted Mean
  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of validMoves) {
    // Posisi yang seimbang (winProb ~ 0.5) memiliki bobot volatilitas lebih tinggi dibanding posisi yang sudah +10
    const certaintyDistance = Math.abs(0.5 - m.winProbBefore);
    const weight = Math.max(0.5, 1.0 - certaintyDistance);
    weightedSum += m.accuracy * weight;
    totalWeight += weight;
  }
  const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : 100;

  // 2. Harmonic Mean (mencegah pembagian dengan nol)
  const harmonicDenominator = validMoves.reduce((acc, m) => {
    const safeAcc = Math.max(1, m.accuracy);
    return acc + 1 / safeAcc;
  }, 0);
  const harmonicMean = validMoves.length / harmonicDenominator;

  return Number(((weightedMean + harmonicMean) / 2).toFixed(1));
}

// ============================================================================
// 4. SACRIFICE DETECTOR & STATIC EXCHANGE EVALUATION (SEE)
// ============================================================================

/**
 * Mengecek apakah suatu petak dilindungi oleh warna tertentu pada posisi saat ini.
 */
export function isSquareDefended(chess: Chess, square: Square, defenderColor: Color): boolean {
  // chess.js v1.0.0-beta.6+ memiliki method isAttacked(square, attackedByColor)
  if (typeof (chess as unknown as { isAttacked?: (sq: Square, color: Color) => boolean }).isAttacked === 'function') {
    return (chess as unknown as { isAttacked: (sq: Square, color: Color) => boolean }).isAttacked(
      square,
      defenderColor
    );
  }

  // Fallback kompatibilitas untuk versi chess.js lama: ubah giliran di FEN ke defenderColor dan cek legal moves
  const tokens = chess.fen().split(' ');
  tokens[1] = defenderColor;
  tokens[3] = '-'; // Hapus en-passant agar FEN selalu valid saat ganti giliran
  try {
    const tempChess = new Chess(tokens.join(' '));
    const defenderMoves = tempChess.moves({ verbose: true });
    return defenderMoves.some((m) => m.to === square);
  } catch {
    return false;
  }
}

/**
 * Menghitung Static Exchange Evaluation (SEE) sederhana pada petak tertentu
 * untuk mengetahui berapa materi yang bisa dimenangkan pihak yang sedang giliran jalan.
 */
function getSeeCaptureGain(chess: Chess, targetSquare: Square, depth = 0): number {
  if (depth > 10) return 0;
  const captures = chess.moves({ verbose: true }).filter((m) => m.to === targetSquare);
  if (captures.length === 0) return 0;

  captures.sort((a, b) => PIECE_VALUES[a.piece] - PIECE_VALUES[b.piece]);
  const lva = captures[0];
  const capturedVal = lva.captured ? PIECE_VALUES[lva.captured] : 0;

  chess.move(lva);
  const counterGain = getSeeCaptureGain(chess, targetSquare, depth + 1);
  chess.undo();

  return Math.max(0, capturedVal - counterGain);
}

/**
 * Menghitung apakah sebuah langkah secara langsung menaruh perwira (N/B/R/Q) ke petak yang
 * dapat dimakan gratis oleh lawan (atau ditukar dengan bidak yang jauh lebih murah),
 * atau meninggalkan perwira tanpa pengawalan.
 * Mengembalikan jumlah materi bersih yang hilang dalam centipawn (misal 900 untuk Menteri gratis).
 */
export function getDirectMaterialBlunderLoss(fenBefore: string, playedUci: string): number {
  let chess: Chess;
  try {
    chess = new Chess(fenBefore);
  } catch {
    return 0;
  }

  const from = playedUci.slice(0, 2) as Square;
  const to = playedUci.slice(2, 4) as Square;
  const promotion = (playedUci.length > 4 ? playedUci[4] : undefined) as PieceSymbol | undefined;

  const movingPiece = chess.get(from);
  if (!movingPiece) return 0;

  const targetPiece = chess.get(to);
  const capturedVal = targetPiece ? PIECE_VALUES[targetPiece.type] : 0;

  let moveObj: Move;
  try {
    moveObj = chess.move({ from, to, promotion });
  } catch {
    return 0;
  }
  if (!moveObj) return 0;

  // Hanya periksa kehilangan materi jika langkah tersebut BUKAN pengorbanan yang menang/paksa skakmat
  const opponentGainOnDestination = getSeeCaptureGain(chess, to);
  const netDirectLoss = opponentGainOnDestination - capturedVal;

  if (netDirectLoss >= 200) {
    return netDirectLoss;
  }

  return 0;
}

/**
 * Memeriksa apakah langkah perwira (misal Kuda/Pion) menghasilkan garpuan taktis (tactical fork)
 * ke setidaknya 2 perwira besar lawan (Menteri/Benteng) atau Raja lawan.
 */
export function isMajorPieceFork(fenBefore: string, playedUci: string): boolean {
  if (!fenBefore || !playedUci || playedUci.length < 4) return false;
  try {
    const board = new Chess(fenBefore);
    const from = playedUci.slice(0, 2) as Square;
    const to = playedUci.slice(2, 4) as Square;
    const movingPiece = board.get(from);
    if (!movingPiece || movingPiece.type === 'k') return false;

    const moverColor = board.turn();
    const enemyColor: Color = moverColor === 'w' ? 'b' : 'w';

    const moveRes = board.move({ from, to, promotion: (playedUci[4] as any) || 'q' });
    if (!moveRes) return false;

    const file = to.charCodeAt(0) - 97;
    const rank = parseInt(to[1], 10) - 1;

    let attackedValuableCount = 0;
    const b = board.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || p.color !== enemyColor) continue;
        if (p.type === 'q' || p.type === 'r' || p.type === 'k') {
          const targetSq = (String.fromCharCode(97 + c) + (8 - r)) as Square;
          const df = Math.abs((targetSq.charCodeAt(0) - 97) - file);
          const dr = Math.abs((parseInt(targetSq[1], 10) - 1) - rank);

          if (movingPiece.type === 'n') {
            if ((df === 1 && dr === 2) || (df === 2 && dr === 1)) {
              attackedValuableCount++;
            }
          } else if (movingPiece.type === 'p') {
            const pawnDr = moverColor === 'w' ? 1 : -1;
            if ((parseInt(targetSq[1], 10) - 1) - rank === pawnDr && df === 1) {
              attackedValuableCount++;
            }
          }
        }
      }
    }

    return attackedValuableCount >= 2;
  } catch {
    return false;
  }
}

/**
 * Mendeteksi apakah langkah yang baru dimainkan merupakan pengorbanan materi (Sacrifice).
 * Menggunakan analisis serangan balasan pada posisi setelah langkah dimainkan.
 */
export function detectPieceSacrifice(fenBefore: string, playedUci: string): boolean {
  let chess: Chess;
  try {
    chess = new Chess(fenBefore);
  } catch {
    return false;
  }

  const from = playedUci.slice(0, 2) as Square;
  const to = playedUci.slice(2, 4) as Square;
  const promotion = (playedUci.length > 4 ? playedUci[4] : undefined) as PieceSymbol | undefined;

  const movingPiece = chess.get(from);
  if (!movingPiece) return false;

  // Raja tidak bisa dikorbankan: langkah raja (termasuk rokade dan keluar dari skak) BUKAN pengorbanan,
  // walaupun ada perwira lain yang sudah tergantung sebelum langkah itu.
  if (movingPiece.type === 'k') return false;

  const moverColor = movingPiece.color;
  const targetPiece = chess.get(to);
  const capturedValue = targetPiece ? PIECE_VALUES[targetPiece.type] : 0;

  // Eksekusi langkah di papan simulasi
  let moveObj: Move;
  try {
    moveObj = chess.move({ from, to, promotion });
  } catch {
    return false;
  }
  if (!moveObj) return false;

  const movedPieceType = promotion || movingPiece.type;
  const movedValue = PIECE_VALUES[movedPieceType];

  // Cari seluruh langkah tangkapan (captures) legal yang dimiliki lawan setelah langkah kita
  const opponentMoves = chess.moves({ verbose: true });

  // SKENARIO A: Direct Sacrifice (Perwira yang baru kita gerakkan ke petak `to` bisa dimakan lawan dengan untung materi)
  if (movedValue >= PIECE_VALUES.n) {
    const recapturesOnTarget = opponentMoves.filter((m) => m.to === to);

    if (recapturesOnTarget.length > 0) {
      // Cari penyerang lawan dengan nilai paling murah (Lowest Valuable Attacker)
      const cheapestAttackerValue = Math.min(
        ...recapturesOnTarget.map((m) => PIECE_VALUES[m.piece])
      );

      // Apakah petak `to` dilindungi oleh bidak kita sendiri?
      const isSquareDefendedByUs = isSquareDefended(chess, to, moverColor);

      // Kasus 1: Perwira ditaruh tanpa pelindung dan nilai yang kita makan lebih kecil dari perwira kita
      if (!isSquareDefendedByUs && movedValue - capturedValue >= 200) {
        return true;
      }

      // Kasus 2: Meskipun dilindungi, penangkap lawan jauh lebih murah daripada selisih pertukaran
      // Contoh: Kita makan Pion (100) pakai Kuda (300) -> selisih 200, lalu lawan makan Kuda kita pakai Pion (100)
      if (
        isSquareDefendedByUs &&
        movedValue - capturedValue >= 200 &&
        cheapestAttackerValue < movedValue - capturedValue
      ) {
        return true;
      }
    }
  }

  // SKENARIO B: Indirect / Hanging Piece Sacrifice
  // Kita melangkahkan bidak A, tapi dengan sengaja membiarkan perwira bernilai tinggi (N/B/R/Q) di petak lain
  // dapat dimakan cuma-cuma oleh lawan (atau dimakan oleh bidak lawan yang jauh lebih murah).
  if (capturedValue < PIECE_VALUES.n) {
    for (const oppMove of opponentMoves) {
      if (!oppMove.captured || oppMove.to === to) continue;

      const hangingPieceValue = PIECE_VALUES[oppMove.captured];
      if (hangingPieceValue < PIECE_VALUES.n) continue; // Abaikan jika yang ditinggal hanya pion

      // Pakai SEE (static exchange) sungguhan, bukan sekadar "apakah petak dilindungi secara statis".
      // Pengecekan statis salah mengira perwira tergantung padahal pelindungnya baru terbuka (x-ray)
      // setelah penyerang memakan. Contoh: benteng lawan di e2 memakan Gajah di f2, lalu Benteng kita di c2
      // memakan balik di f2 (Rxf2 Rxf2) -> kita justru untung, ini BUKAN pengorbanan.
      chess.move(oppMove);
      const recaptureGain = getSeeCaptureGain(chess, oppMove.to);
      chess.undo();

      const netLoss = hangingPieceValue - recaptureGain;
      if (netLoss >= 200) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Menentukan apakah panah saran langkah terbaik (Best Move Arrow) harus ditampilkan di papan.
 * Panah HANYA muncul jika langkah pemain BUKAN Best / Great / Brilliant / Book.
 */
export function shouldShowBestMoveArrow(
  classification: MoveClassification | string,
  playedUci?: string,
  bestMoveUci?: string
): boolean {
  const c = classification.toLowerCase();
  if (c === 'best' || c === 'great' || c === 'brilliant' || c === 'book') {
    return false;
  }
  if (!bestMoveUci || bestMoveUci.length < 4) {
    return false;
  }
  if (playedUci && playedUci.slice(0, 4) === bestMoveUci.slice(0, 4)) {
    return false;
  }
  return true;
}

// ============================================================================
// 5. CORE MOVE CLASSIFIER
// ============================================================================

export function classifyChessMove(params: ClassifyMoveParams): {
  classification: MoveClassification;
  isSacrifice: boolean;
  winProbBefore: number;
  winProbAfter: number;
  winProbLost: number;
  accuracy: number;
} {
  const {
    fenBefore,
    playedUci,
    evalBefore,
    evalSecondBest,
    evalAfter,
    legalMovesCount,
    isBookMove = false,
    previousOpponentMoveClass,
    previousOpponentWinLoss = 0,
    previousOpponentMoveTo,
  } = params;

  const bestMoveUci = evalBefore.pv[0] || '';
  const winProbBefore = getWinProbability(evalBefore.cp, evalBefore.mate);
  const winProbAfter = getWinProbability(evalAfter.cp, evalAfter.mate);
  const winProbLost = Math.max(0, winProbBefore - winProbAfter);
  const effCpBefore =
    evalBefore.mate !== null && evalBefore.mate !== undefined
      ? mateToCentipawns(evalBefore.mate)
      : (evalBefore.cp ?? 0);
  const effCpAfter =
    evalAfter.mate !== null && evalAfter.mate !== undefined
      ? mateToCentipawns(evalAfter.mate)
      : (evalAfter.cp ?? 0);
  const hasMateScore =
    (evalBefore.mate !== null && evalBefore.mate !== undefined) ||
    (evalAfter.mate !== null && evalAfter.mate !== undefined);
  const inFlatTail = winProbBefore < 0.03 || winProbBefore > 0.97;
  const cpLoss = hasMateScore || inFlatTail ? 0 : Math.max(0, effCpBefore - effCpAfter);

  const isSacrifice = detectPieceSacrifice(fenBefore, playedUci);
  const directMaterialBlunderLoss = getDirectMaterialBlunderLoss(fenBefore, playedUci);

  // 1. FORCED MOVE (Hanya ada 1 langkah legal -> Best Move)
  if (legalMovesCount === 1) {
    return {
      classification: 'Best',
      isSacrifice: false,
      winProbBefore,
      winProbAfter,
      winProbLost: 0,
      accuracy: 100,
    };
  }

  // 2. BOOK MOVE (Pembukaan standar)
  if (isBookMove) {
    return {
      classification: 'Book',
      isSacrifice: false,
      winProbBefore,
      winProbAfter,
      winProbLost,
      accuracy: 100,
    };
  }

  // Fallback jika engine bestMoveUci belum terisi, namun tidak ada kehilangan winProb atau mengarah ke skakmat paksa
  const isEngineTopMove = (!!bestMoveUci && playedUci === bestMoveUci) || (!bestMoveUci && winProbLost <= 0.005);

  const hasForcedMateAfter = evalAfter.mate !== null && evalAfter.mate !== undefined && evalAfter.mate > 0;
  const hadForcedMateBefore = evalBefore.mate !== null && evalBefore.mate !== undefined && evalBefore.mate > 0;
  const secondBestHasForcedMate =
    evalSecondBest?.mate !== null && evalSecondBest?.mate !== undefined && evalSecondBest.mate > 0;

  const winProbSecondBest = evalSecondBest
    ? getWinProbability(evalSecondBest.cp, evalSecondBest.mate)
    : winProbBefore;
  const uniquenessGap = evalSecondBest ? Math.max(0, winProbBefore - winProbSecondBest) : 0;

  // Cek eksploitasi pin mutlak (misal Qd7-h3! di mana pion g2 ter-pin oleh Rg8)
  const isPinExploit = isTacticalPinExploit(fenBefore, playedUci);

  // JANGAN masuk ke kategori Best/Excellent otomatis jika pemain menaruh perwira gratis di posisi kalah (misal Qe4?? di depan Nxe4)
  const isUnsoundPieceHangInLostPos =
    !isEngineTopMove && directMaterialBlunderLoss >= 300 && winProbAfter < 0.25 && cpLoss >= 250;

  // 3. BRILLIANT, GREAT, & BEST MOVES
  if (
    !isUnsoundPieceHangInLostPos &&
    (isEngineTopMove ||
      winProbLost <= 0.015 ||
      hasForcedMateAfter ||
      (isSacrifice && cpLoss <= 120 && winProbLost <= 0.06) ||
      (isPinExploit && winProbAfter >= 0.85 && winProbLost <= 0.05))
  ) {
    // Syarat Brilliant (!!):
    // - Langkah terbaik / hampir terbaik (atau menghasilkan skakmat paksa)
    // - Mengorbankan materi (isSacrifice)
    // - Posisi setelah melangkah tidak kalah (winProbAfter >= 0.40)
    // - Filter anti-showoff: Bukan pengorbanan sia-sia di posisi yang sudah menang telak,
    //   KECUALI langkah tersebut mengarah ke skakmat paksa atau serangan mutlak (isDecisiveAttackSacrifice)
    const isSoundSacrifice =
      isEngineTopMove ||
      hasForcedMateAfter ||
      (cpLoss <= 80 && winProbLost <= 0.04) ||
      (winProbAfter >= 0.75 && cpLoss <= 120 && winProbLost <= 0.06);

    const isDecisiveAttackSacrifice =
      isSacrifice &&
      isSoundSacrifice &&
      winProbAfter >= 0.75 &&
      (isEngineTopMove || cpLoss <= 120);

    const isNotTrivialWinningShowoff =
      winProbBefore < 0.92 ||
      hasForcedMateAfter ||
      hadForcedMateBefore ||
      isDecisiveAttackSacrifice;

    if (
      !isUnsoundPieceHangInLostPos &&
      isSoundSacrifice &&
      isSacrifice &&
      isNotTrivialWinningShowoff &&
      winProbAfter >= 0.40
    ) {
      return {
        classification: 'Brilliant',
        isSacrifice: true,
        winProbBefore,
        winProbAfter,
        winProbLost,
        accuracy: 100,
      };
    }

    // Syarat Great Move (!) Standar Chess.com:
    // - Merupakan langkah #1 terbaik engine (atau langkah eksploitasi pin taktis yang tetap menang mutlak)
    // - Bukan langkah paksa (legalMovesCount > 1)
    // - Posisi setelah melangkah tetap terjaga (winProbAfter >= 0.30)
    // - Memakan perwira gratis hasil blunder lawan BUKAN Great Move (hanya Best Move)
    let isCapturedPiece = false;
    try {
      const bTest = new Chess(fenBefore);
      const toSq = playedUci.slice(2, 4) as Square;
      const targetPiece = bTest.get(toSq);
      isCapturedPiece = !!targetPiece && targetPiece.type !== 'p';
    } catch {}
    const opponentBlunderedLast =
      previousOpponentMoveClass === 'Blunder' || (previousOpponentWinLoss ?? 0) >= 0.15;
    const isBlunderPunishCapture =
      isCapturedPiece &&
      opponentBlunderedLast &&
      (!previousOpponentMoveTo || previousOpponentMoveTo === playedUci.slice(2, 4));

    if (legalMovesCount > 1 && winProbAfter >= 0.15) {
      // Skenario A: Eksploitasi Pin Taktis Asli (Pseudo-Sacrifice seperti Qd7-h3! di mana pion g2 ter-pin oleh Rg8)
      if (isPinExploit && !isBlunderPunishCapture && (!evalSecondBest || uniquenessGap >= 0.05 || hasForcedMateAfter || winProbAfter >= 0.85)) {
        return {
          classification: 'Great',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost: 0,
          accuracy: 100,
        };
      }

      if (isEngineTopMove) {
        // Skenario B: Menemukan skakmat paksa dari posisi non-mate (atau satu-satunya jalur mate saat opsi ke-2 bukan mate)
        const foundForcedMate =
          (!hadForcedMateBefore && hasForcedMateAfter) ||
          (hasForcedMateAfter && evalSecondBest !== undefined && !secondBestHasForcedMate && winProbSecondBest < 0.90);
        if (foundForcedMate && (!evalSecondBest || uniquenessGap >= 0.05 || !secondBestHasForcedMate)) {
          return {
            classification: 'Great',
            isSacrifice,
            winProbBefore,
            winProbAfter,
            winProbLost,
            accuracy: 100,
          };
        }

        // Skenario E: Tactical Fork on Major Pieces (Garpuan Kuda/Pion ke Menteri & Benteng)
        const isForkTactic = isMajorPieceFork(fenBefore, playedUci);
        if (
          isForkTactic &&
          !isBlunderPunishCapture &&
          winProbAfter >= 0.70
        ) {
          return {
            classification: 'Great',
            isSacrifice,
            winProbBefore,
            winProbAfter,
            winProbLost,
            accuracy: 100,
          };
        }

        if (!isBlunderPunishCapture && winProbBefore <= 0.90) {
          // Skenario C: "The Only Move"
          const rawCpGap = (evalBefore.cp ?? 0) - (evalSecondBest?.cp ?? evalBefore.cp ?? 0);
          const isDefensiveOnlyMove = winProbBefore <= 0.40 && rawCpGap >= 100 && uniquenessGap >= 0.05;
          if (uniquenessGap >= 0.15 || isDefensiveOnlyMove) {
            return {
              classification: 'Great',
              isSacrifice,
              winProbBefore,
              winProbAfter,
              winProbLost,
              accuracy: 100,
            };
          }

          // Skenario D: Game Changer (Menyelamatkan game kalah / melonjak dari seimbang menjadi menang dengan gap >= 10%)
          const savedLostGame = winProbBefore <= 0.35 && winProbAfter >= 0.50 && uniquenessGap >= 0.10;
          const seizedWin = winProbBefore <= 0.55 && winProbAfter >= 0.72 && uniquenessGap >= 0.10;
          if (savedLostGame || seizedWin) {
            return {
              classification: 'Great',
              isSacrifice,
              winProbBefore,
              winProbAfter,
              winProbLost,
              accuracy: 100,
            };
          }
        }
      }
    }

    // Best Move (★) HANYA diberikan jika pemain benar-benar memainkan pilihan #1 engine
    if (isEngineTopMove) {
      return {
        classification: 'Best',
        isSacrifice,
        winProbBefore,
        winProbAfter,
        winProbLost,
        accuracy: calculateMoveAccuracy(winProbLost),
      };
    }
  }

  // 4. PENANGANAN KHUSUS MENARUH PERWIRA GRATIS DI POSISI KALAH (Sigmoid Flat-Tail Guard)
  // Contoh: Gambar Qe4 (image_6df7a2.png) saat posisi sudah -18.0 (winProbBefore ~ 0.025) lalu menaruh Menteri gratis
  // di e4 yang dijaga Kuda f6 sehingga menjadi -29.7 (winProbAfter ~ 0.024).
  // Meskipun winProbLost ~ 0.001, menaruh Menteri/Benteng/Perwira gratis (directMaterialBlunderLoss >= 300 & cpLoss >= 300)
  // tidak boleh pernah dinilai "Excellent" atau "Good"!
  if (!isEngineTopMove && directMaterialBlunderLoss >= 300 && cpLoss >= 250 && winProbAfter < 0.30) {
    // Jika membuang Menteri gratis (>= 700 cp) atau posisi sebelumnya masih di atas -1000 cp -> Mistake / Inaccuracy
    if (directMaterialBlunderLoss >= 700 && (evalBefore.cp === null || evalBefore.cp > -1500)) {
      return {
        classification: 'Mistake',
        isSacrifice: false,
        winProbBefore,
        winProbAfter,
        winProbLost: Math.max(winProbLost, 0.12),
        accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.12)),
      };
    }
    return {
      classification: 'Inaccuracy',
      isSacrifice: false,
      winProbBefore,
      winProbAfter,
      winProbLost: Math.max(winProbLost, 0.06),
      accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.06)),
    };
  }

  // 5. MATE BLUNDER & MISSED MATE CHECKS
  const hadForcedMate = evalBefore.mate !== null && evalBefore.mate !== undefined && evalBefore.mate > 0;

  if (hadForcedMate && !isEngineTopMove) {
    // Jika membuang forced mate dan posisi berbalik imbang/kalah (winProbAfter < 0.50) -> Blunder
    if (!hasForcedMateAfter && winProbAfter < 0.50) {
      return {
        classification: 'Blunder',
        isSacrifice,
        winProbBefore,
        winProbAfter,
        winProbLost: Math.max(winProbLost, 0.30),
        accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.30)),
      };
    }

    // Jika membuang forced mate menjadi keunggulan tipis/sedang (0.50 <= winProbAfter < 0.85) -> Miss
    if (!hasForcedMateAfter && winProbAfter < 0.85) {
      return {
        classification: 'Miss',
        isSacrifice,
        winProbBefore,
        winProbAfter,
        winProbLost: Math.max(winProbLost, 0.15),
        accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.15)),
      };
    }
  }

  // Melangkah masuk ke skakmat paksa lawan:
  // Hanya dihitung Blunder jika posisi sebelumnya belum kalah telak (winProbBefore >= 0.30)
  const steppedIntoForcedMate =
    !hadForcedMate &&
    (evalBefore.mate === null || evalBefore.mate === undefined || evalBefore.mate >= 0) &&
    evalAfter.mate !== null &&
    evalAfter.mate < 0 &&
    winProbBefore >= 0.30;

  if (steppedIntoForcedMate) {
    return {
      classification: 'Blunder',
      isSacrifice,
      winProbBefore,
      winProbAfter,
      winProbLost: Math.max(winProbLost, 0.25),
      accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.25)),
    };
  }

  // 6. MISS (❌) - Gagal menghukum kesalahan/blunder lawan pada langkah sebelumnya
  const opponentBlunderedLastTurn =
    previousOpponentMoveClass === 'Blunder' ||
    previousOpponentMoveClass === 'Mistake' ||
    previousOpponentWinLoss >= 0.15;

  if (opponentBlunderedLastTurn && winProbLost >= 0.15 && winProbAfter >= 0.35 && winProbBefore <= 0.90) {
    return {
      classification: 'Miss',
      isSacrifice,
      winProbBefore,
      winProbAfter,
      winProbLost,
      accuracy: calculateMoveAccuracy(winProbLost),
    };
  }

  // 7. STANDARD WIN-PROBABILITY THRESHOLDS
  let classification: MoveClassification;

  if (winProbLost >= 0.20) {
    classification = 'Blunder';
  } else if (winProbLost >= 0.10) {
    classification = 'Mistake';
  } else if (winProbLost >= 0.05) {
    classification = 'Inaccuracy';
  } else if (winProbLost <= 0.02 && cpLoss < 150) {
    classification = 'Excellent';
  } else if (cpLoss < 300) {
    classification = 'Good';
  } else {
    // Jika di posisi yang sudah kalah/menang mutlak tetapi langkah ini kehilangan >= 300 cp (tanpa mengubah winProb),
    // turunkan maksimal ke Inaccuracy (bukan Excellent/Good, dan bukan Blunder agar total Blunder tetap akurat).
    classification = 'Inaccuracy';
  }

  return {
    classification,
    isSacrifice,
    winProbBefore,
    winProbAfter,
    winProbLost,
    accuracy: calculateMoveAccuracy(winProbLost),
  };
}

// ============================================================================
// 6. FULL GAME PGN ANALYZER PIPELINE & UCI PARSER
// ============================================================================

export interface IStockfishEvaluator {
  evaluatePosition(fen: string, depth: number, multiPv: number): Promise<RawPositionEval>;
}

/**
 * Menganalisis satu partai penuh dari PGN secara akurat menggunakan Backward Analysis Queue.
 */
export async function analyzeFullGamePgn(
  pgn: string,
  engine: IStockfishEvaluator,
  options: {
    depth?: number;
    openingBookFens?: Set<string>;
    onProgress?: (completedPly: number, totalPlies: number) => void;
  } = {}
): Promise<{
  moves: AnalyzedMoveResult[];
  whiteAccuracy: number;
  blackAccuracy: number;
}> {
  const depth = options.depth ?? 18;
  const bookFens = options.openingBookFens ?? new Set<string>();

  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });

  // Siapkan daftar langkah beserta FEN sebelum & sesudah
  const replay = new Chess();
  const stepData = history.map((move, index) => {
    const fenBefore = replay.fen();
    const legalMovesCount = replay.moves().length;
    replay.move(move);
    const fenAfter = replay.fen();

    return {
      ply: index + 1,
      color: move.color,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ''}`,
      fenBefore,
      fenAfter,
      legalMovesCount,
    };
  });

  // Kumpulkan semua FEN unik dan jalankan evaluasi dari AKHIR ke AWAL (Backward Analysis)
  const evalCache = new Map<string, RawPositionEval>();
  const allFensOrderedBackward: string[] = [];

  if (stepData.length > 0) {
    allFensOrderedBackward.push(stepData[stepData.length - 1].fenAfter);
    for (let i = stepData.length - 1; i >= 0; i--) {
      allFensOrderedBackward.push(stepData[i].fenBefore);
    }
  }

  let completed = 0;
  for (const fen of allFensOrderedBackward) {
    if (!evalCache.has(fen)) {
      const result = await engine.evaluatePosition(fen, depth, 2);
      evalCache.set(fen, result);
    }
    completed++;
    options.onProgress?.(completed, allFensOrderedBackward.length);
  }

  // Klasifikasikan setiap langkah secara berurutan dari langkah 1 hingga selesai
  const analyzedMoves: AnalyzedMoveResult[] = [];
  let prevMoveClass: MoveClassification | undefined;
  let prevWinLoss = 0;

  for (const step of stepData) {
    const rawBefore = evalCache.get(step.fenBefore)!;
    const rawAfter = evalCache.get(step.fenAfter)!;

    const evalBefore: EngineLine = rawBefore?.lines[0] ?? {
      multipv: 1,
      cp: 0,
      mate: null,
      pv: [],
    };
    const evalSecondBest: EngineLine | undefined = rawBefore?.lines[1];

    // PENTING: Evaluasi fenAfter dari Stockfish berada di sudut pandang LAWAN.
    // Kita wajib membalik tanda cp dan mate agar berada di sudut pandang pemain yang baru melangkah!
    const rawAfterBest = rawAfter?.lines[0] ?? { multipv: 1, cp: 0, mate: null, pv: [] };
    const evalAfterNormalized: EngineLine = {
      multipv: 1,
      cp: rawAfterBest.cp !== null ? -rawAfterBest.cp : null,
      mate: rawAfterBest.mate !== null ? -rawAfterBest.mate : null,
      pv: rawAfterBest.pv,
    };

    // Cek apakah FEN setelah langkah masih ada di Opening Book (maksimal langkah ke-12 / ply 24)
    const normalizedFenKey = step.fenAfter.split(' ').slice(0, 4).join(' ');
    const isBookMove = step.ply <= 24 && bookFens.has(normalizedFenKey);

    const result = classifyChessMove({
      fenBefore: step.fenBefore,
      fenAfter: step.fenAfter,
      playedUci: step.uci,
      evalBefore,
      evalSecondBest,
      evalAfter: evalAfterNormalized,
      legalMovesCount: step.legalMovesCount,
      isBookMove,
      previousOpponentMoveClass: prevMoveClass,
      previousOpponentWinLoss: prevWinLoss,
    });

    const rawBestUci = evalBefore.pv[0] || '';
    const showArrow = shouldShowBestMoveArrow(result.classification, step.uci, rawBestUci);

    const analyzedMove: AnalyzedMoveResult = {
      ply: step.ply,
      color: step.color,
      san: step.san,
      uci: step.uci,
      fenBefore: step.fenBefore,
      fenAfter: step.fenAfter,
      classification: result.classification,
      isSacrifice: result.isSacrifice,
      winProbBefore: result.winProbBefore,
      winProbAfter: result.winProbAfter,
      winProbLost: result.winProbLost,
      accuracy: result.accuracy,
      bestMoveUci: showArrow ? rawBestUci : '',
      feedbackArrow: showArrow
        ? {
          from: rawBestUci.slice(0, 2) as Square,
          to: rawBestUci.slice(2, 4) as Square,
        }
        : null,
      evalBefore,
      evalAfter: evalAfterNormalized,
    };

    analyzedMoves.push(analyzedMove);
    prevMoveClass = result.classification;
    prevWinLoss = result.winProbLost;
  }

  const whiteMoves = analyzedMoves.filter((m) => m.color === 'w');
  const blackMoves = analyzedMoves.filter((m) => m.color === 'b');

  return {
    moves: analyzedMoves,
    whiteAccuracy: calculateGameAccuracy(whiteMoves),
    blackAccuracy: calculateGameAccuracy(blackMoves),
  };
}

// ============================================================================
// 7. UCI OUTPUT PARSER HELPER (Untuk mem-parsing output string dari Stockfish)
// ============================================================================

/**
 * Mem-parsing satu baris output UCI `info depth ... multipv ... score ... pv ...`
 * dari Stockfish.wasm menjadi objek EngineLine.
 */
export function parseUciInfoLine(line: string): { depth: number; engineLine: EngineLine } | null {
  if (!line.startsWith('info') || !line.includes(' score ') || !line.includes(' pv ')) {
    return null;
  }

  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);

  if (!depthMatch || !pvMatch) return null;

  const depth = parseInt(depthMatch[1], 10);
  const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
  const cp = cpMatch ? parseInt(cpMatch[1], 10) : null;
  const mate = mateMatch ? parseInt(mateMatch[1], 10) : null;
  const pv = pvMatch[1].trim().split(/\s+/);

  return {
    depth,
    engineLine: {
      multipv,
      cp,
      mate,
      pv,
    },
  };
}