'use client';

import React from 'react';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import AdminSupportWorkspace from '@/src/components/support/AdminSupportWorkspace';

type AdminSupportPageClientProps = {
  initialTicketId?: string | null;
};

export default function AdminSupportPageClient({ initialTicketId = null }: AdminSupportPageClientProps) {
  const { t, isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ink">{t('admin.dashboard.tab.support')}</h1>
          <p className="text-brand-slate mt-2">{t('support.admin_page_description')}</p>
        </div>
        <AdminSupportWorkspace initialTicketId={initialTicketId} />
      </main>
    </div>
  );
}