import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        color: 'var(--navy)',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div>
        <div style={{ fontSize: '4rem', color: 'var(--gold)' }}>♞</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 'normal', marginBottom: '0.5rem' }}>
          404 - Halaman Tidak Ditemukan
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Halaman yang Anda tuju tidak tersedia.
        </p>
        <Link href="/" className="btn-gold-action" style={{ textDecoration: 'none' }}>
          Kembali ke Dashboard Turnamen
        </Link>
      </div>
    </main>
  );
}
