import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const coinageFont = localFont({
  src: '../../CoinageCapsKrugerGray.ttf',
  variable: '--font-coinage',
  display: 'swap',
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://chesspoliwako.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Chess Club Poliwako | Dashboard Turnamen Catur Politeknik Sorowako',
    template: '%s | Chess Club Poliwako',
  },
  description:
    'Portal resmi Turnamen Catur Chess Club Poliwako (Politeknik Sorowako). Jadwal pertandingan sistem Swiss, live standings, rating Elo, verifikasi Chess.com, dan analisis Stockfish 19.',
  applicationName: 'Chess Club Poliwako',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Chess Club Poliwako',
  alternateName: ['Chess Poliwako', 'Catur Poliwako', 'Chess Club Politeknik Sorowako'],
  url: siteUrl,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={coinageFont.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}