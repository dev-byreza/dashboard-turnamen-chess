import { NextResponse } from 'next/server';
import { getDbBlogPosts, isDbConfigured } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database PostgreSQL belum dikonfigurasi.',
          posts: [],
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const tag = searchParams.get('tag');

    let posts = await getDbBlogPosts({ limit });

    if (tag && tag.toLowerCase() !== 'semua') {
      posts = posts.filter(
        (p) =>
          p.tag?.toLowerCase() === tag.toLowerCase() ||
          p.category?.toLowerCase() === tag.toLowerCase()
      );
    }

    return NextResponse.json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error: any) {
    console.error('API /api/blog GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Gagal memuat artikel blog dari database.',
        posts: [],
      },
      { status: 500 }
    );
  }
}

