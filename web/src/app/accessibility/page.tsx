'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function AccessibilityPage() {
  const { t, isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center text-brand-slate hover:text-ink transition-colors mb-10"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} />
          {t('common.back')}
        </Link>

        <h1 className="text-4xl font-bold text-ink mb-6">{t('a11y.title')}</h1>
        <p className="text-brand-slate leading-relaxed mb-10">{t('a11y.intro')}</p>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-ink mb-3">{t('a11y.standard_title')}</h2>
          <p className="text-brand-slate leading-relaxed">{t('a11y.standard_body')}</p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-ink mb-4">{t('a11y.measures_title')}</h2>
          <ul className="space-y-3">
            {(['measure_1', 'measure_2', 'measure_3', 'measure_4'] as const).map((key) => (
              <li key={key} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <span className="text-brand-slate">{t(`a11y.${key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-ink mb-3">{t('a11y.feedback_title')}</h2>
          <p className="text-brand-slate leading-relaxed mb-2">{t('a11y.feedback_body')}</p>
          <a
            href={`mailto:${t('a11y.contact_email')}`}
            className="text-blue-600 hover:underline font-medium"
          >
            {t('a11y.contact_email')}
          </a>
          <p className="text-sm text-brand-slate mt-4">{t('a11y.response_time')}</p>
        </section>
      </main>
    </div>
  );
}
