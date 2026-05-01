'use client';

export type AnnouncePriority = 'polite' | 'assertive';

export function announce(message: string, priority: AnnouncePriority = 'polite') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('aria-announce', { detail: { message, priority } }));
}
