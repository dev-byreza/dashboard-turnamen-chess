const { Chess } = require('chess.js');

// Let's test detectPieceSacrifice from chessAnalysisEngine
// We can copy detectPieceSacrifice here to test it directly
const PIECE_VALUES = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 20000,
};

function isSquareDefended(chess, square, byColor) {
  const moves = chess.moves({ verbose: true });
  return moves.some(m => m.color === byColor && m.to === square);
}

function detectPieceSacrifice(fenBefore, playedUci) {
  const from = playedUci.slice(0, 2);
  const to = playedUci.slice(2, 4);

  const chess = new Chess(fenBefore);
  const moverColor = chess.turn();
  const opponentColor = moverColor === 'w' ? 'b' : 'w';

  const move = chess.move({ from, to });
  if (!move) return false;

  const movedPiece = move.piece;
  const capturedPiece = move.captured;

  if (movedPiece === 'p' || movedPiece === 'k') return false;

  const movedValue = PIECE_VALUES[movedPiece];
  const capturedValue = capturedPiece ? PIECE_VALUES[capturedPiece] : 0;

  const opponentMoves = chess.moves({ verbose: true });
  const directAttackers = opponentMoves.filter(m => m.to === to);

  if (directAttackers.length > 0) {
    const isSquareDefendedByUs = isSquareDefended(chess, to, moverColor);
    const cheapestAttackerValue = Math.min(...directAttackers.map(m => PIECE_VALUES[m.piece]));

    console.log('Direct attackers on g2:', directAttackers.map(m => m.san));
    console.log('isSquareDefendedByUs:', isSquareDefendedByUs);
    console.log('movedValue:', movedValue, 'capturedValue:', capturedValue, 'cheapestAttackerValue:', cheapestAttackerValue);

    if (!isSquareDefendedByUs && movedValue - capturedValue >= 200) {
      console.log('Triggered Scenario 1!');
      return true;
    }

    if (
      isSquareDefendedByUs &&
      movedValue - capturedValue >= 200 &&
      cheapestAttackerValue < movedValue - capturedValue
    ) {
      console.log('Triggered Scenario 2!');
      return true;
    }
  }

  return false;
}

const fenBefore = '2k3rr/pp1qbp2/3p1n2/3P4/P1P1pQ2/1P1P3P/5PP1/4RRK1 b - - 0 20';
console.log('detectPieceSacrifice result:', detectPieceSacrifice(fenBefore, 'g8g2'));
