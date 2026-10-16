import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Turnamen Catur Sistem Swiss | Dashboard Modern & Elegan',
  description: 'Dashboard Turnamen Catur Sistem Swiss Minimalis, Modern dan Elegan dengan FIDE Swiss Pairing, Buchholz, dan Jam Catur Terintegrasi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
