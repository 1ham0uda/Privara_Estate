'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { Button, Input, Card } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { toast, Toaster } from 'react-hot-toast';

function getForgotPasswordErrorMessage(error: any, t: (key: string) => string) {
  switch (error?.code) {
    case 'auth/invalid-email':
      return t('auth.forgotPassword.error.invalid_email');
    case 'auth/too-many-requests':
      return t('auth.forgotPassword.error.too_many_requests');
    case 'auth/user-not-found':
      return t('auth.forgotPassword.success');
    default:
      return error?.message || t('auth.forgotPassword.error.generic');
  }
}

export default function ForgotPasswordPage() {
  const { t, isRTL } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      toast.success(t('auth.forgotPassword.success'));
      router.push('/login');
    } catch (err: any) {
      const message = getForgotPasswordErrorMessage(err, t);
      if (err?.code === 'auth/user-not-found') {
        toast.success(message);
        router.push('/login');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Toaster position="top-center" />
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/login">
            <Button variant="ghost" className="p-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink">{t('auth.forgotPassword.title')}</h1>
            <p className="text-sm text-brand-slate mt-1">{t('auth.forgotPassword.subtitle')}</p>
          </div>
        </div>

        <Card className="p-6 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <Input
                type="email"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                required
                placeholder={t('auth.forgotPassword.email_placeholder')}
                dir="ltr"
              />
            </div>
            <Button variant="primary" type="submit" className="w-full" loading={loading}>
              {t('auth.forgotPassword.submit')}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
