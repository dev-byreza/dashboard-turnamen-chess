import type { BlogPost } from '../types/blog';

export type { BlogPost };

/**
 * Data blog kini dimuat secara dinamis dari database PostgreSQL (tabel chess_blog_posts).
 * Array ini dipertahankan sebagai fallback kosong.
 */
export const latestPosts: BlogPost[] = [];
