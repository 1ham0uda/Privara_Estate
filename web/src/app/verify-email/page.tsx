'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import { Shield, Mail, CheckCircle, RefreshCw } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyEmailPage() {
  const { t, isRTL } = useLanguage();
  const { user, profile, loading, signOut, refreshEmailVerification } = useAuth();
  const router = useRouter();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If the user is already verified and has a profile, send them home
  useEffect(() => {
    if (!loading && profile) {
      router.replace(`/${profile.role}/dashboard`);
    }
  }, [loading, profile, router]);

  // If no user at all, send to login
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Cooldown timer
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
      if (!verified) {
        toast.error(t('auth.verify_email.not_verified_yet'));
      }
      // If verified, the useEffect above will redirect automatically
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const userEmail = user?.email ?? '';

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:py-12 sm:px-6 lg:px-8"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Toaster position="top-center" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
            <Shield className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Privara Estate</span>
        </Link>

        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          {t('auth.verify_email.title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('auth.verify_email.subtitle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10 shadow-xl border-none" hover={false}>
          {/* Email indicator */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">{t('auth.verify_email.sent_to')}</p>
              <p className="text-sm font-medium text-gray-900 truncate" dir="ltr">
                {userEmail}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Primary action: confirm verification */}
            <Button
              className="w-full h-12 rounded-xl gap-2"
              onClick={handleCheckVerified}
              loading={checking}
              disabled={checking}
            >
              {!checking && <CheckCircle className="w-4 h-4" />}
              {checking ? t('auth.verify_email.checking') : t('auth.verify_email.ive_verified')}
            </Button>

            {/* Secondary action: resend */}
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl gap-2"
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

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('auth.verify_email.use_different')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
