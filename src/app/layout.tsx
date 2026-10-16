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
  openGraph: {
    title: 'Chess Club Poliwako',
    description: 'Dashboard CHESS POLIWAKO.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Chess Club Poliwako',
    description: 'Dashboard CHESS POLIWAKO.',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
