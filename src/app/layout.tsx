import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const coinageFont = localFont({
  src: '../../CoinageCapsKrugerGray.ttf',
  variable: '--font-coinage',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://chesspoliwako.vercel.app'
  ),
  title: {
    default: 'Chess Club Poliwako | Dashboard Turnamen Catur Politeknik Sorowako',
    template: '%s | Chess Club Poliwako',
  },
  description:
    'Portal resmi Turnamen Catur Chess Club Poliwako (Politeknik Sorowako). Jadwal pertandingan sistem Swiss, live standings, rating Elo, verifikasi Chess.com, dan analisis Stockfish 19.',
  keywords: [
    'chess poliwako',
    'catur poliwako',
    'chess club poliwako',
    'chess politeknik sorowako',
    'politeknik sorowako',
    'catur politeknik sorowako',
    'poliwako',
    'politeknik sorowako chess',
    'turnamen catur poliwako',
    'turnamen catur politeknik sorowako',
    'dashboard swiss poliwako',
    'catur sorowako',
    'chess sorowako',
  ],
  authors: [{ name: 'Chess Club Politeknik Sorowako' }],
  creator: 'Chess Club Poliwako',
  publisher: 'Politeknik Sorowako',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/images/logo-chess-club-sorowako.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/images/logo-chess-club-sorowako.png',
    apple: '/images/logo-chess-club-sorowako.png',
  },
  openGraph: {
    title: 'Chess Club Poliwako | Dashboard Turnamen Catur Politeknik Sorowako',
    description:
      'Portal resmi Turnamen Catur Chess Club Poliwako (Politeknik Sorowako). Jadwal babak sistem Swiss, live standings, profil Chess.com, dan analisis Stockfish 19.',
    type: 'website',
    locale: 'id_ID',
    siteName: 'Chess Club Poliwako',
    images: ['/images/logo-chess-club-sorowako.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Chess Club Poliwako | Dashboard Turnamen Catur Politeknik Sorowako',
    description:
      'Portal resmi Turnamen Catur Chess Club Poliwako. Jadwal sistem Swiss, live standings, dan analisis Stockfish 19.',
    images: ['/images/logo-chess-club-sorowako.png'],
  },
  verification: {
    google: 'r2pQdj_gyvNqj74cYKT3ZPq99aOdKz4p4UZeTYjA8wo',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={coinageFont.variable}>
      <head>
        <meta name="google-site-verification" content="r2pQdj_gyvNqj74cYKT3ZPq99aOdKz4p4UZeTYjA8wo" />
        <meta name="google-site-verification" content="google9e513362f436402a" />
        <link rel="icon" type="image/png" href="/images/logo-chess-club-sorowako.png" />
        <link rel="shortcut icon" href="/images/logo-chess-club-sorowako.png" />
        <link rel="apple-touch-icon" href="/images/logo-chess-club-sorowako.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
