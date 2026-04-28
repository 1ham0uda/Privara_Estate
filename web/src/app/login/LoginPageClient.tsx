'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import { Mail, Lock } from 'lucide-react';
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

type LoginPageClientProps = { initialRedirect?: string | null };

export default function LoginPageClient({ initialRedirect = null }: LoginPageClientProps) {
  const { t, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { profile, loading: authLoading, refreshProfile } = useAuth();

  const fallbackPath = useMemo(
    () => (profile ? `/${profile.role}/dashboard` : '/client/dashboard'),
    [profile]
  );
  const targetPath = useMemo(
    () => getSafeRedirectPath(initialRedirect, fallbackPath),
    [initialRedirect, fallbackPath]
  );

  useEffect(() => {
    if (!authLoading && profile) router.push(targetPath);
  }, [profile, authLoading, router, targetPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

      const user = auth.currentUser;
      if (!user) throw new Error(t('auth.login.error.generic'));

      if (!user.emailVerified) {
        toast.error(t('auth.verify_email.required'));
        router.push('/verify-email');
        return;
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
      router.push(getSafeRedirectPath(initialRedirect, `/${currentProfile.role}/dashboard`));
    } catch (error: any) {
      toast.error(getLoginErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cloud flex flex-col justify-center py-10 sm:py-16 sm:px-6 lg:px-8"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontFamily: 'var(--font-dm-sans)', fontSize: '14px' },
        }}
      />

      {/* Brand mark */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
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
          {t('auth.signin_title')}
        </h2>
        <p className="mt-2 text-center text-sm text-brand-slate">{t('auth.login_subtitle')}</p>
      </div>

      {/* Form card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10 border-soft-blue shadow-sm" hover={false}>
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email */}
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                {t('auth.email')}
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3.5' : 'left-0 pl-3.5'} flex items-center pointer-events-none`}>
                  <Mail className="h-4 w-4 text-brand-slate" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2.5 bg-cloud border-2 border-soft-blue rounded-xl text-sm text-ink placeholder:text-brand-slate focus:outline-none focus:border-blue-600 transition-all`}
                  placeholder={t('auth.email_placeholder')}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <div className="flex justify-between items-center gap-4 mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-ink">
                  {t('auth.password')}
                </label>
                <Link href="/forgot-password" className="text-xs font-mono text-blue-600 hover:text-blue-700 tracking-wide">
                  {t('auth.forgotPassword.link')}
                </Link>
              </div>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3.5' : 'left-0 pl-3.5'} flex items-center pointer-events-none`}>
                  <Lock className="h-4 w-4 text-brand-slate" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full ${isRTL ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5'} py-2.5 bg-cloud border-2 border-soft-blue rounded-xl text-sm text-ink placeholder:text-brand-slate focus:outline-none focus:border-blue-600 transition-all`}
                  placeholder={t('auth.password_placeholder')}
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 rounded-full mt-2" loading={loading}>
              {t('auth.signin_button')}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-soft-blue" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-brand-slate font-mono tracking-wide">
                {t('auth.new_to')}
              </span>
            </div>
          </div>

          <div className="mt-5">
            <Link href="/register">
              <Button variant="outline" className="w-full h-12 rounded-full">
                {t('auth.create_account')}
              </Button>
            </Link>
          </div>
        </Card>

        {/* Trust signal */}
        <p className="mt-6 text-center text-xs font-mono text-brand-slate tracking-[0.12em] uppercase">
          No commission · No agenda · Just clarity
        </p>
      </div>
    </div>
  );
}
