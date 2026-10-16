Mekanisme Perhitungan Elo Rating FIDE digunakan untuk mengukur kekuatan pemain catur berdasarkan hasil pertandingan resmi. Sistem ini dikembangkan oleh Arpad Elo dan digunakan oleh FIDE sebagai standar rating internasional.

Rumus dasar Elo:

R’ = R + K(S − E)

Keterangan:
R = rating awal
R’ = rating baru
S = hasil pertandingan
E = expected score
K = faktor perkembangan

Contoh Perhitungan:
Pemain A memiliki rating 1000 melawan pemain B dengan rating 1400.

Selisih rating = 400 poin.
Secara teori, pemain 1400 jauh lebih diunggulkan.

Expected score pemain 1000:

E = 1 / (1 + 10^((1400−1000)/400))
E ≈ 0,09

Jika pemain 1000 menang:
Dengan K = 40

R’ = 1000 + 40(1 − 0,09)
R’ ≈ 1036

Rating naik sekitar +36 poin.

Sebaliknya jika kalah:
R’ = 1000 + 40(0 − 0,09)
R’ ≈ 996

Rating hanya turun sekitar −4 poin.

Artinya, mengalahkan lawan lebih kuat memberikan kenaikan Elo jauh lebih besar.

Referensi:
• FIDE Rating Regulations
• FIDE Handbook – Rating System
• Arpad Elo Rating Formula