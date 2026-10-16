import { NextResponse } from 'next/server';
import {
  isDbConfigured,
  getStoreFromDb,
  saveStoreToDb,
  DEFAULT_STORE,
} from '../../../lib/db';
import { TournamentStore } from '../../../types/chess';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({
        success: true,
        source: 'unconfigured',
        configured: false,
        store: DEFAULT_STORE,
        message: 'Variabel POSTGRES_URL / DATABASE_URL belum disetel di Vercel/Environment.',
      });
    }

    const store = await getStoreFromDb();
    if (!store) {
      return NextResponse.json({
        success: true,
        source: 'default',
        configured: true,
        store: DEFAULT_STORE,
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
        store: DEFAULT_STORE,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const store = body?.store as TournamentStore;

    if (!store || !Array.isArray(store.roster) || !Array.isArray(store.tournaments)) {
      return NextResponse.json(
        { success: false, error: 'Format data TournamentStore tidak valid.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: true,
        savedToDb: false,
        configured: false,
        message: 'Data hanya tersimpan lokal (POSTGRES_URL belum disetel di Vercel).',
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
