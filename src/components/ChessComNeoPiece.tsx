import React from 'react';

export type PieceCode = 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';

interface ChessComNeoPieceProps {
  piece: PieceCode;
  className?: string;
  size?: number | string;
}

/**
 * Authentic Chess.com Neo Piece Vector Set
 * Faithfully styled to match Chess.com's default Neo theme:
 * - Crisp SVG vectors
 * - Balanced curves and clean silhouettes
 * - Subtle inner highlights and defined outlines
 */
export const ChessComNeoPiece: React.FC<ChessComNeoPieceProps> = ({
  piece,
  className = '',
  size = '100%',
}) => {
  const isWhite = piece === piece.toUpperCase();
  const type = piece.toLowerCase();

  const fill = isWhite ? '#ffffff' : '#272522';
  const stroke = isWhite ? '#1e1e1e' : '#121212';
  const highlight = isWhite ? '#f3f4f6' : '#413e39';
  const detail = isWhite ? '#e5e7eb' : '#33302b';

  switch (type) {
    case 'p': // Pawn
      return (
        <svg
          viewBox="0 0 45 45"
          width={size}
          height={size}
          className={`chess-piece-neo ${className}`}
        >
          {/* Base */}
          <path
            d="M13.5 38.5h18c1.5 0 2-1 2-2s-.5-2-2-2h-18c-1.5 0-2 1-2 2s.5 2 2 2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Body */}
          <path
            d="M15 34.5c1-3 3-5 5-8.5-.7-.4-1.5-1-1.5-2 0-1.2 1-2 2-2h4c1 0 2 .8 2 2 0 1-.8 1.6-1.5 2 2 3.5 4 5.5 5 8.5H15z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Head sphere */}
          <circle
            cx="22.5"
            cy="15"
            r="6.5"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {/* Subtle 3D shine */}
          {isWhite && (
            <path
              d="M20 12.5a4 4 0 0 1 4-2.5"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </svg>
      );

    case 'n': // Knight
      return (
        <svg
          viewBox="0 0 45 45"
          width={size}
          height={size}
          className={`chess-piece-neo ${className}`}
        >
          {/* Base */}
          <path
            d="M12.5 38.5h20c1.5 0 2-1 2-2s-.5-2-2-2h-20c-1.5 0-2 1-2 2s.5 2 2 2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Horse Body and Head */}
          <path
            d="M13.5 34.5c.5-5 2.5-9 6-12-1-2-1.5-4-1.5-6.5 0-4 3.5-7 7.5-7 2.5 0 4.5 1 5.5 3.5 1.5 1.5 4.5 3.5 4.5 7 0 2.5-1.5 5-3 6.5 1.5 2 2.5 4.5 3 8.5H13.5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Mane ridges */}
          <path
            d="M27 9c2 2 3 5 2.5 8M29 13c1.5 2 2 4.5 1.5 7M22 8c.5-1.5 1.5-2.5 3-3"
            stroke={isWhite ? '#d1d5db' : '#524e47'}
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
          {/* Muzzle curve and nostril */}
          <circle cx="28.5" cy="18" r="1" fill={isWhite ? '#1e1e1e' : '#d1d5db'} />
          {/* Eye */}
          <circle cx="24.5" cy="14" r="1.3" fill={isWhite ? '#1e1e1e' : '#f3f4f6'} />
        </svg>
      );

    case 'b': // Bishop
      return (
        <svg
          viewBox="0 0 45 45"
          width={size}
          height={size}
          className={`chess-piece-neo ${className}`}
        >
          {/* Base */}
          <path
            d="M13 38.5h19c1.5 0 2-1 2-2s-.5-2-2-2H13c-1.5 0-2 1-2 2s.5 2 2 2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Mitre body */}
          <path
            d="M14.5 34.5c1-4 3-7 5.5-10.5C18 21.5 17 18 17 14.5c0-4.5 2.5-8 5.5-8s5.5 3.5 5.5 8c0 3.5-1 7-3 9.5 2.5 3.5 4.5 6.5 5.5 10.5h-16z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Top jewel sphere */}
          <circle
            cx="22.5"
            cy="6.5"
            r="2"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.2"
          />
          {/* Diagonal cut slit */}
          <path
            d="M20.5 13l4 4"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Inner ring */}
          <path
            d="M19 22.5h7"
            stroke={stroke}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'r': // Rook
      return (
        <svg
          viewBox="0 0 45 45"
          width={size}
          height={size}
          className={`chess-piece-neo ${className}`}
        >
          {/* Base */}
          <path
            d="M12.5 38.5h20c1.5 0 2-1 2-2s-.5-2-2-2h-20c-1.5 0-2 1-2 2s.5 2 2 2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Tower body */}
          <path
            d="M14.5 34.5l1.5-17h13l1.5 17H14.5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Castle top rim */}
          <path
            d="M13.5 17.5h18v-7h-3v3.5h-3.5v-3.5h-5v3.5h-3.5v-3.5h-3v7z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Window / accent slit */}
          <path
            d="M17 24.5h11"
            stroke={stroke}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'q': // Queen
      return (
        <svg
          viewBox="0 0 45 45"
          width={size}
          height={size}
          className={`chess-piece-neo ${className}`}
        >
          {/* Base */}
          <path
            d="M12 38.5h21c1.5 0 2-1 2-2s-.5-2-2-2H12c-1.5 0-2 1-2 2s.5 2 2 2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Crown & Gown Body */}
          <path
            d="M13.5 34.5c1-6 4-10 6.5-12.5-1.5-1.5-2.5-3.5-2.5-6 0-3 2.5-5.5 5-5.5s5 2.5 5 5.5c0 2.5-1 4.5-2.5 6 2.5 2.5 5.5 6.5 6.5 12.5H13.5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Coronet points */}
          <circle cx="12.5" cy="14" r="2" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <circle cx="17.5" cy="11.5" r="2" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <circle cx="22.5" cy="10" r="2.2" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <circle cx="27.5" cy="11.5" r="2" fill={fill} stroke={stroke} strokeWidth="1.2" />
          <circle cx="32.5" cy="14" r="2" fill={fill} stroke={stroke} strokeWidth="1.2" />
          {/* Queen waist accent */}
          <path
            d="M18.5 27h8"
            stroke={stroke}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'k': // King
    default:
      return (
        <svg
          viewBox="0 0 45 45"
          width={size}
          height={size}
          className={`chess-piece-neo ${className}`}
        >
          {/* Base */}
          <path
            d="M12 38.5h21c1.5 0 2-1 2-2s-.5-2-2-2H12c-1.5 0-2 1-2 2s.5 2 2 2z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* King Robe Body */}
          <path
            d="M13.5 34.5c1-4.5 3.5-7.5 6.5-9.5-2-1.5-3.5-4-3.5-7 0-4 2.5-7.5 6-7.5s6 3.5 6 7.5c0 3-1.5 5.5-3.5 7 3 2 5.5 5 6.5 9.5H13.5z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Cross on Crown */}
          <path
            d="M22.5 5v5M20 7.5h5"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Crown collar rim */}
          <circle
            cx="22.5"
            cy="18"
            r="3"
            fill={highlight}
            stroke={stroke}
            strokeWidth="1.2"
          />
        </svg>
      );
  }
};
