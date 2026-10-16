# ♟️ Dashboard Turnamen Catur Sistem Swiss — Chess Club Politeknik Sorowako

Aplikasi **Dashboard Turnamen Catur Sistem Swiss (FIDE Swiss System)** resmi untuk **Chess Club Politeknik Sorowako**. Dibangun dengan estetika **minimalis, modern, dan elegan** menggunakan **Next.js 15**, **React 19**, **TypeScript**, dan **Bespoke Vanilla CSS**.

---

## 🏛️ Identitas & Logo Resmi
* **Header Utama**: Menampilkan logo teks resmi (**CHESS CLUB POLITEKNIK SOROWAKO**) berformat tipografi atletik ganda (putih & emas) dengan lambang emblem roda gigi catur di sampingnya.
* **Organisasi**: Chess Club Politeknik Sorowako.
* **Format Turnamen**: FIDE Swiss Pairing System (5 Babak) dengan kalkulasi Tie-Break Buchholz (BH) dan Sonneborn-Berger (SB).

---

## 🌟 Fitur Utama
1. **Header & Logo Teks Resmi**:
   - Judul header menggunakan aset gambar logo teks asli (`logo-chess-club-text.png`) yang tajam dan presisi, berpadu dengan lencana emas *RESMI 2026*.
   - Tombol pengganti gaya font cepat, Jam Catur Digital, Mode Siaran TV, dan Reset.
2. **Hero Banner & Bilah Stepper Babak**:
   - Menampilkan lambang resmi, status FIDE Swiss Engine, dan jumlah pemain.
   - Navigasi babak (`BABAK 1` s/d `BABAK 5`) dengan indikator babak berjalan dan centang hijau (`✓`) untuk babak yang telah selesai.
3. **Kartu Meja Pertandingan (Match Board Cards)**:
   - Tata letak rapi 3 kolom: Bidak Putih (`♟`), Selektor Skor Cepat (`1 - 0`, `½ - ½`, `0 - 1`), dan Bidak Hitam (`♙`).
   - Lengkap dengan gelar FIDE (`FM, NM, CM`), jurusan/departemen mahasiswa Politeknik Sorowako, dan rating Elo.
4. **Papan Klasemen & Mini Podium 3 Besar**:
   - Podium Juara 1 👑, Juara 2 🥈, dan Juara 3 🥉 di atas klasemen.
   - Tabel klasemen lengkap dengan penghitungan Buchholz dan Poin Total.
5. **Pairing Otomatis Sekali Klik**:
   - Tombol **Pairing Babak Berikutnya** otomatis memasangkan peserta sesuai poin tanpa rematch, disertai pesta konfeti.
6. **Jam Catur Digital (Chess Clock)**:
   - Jam catur dual dengan pilihan tempo *Blitz (3+2, 5+3)* dan *Rapid (10+0, 15+10)*.

---

## 🚀 Cara Menjalankan

### Cara 1: Menggunakan Berkas Batch (Satu Klik)
Klik ganda berkas `jalankan-dashboard.bat`.

### Cara 2: Melalui Terminal
```bash
npm run dev
```
Buka di peramban: [http://localhost:3000](http://localhost:3000)
