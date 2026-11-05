'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Check,
  BookOpen,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { BlogPost, BlogPostSummary } from '../../../types/blog';
import { FUNDAMENTAL_CHESS_BLOG_POSTS } from '../../../lib/blogPostsSeed';
import { formatBlogDate } from '../../../lib/db';
import { BlogContentRenderer } from '../../../components/BlogContentRenderer';

const COVER_TONES = ['is-gold', 'is-green', 'is-blue'] as const;

export default function BlogSlugPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = (params?.slug || '').trim().toLowerCase();

  const initialSeed = FUNDAMENTAL_CHESS_BLOG_POSTS.find((p) => p.slug === slug);

  const [post, setPost] = useState<BlogPost | null>(() =>
    initialSeed
      ? {
          ...initialSeed,
          date: formatBlogDate(initialSeed.publishedAt),
        }
      : null
  );
  const [relatedPosts, setRelatedPosts] = useState<BlogPostSummary[]>(() =>
    FUNDAMENTAL_CHESS_BLOG_POSTS.filter((p) => p.slug !== slug)
      .slice(0, 3)
      .map(({ content, ...rest }) => ({
        ...rest,
        date: formatBlogDate(rest.publishedAt),
      }))
  );
  const [loading, setLoading] = useState<boolean>(!initialSeed);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    if (!initialSeed) {
      setLoading(true);
    }

    fetch(`/api/blog/${slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Artikel tidak ditemukan.');
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setPost(data.post);
        setRelatedPosts(data.relatedPosts || []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  return (
    <main className="blog-reader-page">
      <div className="chess-wrapper">
        {/* Top Navbar */}
        <header className="top-nav-bar">
          <div className="brand-section">
            <Link href="/" className="brand-title-wrap" style={{ textDecoration: 'none' }}>
              <div className="brand-logo-row">
                <img
                  src="/images/logo-chess-club-text.png"
                  alt="Chess Club Politeknik Sorowako"
                  className="brand-text-logo-img"
                />
              </div>
              <p className="brand-subtitle">Blog & Panduan Catur Fundamental</p>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Link href="/blog" className="btn-glass-secondary">
              <ArrowLeft size={15} />
              <span>Semua Blog</span>
            </Link>
            <Link href="/" className="btn-glass-secondary">
              <span>Dashboard</span>
            </Link>
          </div>
        </header>

        {loading ? (
          <section className="article-reader-loading" role="status" aria-label="Memuat artikel">
            <div className="chess-loading-board" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => (
                <span
                  key={index}
                  className={`chess-loading-square ${(Math.floor(index / 3) + (index % 3)) % 2 === 0 ? 'is-light' : 'is-dark'}`}
                />
              ))}
              <span className="chess-loading-knight">♞</span>
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Memuat artikel dari database...
            </p>
          </section>
        ) : error || !post ? (
          <div className="empty-state" style={{ margin: '4rem auto' }} role="alert">
            <BookOpen size={48} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
            <h1 className="empty-title">Artikel Tidak Ditemukan</h1>
            <p className="empty-desc">
              {error || `Artikel dengan slug "${slug}" belum tersedia atau telah dipindahkan.`}
            </p>
            <Link href="/blog" className="btn-gold-action" style={{ marginTop: '1.25rem' }}>
              Kembali ke Daftar Blog
            </Link>
          </div>
        ) : (
          <article className="article-reader-container">
            {/* Breadcrumb & Navigation */}
            <nav className="article-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/">Beranda</Link>
              <span className="breadcrumb-separator">/</span>
              <Link href="/blog">Blog</Link>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{post.tag}</span>
            </nav>

            {/* Article Header */}
            <header className="article-hero-header">
              <div className="article-category-badge-row">
                <span className={`article-category-badge ${post.coverTone || 'is-gold'}`}>
                  {post.tag}
                </span>
                <span className="article-read-time">
                  <Clock size={13} /> {post.readTime || '5 menit baca'}
                </span>
              </div>

              <h1 className="article-main-title">{post.title}</h1>

              <p className="article-lead-excerpt">{post.excerpt}</p>

              <div className="article-meta-bar">
                <div className="article-author-info">
                  <div className="article-author-avatar">
                    <User size={16} />
                  </div>
                  <div>
                    <span className="article-author-name">{post.author}</span>
                    <span className="article-published-date">
                      <Calendar size={12} /> {post.date}
                    </span>
                  </div>
                </div>

                <div className="article-actions-row">
                  {post.views !== undefined && post.views > 0 && (
                    <span className="article-views-count">
                      <Eye size={13} /> {post.views} kali dibaca
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="btn-article-share"
                    title="Salin tautan artikel"
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} style={{ color: '#81b64c' }} />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={14} />
                        <span>Bagikan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </header>

            {/* Article Content */}
            <div className="article-body-wrapper">
              <BlogContentRenderer content={post.content} />
            </div>

            {/* Article Bottom Actions */}
            <div className="article-bottom-actions">
              <div className="article-author-signature">
                <Sparkles size={16} style={{ color: 'var(--gold)' }} />
                <span>
                  Ditulis dan dikurasi oleh <strong>{post.author}</strong> untuk komunitas catur Politeknik Sorowako.
                </span>
              </div>
              <Link href="/blog" className="btn-glass-secondary">
                <ArrowLeft size={15} />
                <span>Lihat Semua Artikel</span>
              </Link>
            </div>

            {/* Related Articles Section */}
            {relatedPosts.length > 0 && (
              <section className="article-related-section">
                <h3 className="related-section-title">
                  <BookOpen size={18} style={{ color: 'var(--sky)' }} />
                  <span>Artikel Catur Fundamental Lainnya</span>
                </h3>
                <div className="related-cards-grid">
                  {relatedPosts.map((rel, idx) => {
                    const tone =
                      rel.coverTone || COVER_TONES[idx % COVER_TONES.length] || 'is-blue';
                    return (
                      <Link
                        key={rel.slug}
                        href={`/blog/${rel.slug}`}
                        className="related-post-card"
                      >
                        <div className={`related-card-bar ${tone}`} />
                        <div className="related-card-body">
                          <span className="related-card-tag">{rel.tag}</span>
                          <h4 className="related-card-title">{rel.title}</h4>
                          <span className="related-card-action">
                            Baca <ArrowRight size={12} />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </article>
        )}

        {/* Footer */}
        <footer className="site-footer">
          <span className="footer-title">CHESS POLITEKNIK SOROWAKO</span>
          <span className="footer-credit">devbyreza</span>
        </footer>
      </div>
    </main>
  );
}

