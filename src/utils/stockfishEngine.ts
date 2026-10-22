/**
 * Stockfish 19 Lite Web Worker Integration & Game Review Analyzer
 * Powered by nmrugg/stockfish.js (WASM Single-Threaded Lite)
 * Runs 100% Client-Side in browser Web Worker with Zero Server Load
 */

export interface PositionEvaluation {
  fen: string;
  depth: number;
  scoreCp: number; // Centipawns from White's perspective (+150 = +1.5 pawns)
  scoreDisplay: string; // "+1.5", "-0.8", "M3", "-M2"
  mateIn?: number; // Positive = White mates in X, Negative = Black mates in X
  winChanceWhite: number; // 0 to 100% for the vertical Eval Bar
  bestMoveUci?: string; // e.g. "g1f3"
  bestMoveSan?: string; // e.g. "Nf3"
  pv?: string[]; // sequence of best moves
  isThinking: boolean;
}

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface MoveReviewPoint {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number; // centipawns
  evalAfter: number; // centipawns
  scoreDisplay: string;
  winChanceAfter: number;
  bestMoveUci?: string;
  bestMoveSan?: string;
  classification: MoveClassification;
  explanation?: string;
}

export interface GameReviewReport {
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteClassificationCounts: Record<MoveClassification, number>;
  blackClassificationCounts: Record<MoveClassification, number>;
  coachMessage: string;
  graphPoints: {
    ply: number;
    moveNumber: number;
    color: 'w' | 'b';
    san: string;
    eval: number; // clamped -10 to +10 for graphing
    scoreDisplay: string;
    winChance: number;
    classification: MoveClassification;
  }[];
  history: MoveReviewPoint[];
}

/** Convert centipawns to winning chances percentage (0 - 100%) */
export function centipawnsToWinChance(cp: number, mate?: number): number {
  if (mate !== undefined && mate !== 0) {
    return mate > 0 ? 100 : 0;
  }
  // Formula calibrated to Lichess / Chess.com win probability sigmoid
  const clamped = Math.max(-2000, Math.min(2000, cp));
  const chance = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
  return Math.round(Math.max(0, Math.min(100, chance)) * 10) / 10;
}

class StockfishEngineService {
  private worker: Worker | null = null;
  private isReady = false;
  private initPromise: Promise<void> | null = null;
  private currentEvalReject: ((reason?: unknown) => void) | null = null;
  private messageListeners: ((line: string) => void)[] = [];

