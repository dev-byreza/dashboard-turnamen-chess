export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tag: string;
  author: string;
  readTime: string;
  coverImage?: string;
  coverTone?: 'is-gold' | 'is-green' | 'is-blue' | 'is-purple' | 'is-crimson' | string;
  views?: number;
  isPublished?: boolean;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  date?: string; // compatibility with components expecting 'date'
}

export type BlogPostSummary = Omit<BlogPost, 'content'>;

