Mekanisme Elo Rating mengukur kekuatan relatif pemain berdasarkan hasil pertandingan.

## Rumus

Expected score pemain A terhadap pemain B:

E_A = 1 / (1 + 10^((R_B - R_A) / 400))

Perubahan rating:

Delta R_A = K_A x (S_A - E_A)
R_A baru = R_A awal + Delta R_A

Keterangan:

- R_A dan R_B adalah rating sebelum pertandingan.
- S adalah skor aktual: menang = 1, remis = 0,5, kalah = 0.
- E adalah skor harapan berdasarkan selisih rating.
- K mengatur besar perubahan rating. Nilainya dipilih untuk tiap pemain.

## K-factor dinamis

Dashboard memilih K berdasarkan rating dan jumlah laga berating pemain sebelum laga:

- K = 40 jika pemain belum mencapai 30 laga berating.
- K = 20 jika pemain sudah mencapai 30 laga dan ratingnya di bawah 2400.
- K = 10 jika pemain sudah mencapai 30 laga dan ratingnya 2400 atau lebih.

Laga berating yang sudah selesai di turnamen aktif dihitung otomatis untuk pemilihan K di laga berikutnya. Jumlah laga dari turnamen terdahulu diisi pada kolom **Laga berating sebelumnya** di profil peserta. Untuk pemain baru, isi 0.

Hasil Elo tiap laga dibulatkan ke bilangan bulat terdekat. Bye dan laga yang belum memiliki hasil tidak menambah jumlah laga berating.

## Contoh

Pemain A berating 1000 melawan pemain B berating 1400. Skor harapan A sekitar 0,09, sedangkan skor harapan B sekitar 0,91.

Jika keduanya memakai K = 40 dan A menang:

- A: 1000 + round(40 x (1 - 0,09)) = 1036 (naik 36).
- B: 1400 + round(40 x (0 - 0,91)) = 1364 (turun 36).

Jika K kedua pemain berbeda, perubahan rating dihitung dengan K masing-masing.

## Referensi

- [Chessigma Elo Calculator](https://www.chessigma.com/tools/elo-calculator)
- FIDE Rating Regulations dan FIDE Handbook – Rating System
- Arpad Elo Rating Formula