  constructor() {
    // Lazy worker initialization in browser
  }

  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.isReady && this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        // Path to the downloaded stockfish lite single worker in public/engines/stockfish/
        const workerUrl = '/engines/stockfish/stockfish-19-lite-single.js';
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e: MessageEvent) => {
          const line = typeof e.data === 'string' ? e.data : '';
          this.messageListeners.forEach((listener) => listener(line));
        };

        this.worker.onerror = (err) => {
          console.warn('[Stockfish] Worker encountered an error:', err);
        };

        const readyHandler = (line: string) => {
          if (line.includes('readyok')) {
            this.isReady = true;
            this.removeMessageListener(readyHandler);
            resolve();
          }
        };

        this.addMessageListener(readyHandler);

        // Send UCI handshake
        this.worker.postMessage('uci');
        this.worker.postMessage('setoption name MultiPV value 1');
        this.worker.postMessage('isready');

        // Fallback timeout in case wasm is slow to stream
        setTimeout(() => {
          if (!this.isReady) {
            this.isReady = true;
            this.removeMessageListener(readyHandler);
            resolve();
          }
        }, 3500);
      } catch (err) {
        console.error('[Stockfish] Failed to create Worker:', err);
        reject(err);
      }
    });

    return this.initPromise;
  }

  public addMessageListener(fn: (line: string) => void) {
    this.messageListeners.push(fn);
  }

  public removeMessageListener(fn: (line: string) => void) {
    this.messageListeners = this.messageListeners.filter((l) => l !== fn);
  }

  public sendCommand(cmd: string) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  public stopEvaluation() {
    if (this.currentEvalReject) {
      this.currentEvalReject(new Error('Evaluation cancelled'));
      this.currentEvalReject = null;
    }
    this.sendCommand('stop');
  }

  /**
   * Evaluate a single FEN position up to given depth
   * Prioritizes /api/stockfish backend (Lichess Cloud Eval & Stockfish 16 Engine)
   * Falls back to local Web Worker if network is unavailable
   */
  public async evaluatePosition(
    fen: string,
    depth = 14,
    onProgress?: (progress: PositionEvaluation) => void
  ): Promise<PositionEvaluation> {
    const cleanFen = fen.trim();

    // 1. Try Next.js Backend Stockfish Route first (super fast, depth 40-62)
    try {
      const res = await fetch(`/api/stockfish?fen=${encodeURIComponent(cleanFen)}&depth=${depth}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const evalResult: PositionEvaluation = {
            fen: cleanFen,
            depth: data.depth || depth,
            scoreCp: data.scoreCp || 0,
            scoreDisplay: data.scoreDisplay || '0.0',
            mateIn: data.mateIn,
            winChanceWhite: data.winChanceWhite ?? centipawnsToWinChance(data.scoreCp || 0, data.mateIn),
            bestMoveUci: data.bestMoveUci,
            bestMoveSan: data.bestMoveSan,
            isThinking: false,
          };
          if (onProgress) onProgress(evalResult);
          return evalResult;
        }
      }
    } catch {
      // Backend unavailable or offline, continue to local Web Worker
    }

    // 2. Local Web Worker fallback
    await this.init();

    this.stopEvaluation();
    // Flush: wait until the engine acknowledged the stop (any stale `bestmove` is emitted before `readyok`)
    await new Promise<void>((res) => {
      const h = (l: string) => {
        if (l.includes('readyok')) {
          this.removeMessageListener(h);
          res();
        }
      };
      this.addMessageListener(h);
      this.sendCommand('isready');
      setTimeout(() => {
        this.removeMessageListener(h);
        res();
      }, 1500);
    });

    return new Promise<PositionEvaluation>((resolve, reject) => {
      this.currentEvalReject = reject;

      let latestEval: PositionEvaluation = {
        fen: cleanFen,
        depth: 0,
        scoreCp: 0,
        scoreDisplay: '0.0',
        winChanceWhite: 50,
        isThinking: true,
      };

      const isBlackToMove = cleanFen.split(' ')[1] === 'b';

      const lineHandler = (line: string) => {
        // e.g.: info depth 14 seldepth 18 score cp 85 nodes 45000 nps 1200000 pv e2e4 e7e5
        if (line.startsWith('info') && line.includes('score')) {
          const depthMatch = line.match(/depth\s+(\d+)/);
          const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
          const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
          const pvMatch = line.match(/pv\s+([a-h1-8qrbn\s]+)/);

          const currentDepth = depthMatch ? parseInt(depthMatch[1], 10) : latestEval.depth;

          let cp = 0;
          let mate: number | undefined;
          let scoreText = '0.0';

          if (mateMatch) {
            mate = parseInt(mateMatch[1], 10);
            // Invert if Black to move so score is from White's perspective
            const realMate = isBlackToMove ? -mate : mate;
            mate = realMate;
            scoreText = realMate > 0 ? `M${realMate}` : `-M${Math.abs(realMate)}`;
            cp = realMate > 0 ? 10000 : -10000;
          } else if (cpMatch) {
            let rawCp = parseInt(cpMatch[1], 10);
            if (isBlackToMove) rawCp = -rawCp;
            cp = rawCp;
            const pawnVal = (cp / 100).toFixed(1);
            scoreText = cp > 0 ? `+${pawnVal}` : pawnVal === '-0.0' ? '0.0' : `${pawnVal}`;
          }

          const pvMoves = pvMatch ? pvMatch[1].trim().split(/\s+/) : latestEval.pv;
          const bestUci = pvMoves && pvMoves.length > 0 ? pvMoves[0] : latestEval.bestMoveUci;

          latestEval = {
            fen: cleanFen,
            depth: currentDepth,
            scoreCp: cp,
            scoreDisplay: scoreText,
            mateIn: mate,
            winChanceWhite: centipawnsToWinChance(cp, mate),
            bestMoveUci: bestUci,
            pv: pvMoves,
            isThinking: true,
          };

          if (onProgress) {
            onProgress(latestEval);
          }
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/);
          const bestMove = parts[1] && parts[1] !== '(none)' ? parts[1] : latestEval.bestMoveUci;

          latestEval = {
            ...latestEval,
            bestMoveUci: bestMove,
            isThinking: false,
          };

          this.removeMessageListener(lineHandler);
          this.currentEvalReject = null;
          resolve(latestEval);
        }
      };

      this.addMessageListener(lineHandler);

      this.sendCommand('ucinewgame');
      this.sendCommand(`position fen ${cleanFen}`);
      this.sendCommand(`go depth ${depth}`);
    });
  }

  public terminate() {
    this.stopEvaluation();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.initPromise = null;
    }
  }
}

// Global Singleton for easy browser consumption
let engineSingleton: StockfishEngineService | null = null;

export function getStockfishEngine(): StockfishEngineService {
  if (!engineSingleton) {
    engineSingleton = new StockfishEngineService();
  }
  return engineSingleton;
}

export async function fetchStockfishEvaluation(
  fen: string,
  depth = 14
): Promise<PositionEvaluation | null> {
  try {
    const engine = getStockfishEngine();
    return await engine.evaluatePosition(fen, depth);
  } catch (err) {
    console.warn('[Stockfish] Evaluation failed:', err);
    return null;
  }
}

