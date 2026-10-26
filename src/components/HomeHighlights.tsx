import React from 'react';
import Link from 'next/link';
import { Sparkles, Newspaper, ArrowRight } from 'lucide-react';
import type { BlogPost } from '../data/posts';
import { LiveGamesList } from './LiveGamesList';

interface HomeHighlightsProps {
  /** Isi blok Turnamen (pakai <TournamentDirectory /> yang sudah ada). */
  tournamentSlot: React.ReactNode;
  posts: BlogPost[];
  /** Admin membuka papan live dengan hak admin (analisis engine penuh). */
  isAdmin?: boolean;
}

const COVER_TONES = ['is-gold', 'is-green', 'is-blue'] as const;

export function HomeHighlights({ tournamentSlot, posts, isAdmin = false }: HomeHighlightsProps) {
  return (
    <section className="hh" aria-label="Sorotan Chess Club">
      {/* 1. Turnamen: satu section panjang */}
      <div className="hh-slot">{tournamentSlot}</div>

      {/* 2. Analisis: di bawah turnamen */}
      <article className="hh-card hh-card--analisis" aria-labelledby="hh-a">
        <header className="hh-head">
          <h2 id="hh-a" className="hh-title"><Sparkles size={17} /> Analisis</h2>
          <Link href="/analisis" className="hh-more">Buka analisis</Link>
        </header>

        {/* Partai live: hanya tampil bila ada partai yang sedang berlangsung */}
        <LiveGamesList isAdmin={isAdmin} />

        <div className="hh-wide-grid">
          <div className="hh-review" aria-hidden="true">
            <svg viewBox="0 0 300 80" className="hh-spark">
              <rect width="300" height="40" fill="rgba(255,255,255,.08)" />
              <polyline
                points="0,34 20,33 40,31 60,32 80,29 100,30 120,28 140,52 160,54 180,58 200,60 220,62 240,66 260,68 280,70 300,72"
                fill="none" stroke="#81b64c" strokeWidth="2.5" strokeLinejoin="round"
              />
              <circle cx="140" cy="52" r="4.5" fill="#e5484d" />
              <circle cx="220" cy="62" r="4.5" fill="#81b64c" />
            </svg>
            <span className="hh-review-cap">Grafik evaluasi per langkah</span>
          </div>

          <div className="hh-wide-side">
            <p className="hh-sub hh-sub--flush">Game Review dengan Stockfish 19.</p>
            <ul className="hh-feature-list">
              <li><b>Akurasi</b> dan game rating tiap pemain</li>
              <li><b>Klasifikasi langkah</b>: Brilliant, Great, Best, Blunder</li>
              <li><b>Pembukaan</b> dikenali otomatis (kode ECO)</li>
            </ul>
            <p className="hh-note">Muat riwayat game lewat username Chess.com atau tempel PGN.</p>
            <Link href="/analisis" className="btn-gold-action hh-btn">Mulai analisis</Link>
          </div>
        </div>
      </article>

      {/* Baris bawah: Blog dalam bentuk blok-blok */}
      <section className="hh-panel hh-blog" aria-labelledby="hh-b">
        <div className="section-panel-header">
          <div className="section-title-wrap">
            <Newspaper size={18} style={{ color: 'var(--sky)' }} />
            <div>
              <h2 id="hh-b" className="section-title-text">Blog</h2>
              <p className="hh-sub hh-sub--flush">Cerita dan catatan dari klub.</p>
            </div>
          </div>
          <Link href="/blog" className="hh-more hh-more--sky">Baca semua</Link>
        </div>

        {posts.length === 0 ? (
          <p className="hh-empty">Belum ada tulisan.</p>
        ) : (
          <div className="hh-blog-grid">
            {posts.slice(0, 3).map((p, i) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="hh-post-card">
                <div className={`hh-post-cover ${COVER_TONES[i % COVER_TONES.length]}`}>
                  <span className="hh-post-tag">{p.tag}</span>
                </div>
                <div className="hh-post-body">
                  <h3 className="hh-post-title">{p.title}</h3>
                  <p className="hh-post-excerpt">{p.excerpt}</p>
                  <div className="hh-post-foot">
                    <span className="hh-post-date">{p.date}</span>
                    <span className="hh-post-read">Baca <ArrowRight size={13} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}