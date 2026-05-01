'use client';

import React from 'react';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import SupportWorkspace from '@/src/components/support/SupportWorkspace';

type ConsultantSupportPageClientProps = {
  initialTicketId?: string | null;
};

export default function ConsultantSupportPageClient({ initialTicketId = null }: ConsultantSupportPageClientProps) {
  const { t, isRTL } = useLanguage();
  const { loading } = useRoleGuard(['consultant']);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ink">{t('support.title')}</h1>
          <p className="text-brand-slate mt-2">{t('support.page_description')}</p>
        </div>
        <SupportWorkspace role="consultant" initialTicketId={initialTicketId} />
      </main>
    </div>
  );
}
