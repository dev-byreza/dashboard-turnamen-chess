import React from 'react';
import Link from 'next/link';
import { Sparkles, Newspaper, ArrowRight, Activity, Target, Zap, BookOpen } from 'lucide-react';
import type { BlogPost } from '../types/blog';
import { FUNDAMENTAL_CHESS_BLOG_POSTS } from '../lib/blogPostsSeed';

interface HomeHighlightsProps {
  /** Isi blok Turnamen (pakai <TournamentDirectory /> yang sudah ada). */
  tournamentSlot: React.ReactNode;
  posts: BlogPost[];
}

const COVER_TONES = ['is-gold', 'is-green', 'is-blue'] as const;

export function HomeHighlights({ tournamentSlot, posts }: HomeHighlightsProps) {
  const displayPosts = (posts && posts.length > 0) ? posts : FUNDAMENTAL_CHESS_BLOG_POSTS.slice(0, 3).map((p) => ({
    ...p,
    date: 'Terbaru',
  }));

  return (
    <section className="hh" aria-label="Sorotan Chess Club">
      {/* 1. Turnamen: satu section panjang */}
      <div className="hh-slot">{tournamentSlot}</div>

      {/* 2. Analisis: Game Review Cerdas Stockfish 19 */}
      <article className="hh-card hh-card--analisis" aria-labelledby="hh-a">
        <header className="hh-head">
          <h2 id="hh-a" className="hh-title"><Sparkles size={17} /> Analisis Engine</h2>
          <Link href="/analisis" className="hh-more">Buka analisis catur &rarr;</Link>
        </header>

        <div className="hh-wide-grid">
          {/* Sisi Kiri: Visual Grafik Evaluasi Modern ala Chess.com */}
          <div className="hh-review" aria-hidden="true">
            {/* Header Mini Status Engine */}
            <div className="hh-chart-header">
              <div className="hh-chart-meta">
                <span className="hh-engine-pill">
                  <span className="hh-live-dot" />
                  STOCKFISH 19
                </span>
                <span className="hh-depth-tag">Kedalaman 18 • Game Review</span>
              </div>
              <div className="hh-eval-badge">
                <span className="hh-eval-val">+3.6</span>
                <span className="hh-eval-sub">Putih Unggul</span>
              </div>
            </div>

            {/* SVG Grafik Evaluasi Dinamis & Halus */}
            <svg viewBox="0 0 460 175" className="hh-spark" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="glowLine" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#81b64c" floodOpacity="0.4" />
                </filter>
                <filter id="glowCyan" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glowRed" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <linearGradient id="posEvalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#81b64c" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#81b64c" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#81b64c" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="negEvalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fa412d" stopOpacity="0.0" />
                  <stop offset="40%" stopColor="#fa412d" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#fa412d" stopOpacity="0.4" />
                </linearGradient>

                <linearGradient id="evalStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#81b64c" />
                  <stop offset="35%" stopColor="#81b64c" />
                  <stop offset="44%" stopColor="#fa412d" />
                  <stop offset="56%" stopColor="#fa412d" />
                  <stop offset="64%" stopColor="#5c8bb0" />
                  <stop offset="74%" stopColor="#00b5e2" />
                  <stop offset="100%" stopColor="#81b64c" />
                </linearGradient>
              </defs>

              {/* Background Grid Box */}
              <rect x="28" y="16" width="414" height="136" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" />

              {/* Garis Bantu Evaluasi Horizontal */}
              <line x1="28" y1="46" x2="442" y2="46" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" strokeWidth="1" />
              <text x="22" y="49" fill="#81b64c" fontSize="8.5" fontFamily="monospace" fontWeight="700" textAnchor="end">+3.0</text>

              <line x1="28" y1="84" x2="442" y2="84" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" strokeWidth="1.2" />
              <text x="22" y="87" fill="rgba(255,255,255,0.5)" fontSize="8.5" fontFamily="monospace" fontWeight="700" textAnchor="end">0.0</text>

              <line x1="28" y1="122" x2="442" y2="122" stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" strokeWidth="1" />
              <text x="22" y="125" fill="#fa412d" fontSize="8.5" fontFamily="monospace" fontWeight="700" textAnchor="end">-3.0</text>

              {/* Penanda Nomor Langkah Vertikal */}
              <line x1="32" y1="148" x2="32" y2="152" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <text x="32" y="163" fill="rgba(255,255,255,0.4)" fontSize="8.5" fontFamily="monospace" textAnchor="middle">L1</text>

              <line x1="130" y1="148" x2="130" y2="152" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <text x="130" y="163" fill="rgba(255,255,255,0.4)" fontSize="8.5" fontFamily="monospace" textAnchor="middle">L10</text>

              <line x1="228" y1="148" x2="228" y2="152" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <text x="228" y="163" fill="rgba(255,255,255,0.4)" fontSize="8.5" fontFamily="monospace" textAnchor="middle">L20</text>

              <line x1="326" y1="148" x2="326" y2="152" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <text x="326" y="163" fill="rgba(255,255,255,0.4)" fontSize="8.5" fontFamily="monospace" textAnchor="middle">L30</text>

              <line x1="424" y1="148" x2="424" y2="152" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
              <text x="424" y="163" fill="rgba(255,255,255,0.4)" fontSize="8.5" fontFamily="monospace" textAnchor="middle">L40</text>

              {/* Area Shading Halus */}
              <path
                d="M 32,84 L 32,81 C 55,79 70,76 85,75 C 110,74 120,65 138,64 C 154,63 162,71 172,84 Z"
                fill="url(#posEvalGrad)"
              />
              <path
                d="M 172,84 C 182,96 188,118 198,118 C 210,118 222,114 236,112 C 252,110 264,98 276,84 Z"
                fill="url(#negEvalGrad)"
              />
              <path
                d="M 276,84 C 290,72 312,48 332,36 C 352,24 368,26 385,25 C 405,24 420,20 438,18 L 438,84 Z"
                fill="url(#posEvalGrad)"
              />

              {/* Kurva Evaluasi Bézier Halus */}
              <path
                d="M 32,81 C 55,79 70,76 85,75 C 110,74 120,65 138,64 C 154,63 162,71 172,84 C 182,96 188,118 198,118 C 210,118 222,114 236,112 C 252,110 264,98 276,84 C 290,72 312,48 332,36 C 352,24 368,26 385,25 C 405,24 420,20 438,18"
                fill="none"
                stroke="url(#evalStrokeGrad)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glowLine)"
              />

              {/* Titik Klasifikasi Langkah Kunci */}
              {/* Langkah Terbaik Pembukaan */}
              <circle cx="138" cy="64" r="3.5" fill="#81b64c" />

              {/* Blunder (Langkah 18) */}
              <circle cx="198" cy="118" r="10" fill="none" stroke="#fa412d" strokeWidth="1.2" opacity="0.3" className="chart-pulse-blunder" />
              <circle cx="198" cy="118" r="5" fill="#fa412d" filter="url(#glowRed)" />
              <g transform="translate(173, 128)">
                <rect width="50" height="17" rx="8.5" fill="#1b1113" stroke="#fa412d" strokeWidth="1" />
                <text x="25" y="11.5" fill="#fa412d" fontSize="8.5" fontFamily="sans-serif" fontWeight="800" textAnchor="middle">?? Blunder</text>
              </g>

              {/* Langkah Bagus (Langkah 26) */}
              <circle cx="276" cy="84" r="4.5" fill="#5c8bb0" />
              <g transform="translate(258, 60)">
                <rect width="36" height="17" rx="8.5" fill="#0f1722" stroke="#5c8bb0" strokeWidth="1" />
                <text x="18" y="11.5" fill="#7dd3fc" fontSize="8.5" fontFamily="sans-serif" fontWeight="800" textAnchor="middle">! Bagus</text>
              </g>

              {/* Langkah Brilian (Langkah 32) */}
              <circle cx="332" cy="36" r="14" fill="none" stroke="#00b5e2" strokeWidth="1.4" opacity="0.3" className="chart-pulse-brilliant" />
              <circle cx="332" cy="36" r="8.5" fill="none" stroke="#00b5e2" strokeWidth="1.5" opacity="0.6" />
              <circle cx="332" cy="36" r="5.5" fill="#00b5e2" filter="url(#glowCyan)" />
              <g transform="translate(302, 10)">
                <rect width="60" height="18" rx="9" fill="#071b26" stroke="#00b5e2" strokeWidth="1.2" />
                <text x="30" y="12" fill="#38bdf8" fontSize="9" fontFamily="sans-serif" fontWeight="800" textAnchor="middle">!! Brilian</text>
              </g>

              {/* Titik Akhir Skakmat/Unggul Telak */}
              <circle cx="438" cy="18" r="4.5" fill="#81b64c" />
            </svg>

            {/* Footer Bar Akurasi & Legenda */}
            <div className="hh-chart-footer">
              <div className="hh-acc-row">
                <div className="hh-acc-item is-white">
                  <span className="hh-acc-name">Putih</span>
                  <span className="hh-acc-val">89.2%</span>
                </div>
                <div className="hh-acc-bar-box">
                  <div className="hh-acc-bar-track">
                    <div className="hh-acc-bar-fill is-white" style={{ width: '54.5%' }} />
                    <div className="hh-acc-bar-fill is-black" style={{ width: '45.5%' }} />
                  </div>
                  <span className="hh-acc-center-label">Akurasi Langkah Game</span>
                </div>
                <div className="hh-acc-item is-black">
                  <span className="hh-acc-val">74.8%</span>
                  <span className="hh-acc-name">Hitam</span>
                </div>
              </div>

              <div className="hh-chart-legend">
                <span className="hh-leg-pill is-brilliant">
                  <span className="hh-leg-icon">!!</span> Brilian
                </span>
                <span className="hh-leg-pill is-great">
                  <span className="hh-leg-icon">!</span> Bagus
                </span>
                <span className="hh-leg-pill is-best">
                  <span className="hh-leg-icon">★</span> Terbaik
                </span>
                <span className="hh-leg-pill is-blunder">
                  <span className="hh-leg-icon">??</span> Blunder
                </span>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Penjelasan Fitur & Call to Action */}
          <div className="hh-wide-side">
            <div className="hh-side-header">
              <span className="hh-side-badge">
                <Activity size={12} /> Real-Time Engine
              </span>
              <h3 className="hh-side-title">Game Review Cerdas Stockfish 19</h3>
              <p className="hh-side-desc">
                Evaluasi mendalam setiap langkah pertandingan, temukan taktik tersembunyi, dan ukur akurasi performa pemain secara otomatis.
              </p>
            </div>

            <div className="hh-feature-grid">
              <div className="hh-feat-card">
                <div className="hh-feat-icon-box is-green">
                  <Target size={16} />
                </div>
                <div className="hh-feat-content">
                  <strong className="hh-feat-title">Akurasi & Game Rating</strong>
                  <span className="hh-feat-desc">Estimasi ELO performa dari pembukaan hingga babak akhir.</span>
                </div>
              </div>

              <div className="hh-feat-card">
                <div className="hh-feat-icon-box is-blue">
                  <Zap size={16} />
                </div>
                <div className="hh-feat-content">
                  <strong className="hh-feat-title">Klasifikasi Langkah</strong>
                  <span className="hh-feat-desc">Deteksi otomatis langkah Brilian (!!), Terbaik (★), dan Blunder fatal (??).</span>
                </div>
              </div>

              <div className="hh-feat-card">
                <div className="hh-feat-icon-box is-gold">
                  <BookOpen size={16} />
                </div>
                <div className="hh-feat-content">
                  <strong className="hh-feat-title">Eksplorasi Pembukaan</strong>
                  <span className="hh-feat-desc">Identifikasi otomatis kode ECO, nama variasi, dan teori langkah resmi.</span>
                </div>
              </div>
            </div>

            <div className="hh-action-row">
              <Link href="/analisis" className="btn-gold-action hh-cta-btn">
                <Sparkles size={15} />
                <span>Mulai Analisis Pertandingan</span>
                <ArrowRight size={14} />
              </Link>
              <span className="hh-cta-sub">Mendukung muat akun Chess.com & tempel notasi PGN</span>
            </div>
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

        {displayPosts.length === 0 ? (
          <p className="hh-empty">Belum ada tulisan.</p>
        ) : (
          <div className="hh-blog-grid">
            {displayPosts.slice(0, 3).map((p, i) => {
              const tone = p.coverTone || COVER_TONES[i % COVER_TONES.length];
              return (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="hh-post-card">
                  <div className={`hh-post-cover ${tone}`}>
                    <span className="hh-post-tag">{p.tag}</span>
                  </div>
                  <div className="hh-post-body">
                    <h3 className="hh-post-title">{p.title}</h3>
                    <p className="hh-post-excerpt">{p.excerpt}</p>
                    <div className="hh-post-foot">
                      <span className="hh-post-date">{p.date || 'Terbaru'}</span>
                      <span className="hh-post-read">Baca <ArrowRight size={13} /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
