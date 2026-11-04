import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chess Poliwako',
    short_name: 'Chess Poliwako',
    description:
      'Portal resmi Turnamen Catur Chess Club Poliwako (Politeknik Sorowako). Live standings sistem Swiss, jadwal babak, verifikasi Chess.com, dan analisis Stockfish 19.',
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/images/logo-chess-club-sorowako.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/logo-chess-club-sorowako.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
