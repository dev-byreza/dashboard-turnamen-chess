export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // contoh: '16 Oktober 2026'
  tag: string;
}

// Placeholder sementara. Nanti ganti dengan data dari database (tabel posts).
export const latestPosts: BlogPost[] = [
  {
    slug: 'rekap-rookie-tour-chess',
    title: 'Rekap Rookie Tour Chess: tiga babak penuh kejutan',
    excerpt: 'Empat peserta, tiga babak, dan satu juara yang baru ketahuan di partai terakhir.',
    date: '16 Oktober 2026',
    tag: 'Rekap',
  },
  {
    slug: 'membaca-sistem-swiss',
    title: 'Cara membaca sistem Swiss tanpa pusing',
    excerpt: 'Kenapa lawan Anda berbeda tiap babak, dan bagaimana poin dihitung.',
    date: '12 Oktober 2026',
    tag: 'Tips pemula',
  },
  {
    slug: 'partai-paling-menegangkan',
    title: 'Partai paling menegangkan di babak keempat',
    excerpt: 'Satu langkah menteri mengubah evaluasi dari seimbang menjadi menang.',
    date: '9 Oktober 2026',
    tag: 'Analisis partai',
  },
];
