export interface Player {
  id: string;
  name: string;
  seed: number;
  rating?: number;
  /** Manually recorded historical rated games; completed matches in other tournaments are added during Elo calculation. */
  ratedGames?: number;
  avatar?: string;
  club?: string;
  title?: 'GM' | 'IM' | 'FM' | 'NM' | 'CM' | 'WGM' | 'WIM' | 'L1' | 'L2' | 'L3' | string;
  chessComUsername?: string;
}

export type MatchResult = '1-0' | '0-1' | '0.5-0.5' | null;

export interface RoundRobinMatch {
  id: string;
  round: number; // e.g. 1, 2, 3
  matchNumber: number; // e.g. 1 to 6
  whitePlayerId: string;
  blackPlayerId: string;
  result: MatchResult;
  note?: string;
  isCustom?: boolean;
}

export interface KnockoutMatch {
  id: 'semi1' | 'semi2' | 'final' | 'third';
  title: string;
  player1Label: string;
  player2Label: string;
  player1Id?: string;
  player2Id?: string;
  score1?: number | string;
  score2?: number | string;
  winnerId?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface StandingRow {
  rank: number;
  player: Player;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  buchholz?: number;
  sonnebornBerger?: number;
  directEncounter?: number;
  initialRating?: number;
  currentRating?: number;
  ratingChange?: number;
}

export interface TournamentConfig {
  title: string;
  subtitle: string;
  date: string;
  location: string;
  organizer: string;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  theme: 'royal-gold' | 'dark-obsidian' | 'classic-wood' | 'emerald-master' | 'minimal-modern';
}

export interface TournamentData {
  config: TournamentConfig;
  players: Player[];
  groupMatches: RoundRobinMatch[];
  knockoutMatches: Record<string, KnockoutMatch>;
}

// Swiss System Models
export interface SwissMatch {
  id: string;
  round: number;
  boardNumber: number;
  whitePlayerId: string;
  blackPlayerId: string; // '__bye__' if bye
  result: MatchResult;
  isBye?: boolean;
  chessComUrl?: string;
  chessComSyncedAt?: number;
  chessComFen?: string;
  chessComPgn?: string;
  chessComTermination?: string;
  chessComAnalysis?: Record<string, any>;
}

export interface SwissPairingOverride {
  whitePlayerId: string;
  blackPlayerId: string;
}

export interface SwissTournamentData {
  id: string;
  title: string;
  subtitle: string;
  totalRounds: number;
  currentRound: number;
  players: Player[];
  matches: SwissMatch[];
  isFinished: boolean;
}

// Tournament management (multi-tournament + participant database)
export interface Tournament {
  id: string;
  /** Human-readable unique identifier, generated from the tournament name/date. */
  slug?: string;
  name: string;
  date: string; // yyyy-mm-dd, may be empty
  location: string;
  totalRounds: number;
  playerIds: string[]; // references into the roster
  matches: SwissMatch[];
  /** Snapshot of the admin-approved starting Elo, locked once the first result is entered. */
  initialRatings?: Record<string, number>;
  /** Starting lifetime rated-game count snapshot for stable K-factor calculations. */
  initialRatedGames?: Record<string, number>;
  /** Optional admin-defined pairings for a specific round. */
  pairingOverrides?: Record<number, SwissPairingOverride[]>;
  /** Admin-managed local date and time for each round (datetime-local format). */
  roundSchedules?: Record<number, string>;
  createdAt: number;
}

export interface TournamentStore {
  roster: Player[];
  tournaments: Tournament[];
  activeId: string | null;
}

export interface TournamentFormData {
  name: string;
  slug: string;
  date: string;
  location: string;
  totalRounds: number;
  playerIds: string[];
}
