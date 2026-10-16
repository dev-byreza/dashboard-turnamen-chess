import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const coinageFont = localFont({
  src: '../../CoinageCapsKrugerGray.ttf',
  variable: '--font-coinage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Chess Club Poliwako',
  description: 'Dashboard CHESS POLIWAKO',
  icons: {
    icon: [
      { url: '/images/logo-chess-club-sorowako.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/images/logo-chess-club-sorowako.png',
    apple: '/images/logo-chess-club-sorowako.png',
  },
  openGraph: {
    title: 'Chess Club Poliwako',
    description: 'Dashboard CHESS POLIWAKO.',
    type: 'website',
    images: ['/images/logo-chess-club-sorowako.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Chess Club Poliwako',
    description: 'Dashboard CHESS POLIWAKO.',
    images: ['/images/logo-chess-club-sorowako.png'],
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
