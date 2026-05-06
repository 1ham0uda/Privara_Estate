'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { settingsService } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { isRTL } = useLanguage();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    settingsService.getSettings()
      .then(s => setMaintenance(s?.maintenanceMode ?? false))
      .catch(() => setMaintenance(false));
  }, []);

  if (maintenance && profile?.role !== 'admin') {
    return (
      <div
        className="fixed inset-0 z-[9999] bg-ink flex flex-col items-center justify-center p-6 text-center"
        dir={isRTL ? 'rtl' : 'ltr'}
        role="main"
        aria-label="Site under maintenance"
      >
        <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6">
          <Wrench className="w-8 h-8 text-blue-400" aria-hidden="true" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-white mb-3">
          We&apos;ll be right back
        </h1>
        <p className="text-white/60 max-w-sm leading-relaxed mb-8">
          Real Real Estate is currently undergoing scheduled maintenance.
          We&apos;ll be back shortly — thank you for your patience.
        </p>
        <Link
          href="/login"
          className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
        >
          Admin login
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
