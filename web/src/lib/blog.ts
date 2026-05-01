import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'content', 'blog');

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  author?: string;
  authorTitle?: string;
  tag?: string;
  readingTime?: number;
}

export interface Post extends PostMeta {
  content: string;
}

function computeReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export async function getAllPosts(): Promise<PostMeta[]> {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));

  const posts = files.map((file): PostMeta => {
    const slug = file.replace(/\.(mdx|md)$/, '');
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      date: data.date ?? '2026-01-01',
      excerpt: data.excerpt ?? '',
      author: data.author,
      authorTitle: data.authorTitle,
      tag: data.tag,
      readingTime: computeReadingTime(content),
    };
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const extensions = ['.mdx', '.md'];

  for (const ext of extensions) {
    const filePath = path.join(POSTS_DIR, `${slug}${ext}`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      return {
        slug,
        title: data.title ?? slug,
        date: data.date ?? '2026-01-01',
        excerpt: data.excerpt ?? '',
        author: data.author,
        authorTitle: data.authorTitle,
        tag: data.tag,
        readingTime: computeReadingTime(content),
        content,
      };
    }
  }

  return null;
}
