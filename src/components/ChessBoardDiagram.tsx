'use client';

import React from 'react';

interface ChessBoardDiagramProps {
  fen: string;
  caption?: string;
  highlightSquares?: string[]; // e.g. ['e4', 'd4', 'e5', 'd5'] or ['c7', 'a8', 'e8']
  flip?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function ChessBoardDiagram({
  fen,
  caption,
  highlightSquares = [],
  flip = false,
}: ChessBoardDiagramProps) {
  // Parse FEN placement string (first space-separated token if full FEN is provided)
  const placement = fen.trim().split(' ')[0];
  const rankStrings = placement.split('/');

  // Build 8x8 board representation [rankIdx 0..7][fileIdx 0..7]
  const board: Array<Array<{ square: string; piece: string | null }>> = [];

  for (let r = 0; r < 8; r++) {
    const rankStr = rankStrings[r] || '8';
    const rankNum = RANKS[r];
    const row: Array<{ square: string; piece: string | null }> = [];
    let fileIdx = 0;

    for (const char of rankStr) {
      if (char >= '1' && char <= '8') {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) {
          if (fileIdx < 8) {
            row.push({ square: `${FILES[fileIdx]}${rankNum}`, piece: null });
            fileIdx++;
          }
        }
      } else {
        const isWhite = char === char.toUpperCase();
        const pieceType = char.toUpperCase();
        const pieceCode = `${isWhite ? 'w' : 'b'}${pieceType}`;
        if (fileIdx < 8) {
          row.push({ square: `${FILES[fileIdx]}${rankNum}`, piece: pieceCode });
          fileIdx++;
        }
      }
    }
    board.push(row);
  }

  const displayBoard = flip
    ? [...board].reverse().map((row) => [...row].reverse())
    : board;

  const displayFiles = flip ? [...FILES].reverse() : FILES;
  const displayRanks = flip ? [...RANKS].reverse() : RANKS;

  return (
    <figure className="chess-diagram-figure">
      <div className="chess-diagram-board-wrap">
        <div className="chess-diagram-board" role="img" aria-label={caption || 'Papan Catur'}>
          {displayBoard.map((row, rIdx) => (
            <div key={rIdx} className="chess-diagram-row">
              {row.map((cell, fIdx) => {
                const isLight = (rIdx + fIdx) % 2 === 0;
                const isHighlighted = highlightSquares.includes(cell.square);

                return (
                  <div
                    key={cell.square}
                    className={`chess-diagram-square ${isLight ? 'is-light' : 'is-dark'} ${
                      isHighlighted ? 'is-highlighted' : ''
                    }`}
                    data-square={cell.square}
                  >
                    {/* Square coordinate labels */}
                    {fIdx === 0 && (
                      <span className="diagram-coord-rank">{displayRanks[rIdx]}</span>
                    )}
                    {rIdx === 7 && (
                      <span className="diagram-coord-file">{displayFiles[fIdx]}</span>
                    )}

                    {/* Piece image */}
                    {cell.piece && (
                      <img
                        src={`/pieces/${cell.piece}.svg`}
                        alt={cell.piece}
                        className="diagram-piece-img"
                        loading="lazy"
                        draggable={false}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {caption && (
        <figcaption className="chess-diagram-caption">
          <span className="caption-badge">♟️ Diagram Posisi</span>
          <span className="caption-text">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
