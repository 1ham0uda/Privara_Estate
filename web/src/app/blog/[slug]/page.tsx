import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/src/components/Navbar';
import { getPostBySlug, getAllPosts } from '@/src/lib/blog';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Real Real Estate`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-cloud">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-xs text-brand-slate hover:text-ink transition-colors mb-10"
        >
          ← Market Insights
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4 text-xs text-brand-slate">
            <span>{new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {post.tag && (
              <>
                <span>·</span>
                <span className="uppercase tracking-widest font-mono text-blue-600">{post.tag}</span>
              </>
            )}
            {post.readingTime && (
              <>
                <span>·</span>
                <span>{post.readingTime} min read</span>
              </>
            )}
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink leading-tight mb-4">{post.title}</h1>
          {post.author && (
            <p className="text-sm text-brand-slate">
              By <span className="font-medium text-ink">{post.author}</span>
              {post.authorTitle && <span className="text-brand-slate">, {post.authorTitle}</span>}
            </p>
          )}
        </header>

        <article className="prose prose-stone max-w-none prose-headings:font-serif prose-headings:text-ink prose-a:text-blue-600 prose-strong:text-ink">
          <MDXRemote source={post.content} />
        </article>

        <footer className="mt-16 pt-8 border-t border-soft-blue">
          <p className="text-xs text-brand-slate italic">
            This article is published for general information purposes only. It does not constitute financial or legal advice. Real Real Estate consultants are independent and do not receive commissions from developers or agents.
          </p>
          <div className="mt-6">
            <Link
              href="/client/new-consultation"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Book a private consultation →
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
