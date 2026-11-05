import type { BlogPost } from '../types/blog';
import { FUNDAMENTAL_CHESS_BLOG_POSTS } from '../lib/blogPostsSeed';

const BLOG_CACHE_KEY = 'CHESS_BLOG_PREVIEW_V2';
let inMemoryBlogPosts: BlogPost[] | null = null;

const DEFAULT_FALLBACK_POSTS: BlogPost[] = FUNDAMENTAL_CHESS_BLOG_POSTS.slice(0, 3).map((p) => ({
  ...p,
  date: 'Terbaru',
}));

/**
 * Retrieve cached blog posts synchronously from memory or web storage.
 * Ensures that the blog preview section is populated with valid articles
 * on the very first frame without delay or flickering.
 */
export function getCachedBlogPosts(): BlogPost[] {
  if (inMemoryBlogPosts && inMemoryBlogPosts.length > 0) {
    return inMemoryBlogPosts;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(BLOG_CACHE_KEY) || localStorage.getItem(BLOG_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryBlogPosts = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore parse error
    }
  }
  return DEFAULT_FALLBACK_POSTS;
}

/**
 * Persist blog posts into in-memory and web storage cache.
 */
export function setCachedBlogPosts(posts: BlogPost[]): void {
  if (!Array.isArray(posts) || posts.length === 0) return;
  inMemoryBlogPosts = posts;
  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(posts);
      sessionStorage.setItem(BLOG_CACHE_KEY, serialized);
      localStorage.setItem(BLOG_CACHE_KEY, serialized);
    } catch {
      // Ignore storage write error
    }
  }
}

/**
 * Compare two blog post lists to determine whether a re-render is strictly needed.
 */
export function areBlogPostsEqual(a: BlogPost[], b: BlogPost[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].slug !== b[i].slug ||
      a[i].title !== b[i].title ||
      (a[i].views || 0) !== (b[i].views || 0)
    ) {
      return false;
    }
  }
  return true;
}

