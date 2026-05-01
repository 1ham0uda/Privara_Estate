import React from 'react';
import Link from 'next/link';
import Navbar from '@/src/components/Navbar';
import { getAllPosts } from '@/src/lib/blog';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Insights | Real Real Estate',
  description:
    'Expert analysis on Egyptian real estate — off-plan, resale, North Coast, and investment strategy from our verified consultants.',
};

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <div className="min-h-screen bg-cloud">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <header className="mb-14">
          <p className="text-xs font-mono text-blue-600 uppercase tracking-widest mb-3">Market Insights</p>
          <h1 className="font-serif text-4xl font-bold text-ink leading-tight">
            Real estate intelligence,<br />no agenda attached.
          </h1>
          <p className="text-brand-slate mt-4 text-lg max-w-xl">
            Research and commentary from our independent advisory team — published for buyers, investors, and anyone navigating the Egyptian market.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-brand-slate">No posts published yet.</p>
        ) : (
          <ul className="space-y-10">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-soft-blue bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
                >
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
                  <h2 className="font-serif text-2xl font-bold text-ink mb-3 group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-brand-slate leading-relaxed">{post.excerpt}</p>
                  {post.author && (
                    <p className="mt-4 text-xs text-brand-slate">
                      By <span className="font-medium text-ink">{post.author}</span>
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
