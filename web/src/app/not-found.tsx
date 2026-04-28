'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';

export default function NotFound() {
  const { t, isRTL } = useLanguage();

  return (
    <div
      className="min-h-screen bg-cloud flex flex-col items-center justify-center p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* RR monogram — PDF §02 */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/20 select-none" aria-hidden="true">
        <span className="text-white font-serif font-bold text-2xl leading-none">RR</span>
      </div>

      <h1 className="font-serif text-5xl font-bold text-ink mb-3">404</h1>

      <p className="text-brand-slate mb-10 text-center max-w-sm text-sm sm:text-base leading-6">
        {t('notFound.description')}
      </p>

      <Link href="/">
        <Button className="rounded-full h-11 sm:h-12 px-8">
          <Home className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('notFound.back_home')}
        </Button>
      </Link>
    </div>
  );
}
