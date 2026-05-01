'use client';

import { useEffect, useRef } from 'react';

export default function AriaAnnouncer() {
  const politeRef   = useRef<HTMLDivElement>(null);
  const assertiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, priority } = (e as CustomEvent).detail as { message: string; priority: 'polite' | 'assertive' };
      const el = priority === 'assertive' ? assertiveRef.current : politeRef.current;
      if (!el) return;
      el.textContent = '';
      requestAnimationFrame(() => { el.textContent = message; });
    };
    window.addEventListener('aria-announce', handler);
    return () => window.removeEventListener('aria-announce', handler);
  }, []);

  return (
    <>
      <div
        ref={politeRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        ref={assertiveRef}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
