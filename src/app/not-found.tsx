'use client';

import Link from 'next/link';
import { Shield, Home } from 'lucide-react';
import { Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';

export default function NotFound() {
  const { t, isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-black rounded-2xl flex items-center justify-center mb-6">
        <Shield className="text-white w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-gray-500 mb-8 text-center max-w-md text-sm sm:text-base">
        {t('notFound.description')}
      </p>
      <Link href="/">
        <Button className="rounded-xl h-11 sm:h-12 px-6 sm:px-8">
          <Home className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('notFound.back_home')}
        </Button>
      </Link>
    </div>
  );
}
