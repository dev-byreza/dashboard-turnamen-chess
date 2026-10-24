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
 * - Chess Analysis & Classification Engine.ts
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
 * Mengonversi nilai Centipawn / Mate (dari perspektif pemain) ke Win Probability [0.0 - 1.0]
 */
export function getWinProbability(cp: number | null, mate: number | null): number {
  if (mate !== null && mate !== undefined) {
    if (mate > 0) {
      // Mate untuk kemenangan pemain: semakin kecil langkah mate, semakin dekat ke 1.0
      return Math.max(0.99, 1.0 - Math.min(mate, 10) * 0.001);
    } else if (mate < 0) {
      // Pemain terkena skakmat lawan
      return Math.min(0.01, Math.min(Math.abs(mate), 10) * 0.001);
    }
    return 1.0;
  }

  if (cp === null || cp === undefined) return 0.5;

  const clampedCp = Math.max(-1000, Math.min(1000, cp));
  return 1 / (1 + Math.exp(-SIGMOID_MULTIPLIER * clampedCp));
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

      const attackerValue = PIECE_VALUES[oppMove.piece];
      const isDefended = isSquareDefended(chess, oppMove.to, moverColor);

      // Jika perwira kita tidak terlindungi, atau diserang oleh bidak yang nilainya lebih rendah minimal 200 poin
      if (!isDefended || attackerValue <= hangingPieceValue - 200) {
        return true;
      }
    }
  }

  return false;
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
  } = params;

  const bestMoveUci = evalBefore.pv[0] || '';
  const winProbBefore = getWinProbability(evalBefore.cp, evalBefore.mate);
  const winProbAfter = getWinProbability(evalAfter.cp, evalAfter.mate);
  const winProbLost = Math.max(0, winProbBefore - winProbAfter);
  const cpLoss =
    evalBefore.cp !== null && evalBefore.cp !== undefined && evalAfter.cp !== null && evalAfter.cp !== undefined
      ? Math.max(0, evalBefore.cp - evalAfter.cp)
      : 0;

  const isSacrifice = detectPieceSacrifice(fenBefore, playedUci);

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

  const isEngineTopMove = !!bestMoveUci && playedUci === bestMoveUci;

  // 3. BRILLIANT, GREAT, & BEST MOVES
  if (isEngineTopMove || winProbLost <= 0.015) {
    // Syarat Brilliant (!!):
    // - Langkah terbaik / hampir terbaik
    // - Mengorbankan materi (isSacrifice)
    // - Posisi sebelum melangkah belum menang telak (winProbBefore < 0.88)
    // - Posisi setelah melangkah tidak kalah (winProbAfter >= 0.40)
    if (isSacrifice && winProbBefore < 0.88 && winProbAfter >= 0.40) {
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
    // - WAJIB merupakan langkah #1 terbaik engine (isEngineTopMove === true)
    // - Bukan langkah paksa (legalMovesCount > 1)
    // - Posisi belum menang mutlak (winProbBefore <= 0.92)
    // - Posisi setelah melangkah tetap terjaga (winProbAfter >= 0.30)
    if (isEngineTopMove && legalMovesCount > 1 && winProbBefore <= 0.92 && winProbAfter >= 0.30) {
      let uniquenessGap = 0;
      if (evalSecondBest) {
        const winProbSecondBest = getWinProbability(evalSecondBest.cp, evalSecondBest.mate);
        uniquenessGap = winProbBefore - winProbSecondBest;
      }

      // Skenario A: "The Only Move" (Langkah #1 mutlak unggul >= 15% dibanding pilihan #2)
      if (uniquenessGap >= 0.15) {
        return {
          classification: 'Great',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost,
          accuracy: 100,
        };
      }

      // Skenario B: Eksploitasi Pin Taktis Asli (Pseudo-Sacrifice) yang terverifikasi ray-casting + gap >= 10%
      if (uniquenessGap >= 0.10 && isTacticalPinExploit(fenBefore, playedUci)) {
        return {
          classification: 'Great',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost,
          accuracy: 100,
        };
      }

      // Skenario C: Menemukan skakmat paksa dari posisi non-mate + gap >= 10%
      const foundForcedMate =
        (evalBefore.mate === null || evalBefore.mate <= 0) &&
        evalAfter.mate !== null &&
        evalAfter.mate > 0;
      if (foundForcedMate && uniquenessGap >= 0.10) {
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

  // 4. MATE BLUNDER & MISSED MATE CHECKS
  const hadForcedMate = evalBefore.mate !== null && evalBefore.mate !== undefined && evalBefore.mate > 0;
  const hasForcedMateAfter = evalAfter.mate !== null && evalAfter.mate !== undefined && evalAfter.mate > 0;

  if (hadForcedMate && !isEngineTopMove) {
    // Skenario 1: Memiliki Mate in 1, tapi memainkan langkah lain yang bukan mate in 1
    if (evalBefore.mate === 1 && (!evalAfter.mate || evalAfter.mate > 1)) {
      if (winProbAfter >= 0.50) {
        return {
          classification: 'Miss',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost: Math.max(winProbLost, 0.20),
          accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.20)),
        };
      } else {
        return {
          classification: 'Blunder',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost: Math.max(winProbLost, 0.35),
          accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.35)),
        };
      }
    }

    // Skenario 2: Memiliki forced mate (Mate in N), namun membuang forced mate tersebut
    if (!hasForcedMateAfter) {
      if (winProbAfter >= 0.50) {
        return {
          classification: 'Miss',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost: Math.max(winProbLost, 0.20),
          accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.20)),
        };
      } else {
        return {
          classification: 'Blunder',
          isSacrifice,
          winProbBefore,
          winProbAfter,
          winProbLost: Math.max(winProbLost, 0.35),
          accuracy: calculateMoveAccuracy(Math.max(winProbLost, 0.35)),
        };
      }
    }
  }

  const steppedIntoForcedMate =
    !hadForcedMate &&
    evalAfter.mate !== null &&
    evalAfter.mate < 0 &&
    winProbBefore >= 0.20;

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

  // 5. MISS (❌) - Gagal menghukum kesalahan/blunder lawan pada langkah sebelumnya
  const opponentBlunderedLastTurn =
    previousOpponentMoveClass === 'Blunder' ||
    previousOpponentMoveClass === 'Mistake' ||
    previousOpponentWinLoss >= 0.12;

  if (opponentBlunderedLastTurn && winProbLost > 0.12 && winProbAfter >= 0.35) {
    return {
      classification: 'Miss',
      isSacrifice,
      winProbBefore,
      winProbAfter,
      winProbLost,
      accuracy: calculateMoveAccuracy(winProbLost),
    };
  }

  // 6. STANDARD WIN-LOSS THRESHOLDS (Sesuai Chess Analysis Architecture.md)
  // Menangani Sigmoid Flat-Tail Anomaly: Jika posisi sudah kalah/menang jauh, kehilangan materi perwira/pion
  // tetap harus dideteksi sebagai Blunder / Mistake / Inaccuracy berdasarkan centipawn loss (cpLoss).
  let classification: MoveClassification;
  let effectiveWinLoss = winProbLost;

  if (winProbLost >= 0.20 || cpLoss >= 300) {
    classification = 'Blunder';
    effectiveWinLoss = Math.max(winProbLost, 0.25);
  } else if (winProbLost >= 0.105 || cpLoss >= 180) {
    classification = 'Mistake';
    effectiveWinLoss = Math.max(winProbLost, 0.15);
  } else if (winProbLost >= 0.055 || cpLoss >= 90) {
    classification = 'Inaccuracy';
    effectiveWinLoss = Math.max(winProbLost, 0.08);
  } else if (winProbLost <= 0.025 && cpLoss < 40) {
    classification = 'Excellent';
  } else if (winProbLost <= 0.055 && cpLoss < 80) {
    classification = 'Good';
  } else {
    classification = 'Inaccuracy';
    effectiveWinLoss = Math.max(winProbLost, 0.08);
  }

  return {
    classification,
    isSacrifice,
    winProbBefore,
    winProbAfter,
    winProbLost: effectiveWinLoss,
    accuracy: calculateMoveAccuracy(effectiveWinLoss),
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
      bestMoveUci: evalBefore.pv[0] || step.uci,
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
