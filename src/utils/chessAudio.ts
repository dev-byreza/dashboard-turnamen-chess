/**
 * Chess.com Sound Effects & Theme Manager
 * Supports: default, marble, metal, nature, newspaper, silly, space, beat, lolz
 */

export type ChessSoundTheme =
  | 'default'
  | 'marble'
  | 'metal'
  | 'nature'
  | 'newspaper'
  | 'silly'
  | 'space'
  | 'beat'
  | 'lolz';

export interface ChessSoundThemeMeta {
  id: ChessSoundTheme;
  name: string;
  description: string;
  icon: string;
}

export const CHESS_SOUND_THEMES: ChessSoundThemeMeta[] = [
  {
    id: 'default',
    name: 'Default (Klasik Wood)',
    description: 'Suara bidak kayu standar khas Chess.com',
    icon: '🪵',
  },
  {
    id: 'marble',
    name: 'Marble (Batu Marmer)',
    description: 'Dentang padat bidak batu marmer',
    icon: '🏛️',
  },
  {
    id: 'metal',
    name: 'Metal (Logam Besi)',
    description: 'Suara benturan logam futuristik',
    icon: '⚙️',
  },
  {
    id: 'nature',
    name: 'Nature (Alami)',
    description: 'Efek suara organik dari alam',
    icon: '🍃',
  },
  {
    id: 'newspaper',
    name: 'Newspaper (Koran Kertas)',
    description: 'Keresek lembut lembaran koran',
    icon: '📰',
  },
  {
    id: 'silly',
    name: 'Silly (Kocak & Jenaka)',
    description: 'Suara kartun lucu dan ceria',
    icon: '🤪',
  },
  {
    id: 'space',
    name: 'Space (Luar Angkasa)',
    description: 'Suara elektronik sci-fi antariksa',
    icon: '🚀',
  },
  {
    id: 'beat',
    name: 'Beat (Beatbox Ritme)',
    description: 'Dentuman ritme beatbox dinamis',
    icon: '🎧',
  },
  {
    id: 'lolz',
    name: 'Lolz (Meme Humor)',
    description: 'Efek suara meme dan candaan',
    icon: '🤣',
  },
];

export type ChessSoundAction =
  | 'move-self'
  | 'move-opponent'
  | 'capture'
  | 'castle'
  | 'move-check'
  | 'promote'
  | 'game-start'
  | 'game-end'
  | 'illegal'
  | 'tenseconds';

const THEME_STORAGE_KEY = 'chess_sound_theme';
const ENABLED_STORAGE_KEY = 'chess_sound_enabled';

class ChessAudioManager {
  private currentTheme: ChessSoundTheme = 'default';
  private isEnabled = true;
  private audioCache = new Map<string, HTMLAudioElement>();

  constructor() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ChessSoundTheme;
      if (savedTheme && CHESS_SOUND_THEMES.some((t) => t.id === savedTheme)) {
        this.currentTheme = savedTheme;
      }
      const savedEnabled = localStorage.getItem(ENABLED_STORAGE_KEY);
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
    }
  }

  public getTheme(): ChessSoundTheme {
    return this.currentTheme;
  }

  public setTheme(theme: ChessSoundTheme) {
    this.currentTheme = theme;
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setIsEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
    }
  }

  /**
   * Preload audio for active theme
   */
  public preloadTheme(theme = this.currentTheme) {
    if (typeof window === 'undefined') return;
    const actions: ChessSoundAction[] = [
      'move-self',
      'move-opponent',
      'capture',
      'castle',
      'move-check',
      'promote',
    ];
    actions.forEach((act) => {
      const url = `/sounds/chess/${theme}/${act}.mp3`;
      if (!this.audioCache.has(url)) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.audioCache.set(url, audio);
      }
    });
  }

  /**
   * Play chess sound effect
   */
  public play(action: ChessSoundAction, customTheme?: ChessSoundTheme) {
    if (typeof window === 'undefined' || !this.isEnabled) return;

    const theme = customTheme || this.currentTheme;
    const url = `/sounds/chess/${theme}/${action}.mp3`;

    try {
      let audio = this.audioCache.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        this.audioCache.set(url, audio);
      }

      // Clone audio instance to support rapid and uninterrupted autoplay
      const clone = audio.cloneNode(true) as HTMLAudioElement;
      clone.volume = 0.9;
      const playPromise = clone.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback to original audio element
          try {
            audio.currentTime = 0;
            audio.play().catch(() => {});
          } catch {
            // Audio playback failed
          }
        });
      }
    } catch {
      // Audio playback failed silently
    }
  }

  /**
   * Determine sound action based on chess move properties
   */
  public playMoveSound(params: {
    san: string;
    isCapture?: boolean;
    isCheck?: boolean;
    isCastle?: boolean;
    isPromotion?: boolean;
    color?: 'w' | 'b';
  }) {
    const { san, isCapture, isCheck, isCastle, isPromotion, color } = params;

    if (isCheck || san.includes('+') || san.includes('#')) {
      this.play('move-check');
    } else if (isCastle || san.startsWith('O-O')) {
      this.play('castle');
    } else if (isPromotion || san.includes('=')) {
      this.play('promote');
    } else if (isCapture || san.includes('x')) {
      this.play('capture');
    } else {
      const action = color === 'b' ? 'move-opponent' : 'move-self';
      this.play(action);
    }
  }
}

let audioManagerInstance: ChessAudioManager | null = null;

export function getChessAudioManager(): ChessAudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new ChessAudioManager();
  }
  return audioManagerInstance;
}
