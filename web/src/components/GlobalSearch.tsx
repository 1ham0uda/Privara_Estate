'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { globalSearchService, GlobalSearchResult } from '@/src/lib/db';
import { Search, X, Briefcase, Users, User } from 'lucide-react';
import { useLanguage } from '@/src/context/LanguageContext';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  case: <Briefcase className="w-4 h-4 text-blue-500" />,
  client: <Users className="w-4 h-4 text-emerald-500" />,
  staff: <User className="w-4 h-4 text-purple-500" />,
};

const TYPE_LABELS: Record<string, string> = {
  case: 'Case',
  client: 'Client',
  staff: 'Staff',
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const debouncedQuery = useDebounce(query, 280);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    globalSearchService.search(debouncedQuery).then((res) => {
      setResults(res);
      setActiveIndex(0);
      setLoading(false);
    });
  }, [debouncedQuery]);

  const navigate = useCallback(
    (result: GlobalSearchResult) => {
      router.push(result.href);
      onClose();
    },
    [router, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      navigate(results[activeIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 ${isRTL ? 'rtl' : 'ltr'}`}
            onKeyDown={handleKeyDown}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-soft-blue overflow-hidden mx-4">
              {/* Input row */}
              <div className={`flex items-center gap-3 px-4 py-3 border-b border-soft-blue ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Search className="w-5 h-5 text-brand-slate/50 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cases, clients, staff…"
                  className={`flex-1 bg-transparent text-ink placeholder-brand-slate/40 focus:outline-none text-sm ${isRTL ? 'text-right' : ''}`}
                />
                <div className="flex items-center gap-2 shrink-0">
                  {loading && (
                    <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  )}
                  <button onClick={onClose} className="p-1 text-brand-slate/50 hover:text-ink rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Results */}
              {results.length > 0 && (
                <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
                  {results.map((r, i) => (
                    <li key={`${r.type}-${r.id}`} role="option" aria-selected={i === activeIndex}>
                      <button
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => navigate(r)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === activeIndex ? 'bg-soft-blue' : 'hover:bg-cloud'} ${isRTL ? 'flex-row-reverse text-right' : ''}`}
                      >
                        <span className="shrink-0">{TYPE_ICONS[r.type]}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-ink truncate">{r.title}</span>
                          <span className="block text-xs text-brand-slate truncate">{r.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-brand-slate/50 bg-cloud px-1.5 py-0.5 rounded">
                          {TYPE_LABELS[r.type]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Empty state */}
              {!loading && debouncedQuery.trim() && results.length === 0 && (
                <div className="px-4 py-8 text-center text-brand-slate text-sm">
                  No results for &ldquo;{debouncedQuery}&rdquo;
                </div>
              )}

              {/* Hint row */}
              {results.length === 0 && !debouncedQuery.trim() && (
                <div className={`flex items-center gap-4 px-4 py-3 text-xs text-brand-slate/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span><kbd className="px-1.5 py-0.5 bg-cloud rounded font-mono text-[10px]">↑↓</kbd> navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-cloud rounded font-mono text-[10px]">↵</kbd> open</span>
                  <span><kbd className="px-1.5 py-0.5 bg-cloud rounded font-mono text-[10px]">Esc</kbd> close</span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
