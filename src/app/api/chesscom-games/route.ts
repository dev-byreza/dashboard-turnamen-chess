import { NextRequest, NextResponse } from 'next/server';
import { fetchPlayerRecentGames, sanitizeChessComUsername } from '@/utils/chessComApi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawUsername = searchParams.get('username') || '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 12, 1), 30) : 15;

  const username = sanitizeChessComUsername(rawUsername);
  if (!username) {
    return NextResponse.json(
      { success: false, error: 'Username Chess.com harus diisi' },
      { status: 400 }
    );
  }

  try {
    const games = await fetchPlayerRecentGames(username, limit);
    return NextResponse.json({
      success: true,
      username,
      total: games.length,
      games,
    });
  } catch (error: any) {
    console.error('Error fetching Chess.com games:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Gagal mengambil riwayat game dari Chess.com',
        games: [],
      },
      { status: 500 }
    );
  }
}
