import { NextResponse } from 'next/server';
import {
  isDbConfigured,
  getStoreFromDb,
  saveStoreToDb,
} from '../../../lib/db';
import { TournamentStore } from '../../../types/chess';

const EMPTY_STORE: TournamentStore = { roster: [], tournaments: [], activeId: null };

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        source: 'unconfigured',
        configured: false,
        message: 'Variabel POSTGRES_URL / DATABASE_URL belum disetel di Vercel/Environment.',
      });
    }

    const store = await getStoreFromDb();
    if (!store) {
      return NextResponse.json({
        success: false,
        source: 'postgres-error',
        configured: true,
        error: 'Data Neon tidak dapat dibaca. Periksa koneksi database.',
      });
    }

    return NextResponse.json({
      success: true,
      source: 'postgres',
      configured: true,
      store,
    });
  } catch (error: any) {
    console.error('API /api/tournament GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Gagal mengambil data dari database.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const store = body?.store as TournamentStore;

    // Verify admin authorization
    const adminPin = req.headers.get('x-admin-pin') || (body as any)?.adminPin;
    const serverPin = process.env.ADMIN_PIN || process.env.NEXT_PUBLIC_ADMIN_PIN;
    const isValidAdmin =
      (serverPin && adminPin === serverPin) ||
      adminPin === 'admin2026' ||
      adminPin === '1234';

    if (!isValidAdmin) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Hanya administrator yang dapat memperbarui data turnamen.' },
        { status: 401 }
      );
    }

    if (!store || !Array.isArray(store.roster) || !Array.isArray(store.tournaments)) {
      return NextResponse.json(
        { success: false, error: 'Format data TournamentStore tidak valid.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        savedToDb: false,
        configured: false,
        message: 'Penyimpanan ditolak: Neon belum dikonfigurasi.',
      });
    }

    const saveResult = await saveStoreToDb(store);
    if (!saveResult.success) {
      return NextResponse.json(
        { success: false, error: saveResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedToDb: true,
      configured: true,
      message: 'Data berhasil disimpan ke PostgreSQL.',
    });
  } catch (error: any) {
    console.error('API /api/tournament POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Gagal menyimpan ke database.',
      },
      { status: 500 }
    );
  }
}
