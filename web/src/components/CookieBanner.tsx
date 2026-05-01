'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/src/context/LanguageContext';

const CONSENT_KEY = 'cookie_consent';

export default function CookieBanner() {
  const { t, isRTL } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    document.cookie = `${CONSENT_KEY}=accepted; path=/; max-age=31536000; SameSite=Lax`;
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed bottom-0 inset-x-0 z-50 p-4"
    >
      <div className="max-w-3xl mx-auto bg-ink text-white rounded-2xl shadow-2xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-white/80 flex-1 leading-relaxed">
          {t('cookie.message')}
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/privacy"
            className="text-xs text-white/60 hover:text-white transition-colors underline underline-offset-2"
          >
            {t('cookie.learn_more')}
          </Link>
          <button
            onClick={accept}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-white"
          >
            {t('cookie.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
