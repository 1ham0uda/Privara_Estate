'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

const RESEND_COOLDOWN = 60;

export default function VerifyEmailPage() {
  const { t, isRTL } = useLanguage();
  const { user, profile, loading, signOut, refreshEmailVerification } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!loading && profile) router.replace(`/${profile.role}/dashboard`);
  }, [loading, profile, router]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || resending || cooldown > 0) return;
    setResending(true);
    try {
      await sendEmailVerification(currentUser);
      toast.success(t('auth.verify_email.resend_success'));
      setCooldown(RESEND_COOLDOWN);
    } catch {
      toast.error(t('auth.verify_email.resend_error'));
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    setChecking(true);
    try {
      const verified = await refreshEmailVerification();
      if (!verified) toast.error(t('auth.verify_email.not_verified_yet'));
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading || (!user && !profile)) {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cloud flex flex-col justify-center py-10 sm:py-16 sm:px-6 lg:px-8"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-dm-sans)', fontSize: '14px' } }} />

      {/* Brand mark */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 select-none" aria-hidden="true">
            <span className="text-white font-serif font-bold text-base leading-none">RR</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif font-bold text-xl tracking-tight">
              <span className="text-ink">Real </span><span className="text-blue-600">Real</span><span className="text-ink"> Estate</span>
            </span>
            <span className="text-[10px] font-mono text-brand-slate tracking-[0.12em] uppercase">
              Independent Advisory · Egypt
            </span>
          </div>
        </Link>

        <h2 className="text-center font-serif text-3xl font-bold text-ink">
          {t('auth.verify_email.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-brand-slate">
          {t('auth.verify_email.subtitle')}
        </p>
      </div>

      {/* Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10 border-soft-blue shadow-sm" hover={false}>

          {/* Email indicator */}
          <div className="flex items-center gap-3 p-4 bg-soft-blue rounded-xl mb-6">
            <div className="w-10 h-10 bg-blue-600/10 rounded-full flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-brand-slate mb-0.5">{t('auth.verify_email.sent_to')}</p>
              <p className="text-sm font-medium text-ink truncate" dir="ltr">
                {user?.email ?? ''}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full h-12 rounded-full gap-2"
              onClick={handleCheckVerified}
              loading={checking}
              disabled={checking}
            >
              {!checking && <CheckCircle className="w-4 h-4" />}
              {checking ? t('auth.verify_email.checking') : t('auth.verify_email.ive_verified')}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 rounded-full gap-2"
              onClick={handleResend}
              loading={resending}
              disabled={resending || cooldown > 0}
            >
              {!resending && <RefreshCw className="w-4 h-4" />}
              {cooldown > 0
                ? t('auth.verify_email.cooldown').replace('{seconds}', String(cooldown))
                : t('auth.verify_email.resend')}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-soft-blue text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-brand-slate hover:text-ink transition-colors"
            >
              {t('auth.verify_email.use_different')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
