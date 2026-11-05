import type { BlogPost } from '../types/blog';
import { FUNDAMENTAL_CHESS_BLOG_POSTS } from '../lib/blogPostsSeed';

export type { BlogPost };

/**
 * Fallback preview artikel catur fundamental untuk beranda jika jaringan database tertunda.
 */
export const latestPosts: BlogPost[] = FUNDAMENTAL_CHESS_BLOG_POSTS.slice(0, 3).map((p) => ({
  ...p,
  date: 'Terbaru',
}));
