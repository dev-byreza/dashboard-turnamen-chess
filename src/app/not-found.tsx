import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070b14', color: '#fff', textAlign: 'center', padding: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ffd700' }}>404 - Halaman Tidak Ditemukan</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Halaman yang Anda tuju tidak tersedia.</p>
        <Link href="/" style={{ padding: '0.65rem 1.25rem', background: '#d4af37', color: '#070b14', fontWeight: 700, borderRadius: '8px', textDecoration: 'none' }}>
          Kembali ke Dashboard Turnamen
        </Link>
      </div>
    </main>
  );
}
