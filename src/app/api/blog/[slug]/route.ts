import { NextResponse } from 'next/server';
import { getDbBlogPostBySlug, getDbBlogPosts, isDbConfigured } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database PostgreSQL belum dikonfigurasi.',
        },
        { status: 503 }
      );
    }

    const { slug } = await params;
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Parameter slug diperlukan.' },
        { status: 400 }
      );
    }

    const post = await getDbBlogPostBySlug(slug);
    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Artikel blog tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Get related posts (excluding current post)
    const allPosts = await getDbBlogPosts({ limit: 4 });
    const relatedPosts = allPosts
      .filter((p) => p.slug !== slug)
      .slice(0, 3)
      .map(({ id, slug, title, excerpt, date, tag, readTime, coverTone }) => ({
        id,
        slug,
        title,
        excerpt,
        date,
        tag,
        readTime,
        coverTone,
      }));

    return NextResponse.json({
      success: true,
      post,
      relatedPosts,
    });
  } catch (error: any) {
    console.error(`API /api/blog/[slug] error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Gagal memuat artikel blog dari database.',
      },
      { status: 500 }
    );
  }
}

