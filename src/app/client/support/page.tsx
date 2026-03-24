'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { supportService } from '@/src/lib/db';
import { Card, Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import SupportMessages from './SupportMessages';

export default function ClientSupportPage() {
  const { t, isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-8">{t('support.title')}</h1>
        <SupportMessages />
      </main>
    </div>
  );
}
