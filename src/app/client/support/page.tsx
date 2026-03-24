'use client';

import React from 'react';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import SupportWorkspace from '@/src/components/support/SupportWorkspace';

export default function ClientSupportPage() {
  const { t, isRTL } = useLanguage();
  const { loading } = useRoleGuard(['client']);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('support.title')}</h1>
          <p className="text-gray-500 mt-2">{t('support.page_description')}</p>
        </div>
        <SupportWorkspace role="client" />
      </main>
    </div>
  );
}
