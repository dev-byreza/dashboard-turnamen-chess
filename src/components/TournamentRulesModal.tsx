'use client';

import React, { useState } from 'react';
import { X, BookOpen, Trophy, TrendingUp, Calculator, ShieldCheck, Swords, CheckCircle2 } from 'lucide-react';
import { calculateExpectedScore, calculateMatchEloChange, getKFactor } from '../utils/eloRating';

interface TournamentRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TournamentRulesModal: React.FC<TournamentRulesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'swiss' | 'elo'>('swiss');

  // Simulator state
  const [simRatingA, setSimRatingA] = useState<number>(520);
  const [simRatingB, setSimRatingB] = useState<number>(480);
  const [simRatedGamesA, setSimRatedGamesA] = useState<number>(0);
  const [simRatedGamesB, setSimRatedGamesB] = useState<number>(0);

  if (!isOpen) return null;

  const expectedA = calculateExpectedScore(simRatingA, simRatingB);
  const kFactorA = getKFactor(simRatingA, simRatedGamesA);
  const kFactorB = getKFactor(simRatingB, simRatedGamesB);
  const winA = calculateMatchEloChange(simRatingA, simRatingB, 1, kFactorA, kFactorB);
  const drawA = calculateMatchEloChange(simRatingA, simRatingB, 0.5, kFactorA, kFactorB);
  const lossA = calculateMatchEloChange(simRatingA, simRatingB, 0, kFactorA, kFactorB);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box rules-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-title-icon" style={{ background: 'rgba(224, 168, 46, 0.15)', color: 'var(--gold)' }}>
              <BookOpen size={18} />
            </span>
            <div>
              <div style={{ fontFamily: 'var(--font-coinage)', fontSize: '1.05rem', letterSpacing: '0.04em' }}>
                REGULASI & MEKANISME TURNAMEN
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Chess Club Politeknik Sorowako • Standar Resmi FIDE
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Modal Tab Switcher */}
        <div className="rules-tabs-bar">
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'swiss' ? 'active' : ''}`}
            onClick={() => setActiveTab('swiss')}
          >
            <Trophy size={15} />
            <span>1. Mekanisme Penilaian Swiss</span>
          </button>
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'elo' ? 'active' : ''}`}
            onClick={() => setActiveTab('elo')}
          >
            <TrendingUp size={15} />
            <span>2. Formula Perhitungan Elo (K dinamis)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '1.25rem 1.5rem', lineHeight: 1.6 }}>
          {activeTab === 'swiss' ? (
            <div className="rules-content-stack">
              {/* Introduction */}
              <div className="rules-intro-card">
                <p>
                  <strong>Swiss System</strong> adalah metode pertandingan catur resmi FIDE yang
                  digunakan untuk turnamen dengan banyak peserta tanpa sistem gugur. Setiap pemain
                  tetap bermain hingga ronde terakhir, sementara lawan ditentukan berdasarkan
                  jumlah poin yang sama atau mendekati sama.
                </p>
              </div>

              {/* Section 1: Sistem Poin Dasar */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">1</span> Sistem Poin Dasar
                </h4>
                <p className="rules-desc-p">Penilaian pertandingan menggunakan poin standar catur:</p>
                <div className="points-rules-grid">
                  <div className="point-card win">
                    <div className="point-title">Menang</div>
                    <div className="point-val">+1,0 Poin</div>
                    <div className="point-sub">Kemenangan resmi di atas papan</div>
                  </div>
                  <div className="point-card draw">
                    <div className="point-title">Remis / Seri</div>
                    <div className="point-val">+0,5 Poin</div>
                    <div className="point-sub">Hasil imbang (kesepakatan / pat)</div>
                  </div>
                  <div className="point-card loss">
                    <div className="point-title">Kalah</div>
                    <div className="point-val">0 Poin</div>
                    <div className="point-sub">Kekalahan skakmat / menyerah</div>
                  </div>
                  <div className="point-card bye">
                    <div className="point-title">BYE (Libur)</div>
                    <div className="point-val">+1,0 Poin</div>
                    <div className="point-sub">Peserta ganjil tanpa lawan</div>
                  </div>
                </div>

                <div className="rules-example-box">
                  <strong>Contoh Perhitungan:</strong>
                  <div>Pemain A memperoleh: Menang 3 kali, Remis 1 kali, Kalah 1 kali.</div>
                  <div className="formula-highlight">
                    Total Poin = (3 × 1,0) + (1 × 0,5) + (1 × 0) = <strong>3,5 Poin</strong>
                  </div>
                </div>
              </div>

              {/* Section 2: Penentuan Pairing */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">2</span> Penentuan Pairing (Pemasangan Lawan)
                </h4>
                <p className="rules-desc-p">
                  Pada ronde pertama, peserta diurutkan berdasarkan rating Elo atau seed. Ronde
                  berikutnya mempertemukan pemain dengan poin serupa.
                </p>
                <ul className="rules-bullet-list">
                  <li>
                    <CheckCircle2 size={14} className="bullet-icon" />
                    <strong>Kompetisi Seimbang:</strong> Pemain dengan poin tinggi bertemu pemain
                    berpoin tinggi.
                  </li>
                  <li>
                    <CheckCircle2 size={14} className="bullet-icon" />
                    <strong>Menghindari Lawan Berulang:</strong> Dua pemain tidak boleh bertanding dua
                    kali dalam satu turnamen.
                  </li>
                  <li>
                    <CheckCircle2 size={14} className="bullet-icon" />
                    <strong>Keseimbangan Warna:</strong> Sistem bergantian mengatur warna bidak Putih
                    dan Hitam secara adil.
                  </li>
                </ul>
              </div>

              {/* Section 3: Tie-Break */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">3</span> Sistem Tie-Break (Penentu Peringkat Seri)
                </h4>
                <p className="rules-desc-p">
                  Jika dua atau lebih pemain memiliki poin akhir yang sama, pemeringkatan ditentukan
                  berdasarkan kriteria tie-break bertingkat:
                </p>

                <div className="tiebreak-grid">
                  <div className="tiebreak-card">
                    <div className="tb-badge">Tie-Break 1</div>
                    <div className="tb-title">Buchholz (BH)</div>
                    <div className="tb-desc">
                      Menghitung <strong>total poin seluruh lawan</strong> yang pernah dihadapi. Semakin kuat
                      lawan yang dihadapi, semakin tinggi nilai Buchholz.
                    </div>
                    <div className="tb-example">
                      Contoh lawan berpoin 4, 3, 5, 2:
                      <br />
                      <strong>BH = 4 + 3 + 5 + 2 = 14</strong>
                    </div>
                  </div>

                  <div className="tiebreak-card">
                    <div className="tb-badge">Tie-Break 2</div>
                    <div className="tb-title">Sonneborn-Berger (SB)</div>
                    <div className="tb-desc">
                      Menghitung <strong>kualitas kemenangan dan remis</strong>: 100% poin dari lawan yang
                      dikalahkan + 50% poin dari lawan yang ditahan remis.
                    </div>
                    <div className="tb-example">
                      Contoh Menang lawan 4 poin & Remis lawan 3 poin:
                      <br />
                      <strong>SB = 4 + (3 ÷ 2) = 5,5</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Urutan Peringkat */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">4</span> Hirarki Pemeringkatan Klasemen
                </h4>
                <div className="hierarchy-steps">
                  <span className="step-pill">1. Total Poin</span>
                  <span className="step-arrow">→</span>
                  <span className="step-pill">2. Buchholz (BH)</span>
                  <span className="step-arrow">→</span>
                  <span className="step-pill">3. Sonneborn-Berger (SB)</span>
                  <span className="step-arrow">→</span>
                  <span className="step-pill">4. Jumlah Kemenangan</span>
                  <span className="step-arrow">→</span>
                  <span className="step-pill">5. Rating Elo / Seed</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rules-content-stack">
              {/* Introduction */}
              <div className="rules-intro-card">
                <p>
                  <strong>Mekanisme Perhitungan Elo Rating FIDE</strong> digunakan untuk mengukur
                  kekuatan relatif pemain catur berdasarkan hasil pertandingan resmi. Sistem ini
                  dikembangkan oleh Dr. Arpad Elo dan digunakan secara global oleh FIDE.
                </p>
              </div>

              {/* Section 1: Rumus Dasar Elo */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">1</span> Rumus Dasar FIDE Elo
                </h4>
                <div className="math-display-card">
                  <div className="math-title">Formula Utama:</div>
                  <div className="math-formula">R’ = R + K × (S − E)</div>
                  <div className="math-legend-grid">
                    <div><strong>R</strong> = Rating awal pemain</div>
                    <div><strong>R’</strong> = Rating baru setelah pertandingan</div>
                    <div><strong>S</strong> = Skor hasil laga (Menang = 1, Remis = 0,5, Kalah = 0)</div>
                    <div><strong>E</strong> = Expected score (peluang kemenangan teoritis)</div>
                    <div><strong>K</strong> = Faktor perkembangan Elo yang dipilih sesuai rating dan jumlah laga berating</div>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.55rem' }}>
                    K-Factor dinamis klub: Rookie (&lt; 600 Elo) K = 32, Level 1 / L1 (600–799 Elo) K = 24, Level 2 / L2 (800–999 Elo) K = 16, dan Level 3 / L3 (&ge; 1000 Elo) K = 10.
                  </div>
                </div>

                <div className="math-display-card" style={{ marginTop: '0.75rem' }}>
                  <div className="math-title">Formula Peluang Teoritis (Expected Score):</div>
                  <div className="math-formula">E = 1 / (1 + 10^((R_lawan − R) / 400))</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Jika kedua pemain memiliki rating yang sama, nilai E = 0,5 (peluang seimbang 50%).
                  </div>
                </div>
              </div>

              {/* Section 2: Contoh Resmi dari Regulasi */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">2</span> Contoh Resmi Skenario Pertandingan
                </h4>
                <div className="rules-example-box">
                  <p>
                    <strong>Pemain A (Rating 1000)</strong> melawan <strong>Pemain B (Rating 1400)</strong>:
                  </p>
                  <p>Selisih rating = 400 poin. Secara teori pemain 1400 jauh lebih diunggulkan. Contoh ini memakai K = 40 untuk pemain dengan kurang dari 30 laga berating.</p>
                  <div className="formula-highlight">
                    Expected score pemain 1000: E = 1 / (1 + 10^((1400 − 1000) / 400)) ≈ <strong>0,09</strong>
                  </div>

                  <div className="scenario-comparison-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    <div className="scenario-col win">
                      <div className="sc-badge">Skenario 1: Pemain 1000 Menang (1 - 0)</div>
                      <div className="sc-calc">
                        • <strong>Pemain 1000</strong>: E ≈ 0,09 → R’ = 1000 + 40 × (1 − 0,09) = <strong>1036</strong> <span className="sc-tag gain">+36</span>
                      </div>
                      <div className="sc-calc" style={{ marginTop: '0.4rem' }}>
                        • <strong>Pemain 1400</strong>: E ≈ 0,91 → R’ = 1400 + 40 × (0 − 0,91) = <strong>1364</strong> <span className="sc-tag loss">−36</span>
                      </div>
                      <div className="sc-note" style={{ marginTop: '0.5rem' }}>
                        Upset besar: Pemain 1000 dihadiahi +36 poin, sedangkan pemain 1400 dijatuhi penalti −36 poin karena kalah dari lawan yang jauh di bawahnya.
                      </div>
                    </div>

                    <div className="scenario-col loss">
                      <div className="sc-badge">Skenario 2: Pemain 1400 Menang (0 - 1)</div>
                      <div className="sc-calc">
                        • <strong>Pemain 1400</strong>: E ≈ 0,91 → R’ = 1400 + 40 × (1 − 0,91) = <strong>1404</strong> <span className="sc-tag gain">+4</span>
                      </div>
                      <div className="sc-calc" style={{ marginTop: '0.4rem' }}>
                        • <strong>Pemain 1000</strong>: E ≈ 0,09 → R’ = 1000 + 40 × (0 − 0,09) = <strong>996</strong> <span className="sc-tag loss">−4</span>
                      </div>
                      <div className="sc-note" style={{ marginTop: '0.5rem' }}>
                        Hasil wajar: Pemain 1400 hanya bertambah +4 poin, dan pemain 1000 hanya berkurang −4 poin karena kalah dari lawan yang jauh lebih kuat.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Simulator Interaktif Elo */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <span className="rules-num">
                    <Calculator size={14} />
                  </span>
                  Simulator Interaktif Elo Rating (K dinamis)
                </h4>
                <p className="rules-desc-p">
                  Masukkan rating dan jumlah laga sebelumnya. Setiap skenario menampilkan perubahan Elo Pemain A dan Pemain B; papan pertandingan hanya menampilkan perubahan untuk hasil yang sudah dicatat.
                </p>

                <div className="sim-inputs-row">
                  <div className="sim-input-col">
                    <label className="sim-label">Rating Pemain A (R)</label>
                    <input
                      type="number"
                      value={simRatingA}
                      onChange={(e) => setSimRatingA(Number(e.target.value) || 0)}
                      className="form-input-text"
                    />
                  </div>
                  <div className="sim-vs-circle">VS</div>
                  <div className="sim-input-col">
                    <label className="sim-label">Rating Pemain B (R_lawan)</label>
                    <input
                      type="number"
                      value={simRatingB}
                      onChange={(e) => setSimRatingB(Number(e.target.value) || 0)}
                      className="form-input-text"
                    />
                  </div>
                </div>

                <div className="sim-inputs-row" style={{ marginTop: '0.65rem' }}>
                  <div className="sim-input-col">
                    <label className="sim-label">Laga berating sebelumnya A (K={kFactorA})</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={simRatedGamesA}
                      onChange={(e) => setSimRatedGamesA(Math.max(0, Number(e.target.value) || 0))}
                      className="form-input-text"
                    />
                  </div>
                  <div className="sim-input-col">
                    <label className="sim-label">Laga berating sebelumnya B (K={kFactorB})</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={simRatedGamesB}
                      onChange={(e) => setSimRatedGamesB(Math.max(0, Number(e.target.value) || 0))}
                      className="form-input-text"
                    />
                  </div>
                </div>

                <div className="sim-expected-bar">
                  Peluang Teoritis Pemain A: <strong>{(expectedA * 100).toFixed(1)}%</strong> (E = {expectedA.toFixed(3)})
                </div>

                <div className="sim-outcomes-grid">
                  <div className="sim-outcome-card win">
                    <div className="sim-outcome-title">Pemain A Menang</div>
                    <div className="sim-outcome-val">
                      {simRatingA + winA.deltaA}
                      <span className="sc-tag gain">+{winA.deltaA}</span>
                    </div>
                    <div className="sim-outcome-opp">Pemain B: {simRatingB + winA.deltaB} ({winA.deltaB})</div>
                  </div>

                  <div className="sim-outcome-card draw">
                    <div className="sim-outcome-title">Pertandingan Remis</div>
                    <div className="sim-outcome-val">
                      {simRatingA + drawA.deltaA}
                      <span className={`sc-tag ${drawA.deltaA >= 0 ? 'gain' : 'loss'}`}>
                        {drawA.deltaA >= 0 ? `+${drawA.deltaA}` : drawA.deltaA}
                      </span>
                    </div>
                    <div className="sim-outcome-opp">Pemain B: {simRatingB + drawA.deltaB} ({drawA.deltaB >= 0 ? `+${drawA.deltaB}` : drawA.deltaB})</div>
                  </div>

                  <div className="sim-outcome-card loss">
                    <div className="sim-outcome-title">Pemain A Kalah</div>
                    <div className="sim-outcome-val">
                      {simRatingA + lossA.deltaA}
                      <span className="sc-tag loss">{lossA.deltaA}</span>
                    </div>
                    <div className="sim-outcome-opp">Pemain B: {simRatingB + lossA.deltaB} ({lossA.deltaB >= 0 ? `+${lossA.deltaB}` : lossA.deltaB})</div>
                  </div>
                </div>
              </div>

              {/* Section 4: Referensi */}
              <div className="rules-section-block">
                <h4 className="rules-heading">
                  <ShieldCheck size={16} style={{ color: 'var(--sky)' }} />
                  Referensi Resmi
                </h4>
                <div className="ref-pills-row">
                  <span className="ref-pill">• FIDE Rating Regulations</span>
                  <span className="ref-pill">• FIDE Handbook – Rating System</span>
                  <span className="ref-pill">• Arpad Elo Rating Formula</span>
                  <span className="ref-pill">• Swiss-System Tournament Rules</span>
                  <a className="ref-pill" href="https://www.chessigma.com/tools/elo-calculator" target="_blank" rel="noreferrer">• Kalkulator Elo Chessigma</a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Chess Club Politeknik Sorowako • FIDE Swiss & Elo K dinamis
          </span>
          <button type="button" onClick={onClose} className="btn-glass-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
