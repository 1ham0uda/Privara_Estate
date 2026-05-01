'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { paginationService } from '@/src/lib/db';
import { ConsultantProfile, ConsultantAvailability } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { useLanguage } from '@/src/context/LanguageContext';
import Navbar from '@/src/components/Navbar';
import { Star, User, CheckCircle2, Search, ChevronDown, Wifi, WifiOff, Clock } from 'lucide-react';

const SPECIALTIES = [
  'Residential',
  'Commercial',
  'Investment',
  'Off-Plan',
  'Resale',
  'Luxury',
  'Land',
  'Industrial',
];

const RATING_OPTIONS = [4.5, 4.0, 3.5, 0];

function AvailabilityBadge({ availability }: { availability?: ConsultantAvailability }) {
  if (!availability || availability === 'available') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
        <Wifi className="w-3 h-3" /> Available
      </span>
    );
  }
  if (availability === 'busy') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
        <Clock className="w-3 h-3" /> Busy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
      <WifiOff className="w-3 h-3" /> Away
    </span>
  );
}

export default function ConsultantsDirectoryPage() {
  const { t, isRTL } = useLanguage();

  const [consultants, setConsultants] = useState<ConsultantProfile[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [minRating, setMinRating] = useState(0);

  const fetchPage = useCallback(
    async (cursor?: QueryDocumentSnapshot) => {
      const result = await paginationService.getConsultantsByFilter(
        specialty || undefined,
        minRating > 0 ? minRating : undefined,
        undefined,
        12,
        cursor
      );
      return result;
    },
    [specialty, minRating]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchPage(undefined);
      setConsultants(result.items);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPage(lastDoc);
      setConsultants((prev) => [...prev, ...result.items]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = search
    ? consultants.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.specialties ?? []).some((s) => s.toLowerCase().includes(search.toLowerCase())) ||
          (c.areas ?? []).some((a) => a.toLowerCase().includes(search.toLowerCase()))
      )
    : consultants;

  return (
    <div className="min-h-screen bg-cloud">
      <Navbar />

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-ink mb-3">{t('consultants.dir.title')}</h1>
          <p className="text-brand-slate text-lg max-w-2xl mx-auto">{t('consultants.dir.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className={`flex flex-col sm:flex-row gap-3 mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Search */}
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-brand-slate/50 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('consultants.dir.search_placeholder')}
              className={`w-full h-10 bg-white border border-soft-blue rounded-xl text-sm text-ink placeholder-brand-slate/50 focus:outline-none focus:ring-2 focus:ring-blue-200 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
            />
          </div>

          {/* Specialty filter */}
          <div className="relative">
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="appearance-none h-10 bg-white border border-soft-blue rounded-xl px-4 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer min-w-[160px]"
            >
              <option value="">{t('consultants.dir.filter.all_specialties')}</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-slate/50 pointer-events-none" />
          </div>

          {/* Min rating filter */}
          <div className="relative">
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="appearance-none h-10 bg-white border border-soft-blue rounded-xl px-4 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer min-w-[160px]"
            >
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? t('consultants.dir.filter.any_rating') : `${r}+ ${t('consultant.rating_text')}`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-slate/50 pointer-events-none" />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-soft-blue p-6 animate-pulse">
                <div className="w-16 h-16 bg-soft-blue rounded-2xl mb-4" />
                <div className="h-4 bg-soft-blue rounded w-3/4 mb-2" />
                <div className="h-3 bg-soft-blue rounded w-1/2 mb-4" />
                <div className="flex gap-2">
                  <div className="h-5 bg-soft-blue rounded-full w-16" />
                  <div className="h-5 bg-soft-blue rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-brand-slate">
            <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">{t('consultants.dir.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((c) => (
              <Link key={c.uid} href={`/consultants/${c.uid}`} className="block group">
                <Card className="h-full p-6 flex flex-col gap-4 group-hover:border-blue-200 transition-colors">
                  {/* Avatar */}
                  <div className="flex items-start justify-between">
                    <div className="w-16 h-16 bg-soft-blue rounded-2xl overflow-hidden relative flex-shrink-0">
                      {c.avatarUrl ? (
                        <Image src={c.avatarUrl} alt={c.name} fill className="object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-8 h-8 text-brand-slate/40" />
                        </div>
                      )}
                    </div>
                    <AvailabilityBadge availability={c.availability} />
                  </div>

                  {/* Name + exp */}
                  <div>
                    <h3 className="font-bold text-ink text-base leading-tight mb-1 group-hover:text-blue-700 transition-colors">{c.name}</h3>
                    <p className="text-xs text-brand-slate">{c.experienceYears} {t('consultant.years_exp_text')}</p>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {c.rating > 0 ? c.rating.toFixed(1) : '—'}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {c.completedConsultations}
                    </span>
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    {(c.specialties ?? []).slice(0, 3).map((s) => (
                      <Badge key={s} variant="info" className="text-[10px]">{s}</Badge>
                    ))}
                    {(c.specialties ?? []).length > 3 && (
                      <Badge variant="default" className="text-[10px]">+{c.specialties.length - 3}</Badge>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !search && (
          <div className="mt-10 text-center">
            <Button variant="outline" onClick={loadMore} loading={loadingMore}>
              {t('consultants.dir.load_more')}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
