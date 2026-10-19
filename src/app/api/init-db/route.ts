import { NextResponse } from 'next/server';
import { initDb, isDbConfigured } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Variabel lingkungan POSTGRES_URL atau DATABASE_URL belum ditemukan. Hubungkan Vercel Postgres terlebih dahulu.',
        },
        { status: 400 }
      );
    }

    const result = await initDb();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Struktur tabel Neon siap. Tidak ada data contoh yang ditambahkan.',
    });
  } catch (error: any) {
    console.error('API /api/init-db GET error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Terjadi kesalahan inisialisasi database.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Variabel lingkungan POSTGRES_URL atau DATABASE_URL belum ditemukan. Hubungkan Vercel Postgres terlebih dahulu.',
        },
        { status: 400 }
      );
    }

    const result = await initDb();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Struktur tabel Neon siap. Tidak ada data contoh yang ditambahkan.',
    });
  } catch (error: any) {
    console.error('API /api/init-db POST error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Terjadi kesalahan inisialisasi database.' },
      { status: 500 }
    );
  }
}
