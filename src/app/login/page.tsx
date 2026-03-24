'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import { Shield, Mail, Lock } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

function getLoginErrorMessage(error: any, t: (key: string) => string) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return t('auth.login.error.invalid_credentials');
    case 'auth/invalid-email':
      return t('auth.login.error.invalid_email');
    case 'auth/too-many-requests':
      return t('auth.login.error.too_many_requests');
    case 'auth/operation-not-allowed':
      return t('auth.login.error.operation_not_allowed');
    default:
      return error?.message || t('auth.login.error.generic');
  }
}

function getSafeRedirectPath(value: string | null, fallbackPath: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallbackPath;
  }

  return value;
}

export default function LoginPage() {
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { profile, loading: authLoading, refreshProfile } = useAuth();

  const fallbackPath = useMemo(() => (profile ? `/${profile.role}/dashboard` : '/client/dashboard'), [profile]);
  const targetPath = useMemo(() => getSafeRedirectPath(redirectParam, fallbackPath), [redirectParam, fallbackPath]);

  useEffect(() => {
    if (!authLoading && profile) {
      router.push(targetPath);
    }
  }, [profile, authLoading, router, targetPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

      const user = auth.currentUser;
      if (!user) {
        throw new Error(t('auth.login.error.generic'));
      }

      const currentProfile = await userService.getUserProfile(user.uid);
      if (!currentProfile) {
        await auth.signOut();
        toast.error(t('auth.login.error.profile_missing'));
        return;
      }

      if (currentProfile.status === 'deactivated') {
        await auth.signOut();
        toast.error(t('auth.account_deactivated'));
        return;
      }

      await refreshProfile();
      toast.success(t('auth.login.success'));
      router.push(getSafeRedirectPath(redirectParam, `/${currentProfile.role}/dashboard`));
    } catch (error: any) {
      toast.error(getLoginErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <Toaster position="top-center" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
            <Shield className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Privately</span>
        </Link>
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          {t('auth.signin_title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">{t('auth.login_subtitle')}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10 shadow-xl border-none" hover={false}>
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('auth.email')}
              </label>
              <div className="mt-1 relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all`}
                  placeholder={t('auth.email_placeholder')}
                  dir="ltr"
                />
              </div>
            </div>

            <div className={isRTL ? 'text-right' : 'text-left'}>
              <div className="flex justify-between items-center gap-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('auth.password')}
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  {t('auth.forgotPassword.link')}
                </Link>
              </div>
              <div className="mt-1 relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all`}
                  placeholder={t('auth.password_placeholder')}
                />
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full h-12 rounded-xl" loading={loading}>
                {t('auth.signin_button')}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t('auth.new_to')}</span>
              </div>
            </div>

            <div className="mt-6">
              <Link href="/register">
                <Button variant="outline" className="w-full h-12 rounded-xl">
                  {t('auth.create_account')}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
