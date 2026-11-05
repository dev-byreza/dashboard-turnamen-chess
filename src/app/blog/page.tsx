'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  BookOpen,
  Sparkles,
  Calendar,
  Clock,
  Eye,
  ArrowRight,
  Filter,
} from 'lucide-react';
import type { BlogPost } from '../../types/blog';
import { FUNDAMENTAL_CHESS_BLOG_POSTS } from '../../lib/blogPostsSeed';
import { formatBlogDate } from '../../lib/db';

const CATEGORY_TABS = [
  'Semua',
  'Pembukaan',
  'Taktik',
  'Babak Akhir',
  'Strategi',
  'Aturan FIDE',
  'Sistem Swiss',
];

const COVER_TONES = ['is-gold', 'is-green', 'is-blue'] as const;

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>(() =>
    FUNDAMENTAL_CHESS_BLOG_POSTS.map((p) => ({
      ...p,
      date: formatBlogDate(p.publishedAt),
    }))
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/blog')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Gagal memuat artikel blog.');
        }
        return data.posts as BlogPost[];
      })
      .then((data) => {
        if (cancelled) return;
        setPosts(data || []);
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
  }, []);

  // Filter posts based on category and search query
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchCategory =
        selectedCategory === 'Semua' ||
        post.tag?.toLowerCase() === selectedCategory.toLowerCase() ||
        post.category?.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.tag.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [posts, selectedCategory, searchQuery]);

  return (
    <main className="blog-page-root">
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
              <p className="brand-subtitle">Blog Resmi & Panduan Catur Fundamental</p>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Link href="/analisis" className="btn-glass-secondary">
              <Sparkles size={15} style={{ color: 'var(--gold)' }} />
              <span>Analisis</span>
            </Link>
            <Link href="/" className="btn-glass-secondary">
              <ArrowLeft size={15} />
              <span>Dashboard Turnamen</span>
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section className="blog-hero-section">
          <div className="blog-hero-badge">
            <BookOpen size={14} />
            <span>Mastery & Knowledge Base</span>
          </div>
          <h1 className="blog-hero-title">Blog & Panduan Catur Fundamental</h1>
          <p className="blog-hero-desc">
            Kumpulan artikel esensial, strategi babak pembukaan, taktik mematikan, prinsip babak
            akhir, serta regulasi resmi FIDE untuk mengasah pemahaman catur Anda ke tingkat master.
          </p>

          {/* Search bar */}
          <div className="blog-search-wrapper">
            <Search size={18} className="blog-search-icon" />
            <input
              type="text"
              placeholder="Cari artikel... (contoh: Pembukaan, Garpu, Oposisi, FIDE)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="blog-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="blog-search-clear"
                aria-label="Bersihkan pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="blog-filter-pills">
            <span className="blog-filter-label">
              <Filter size={13} />
              <span>Kategori:</span>
            </span>
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`blog-filter-pill ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Blog Post Grid */}
        <section className="blog-content-section">
          {loading ? (
            <div className="blog-skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="blog-skeleton-card">
                  <div className="skeleton-cover" />
                  <div className="skeleton-body">
                    <div className="skeleton-line is-title" />
                    <div className="skeleton-line is-excerpt" />
                    <div className="skeleton-line is-excerpt short" />
                    <div className="skeleton-line is-foot" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="empty-state" role="alert" style={{ margin: '3rem auto' }}>
              <BookOpen size={42} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
              <h2 className="empty-title">Gagal Memuat Blog</h2>
              <p className="empty-desc">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-gold-action"
                style={{ marginTop: '1rem' }}
              >
                Muat Ulang
              </button>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="empty-state" style={{ margin: '3rem auto' }}>
              <BookOpen size={42} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
              <h2 className="empty-title">Tidak Ada Artikel yang Cocok</h2>
              <p className="empty-desc">
                Tidak ditemukan artikel dengan kata kunci &quot;{searchQuery}&quot; pada kategori &quot;{selectedCategory}&quot;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                }}
                className="btn-glass-secondary"
                style={{ marginTop: '1rem' }}
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="blog-cards-grid">
              {filteredPosts.map((post, idx) => {
                const tone =
                  post.coverTone || COVER_TONES[idx % COVER_TONES.length] || 'is-gold';
                return (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="blog-main-card"
                    prefetch={true}
                  >
                    <div className={`blog-card-cover ${tone}`}>
                      <span className="blog-card-tag">{post.tag}</span>
                      <span className="blog-card-readtime">
                        <Clock size={11} /> {post.readTime || '5 menit baca'}
                      </span>
                    </div>

                    <div className="blog-card-body">
                      <h2 className="blog-card-title">{post.title}</h2>
                      <p className="blog-card-excerpt">{post.excerpt}</p>

                      <div className="blog-card-footer">
                        <div className="blog-card-meta">
                          <span className="blog-meta-item">
                            <Calendar size={12} /> {post.date || 'Terbaru'}
                          </span>
                          {post.views !== undefined && post.views > 0 && (
                            <span className="blog-meta-item">
                              <Eye size={12} /> {post.views} pembaca
                            </span>
                          )}
                        </div>
                        <span className="blog-card-read-action">
                          Baca Lengkap <ArrowRight size={13} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="site-footer">
          <span className="footer-title">CHESS POLITEKNIK SOROWAKO</span>
          <span className="footer-credit">devbyreza</span>
        </footer>
      </div>
    </main>
  );
}

