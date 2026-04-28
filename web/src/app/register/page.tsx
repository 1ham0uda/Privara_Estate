'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import { Mail, Lock, User as UserIcon } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

function getRegisterErrorMessage(error: any, t: (key: string) => string) {
  switch (error?.code) {
    case 'auth/email-already-in-use':      return t('auth.register.error.email_in_use');
    case 'auth/invalid-email':             return t('auth.register.error.invalid_email');
    case 'auth/weak-password':             return t('auth.register.error.weak_password');
    case 'auth/operation-not-allowed':     return t('auth.register.error.operation_not_allowed');
    default: return error?.message || t('auth.register.error.generic');
  }
}

const inputCls = (isRTL: boolean, side: 'l' | 'r') =>
  `block w-full ${isRTL ? (side === 'r' ? 'pr-10 pl-3.5' : 'pl-10 pr-3.5') : (side === 'l' ? 'pl-10 pr-3.5' : 'pr-10 pl-3.5')} py-2.5 bg-cloud border-2 border-soft-blue rounded-xl text-sm text-ink placeholder:text-brand-slate focus:outline-none focus:border-blue-600 transition-all`;

export default function RegisterPage() {
  const { t, isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { profile, loading: authLoading, refreshProfile } = useAuth();

  useEffect(() => {
    if (!authLoading && profile) router.push(`/${profile.role}/dashboard`);
  }, [profile, authLoading, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let createdUser: User | null = null;
    let profileCreated = false;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = name.trim();
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      createdUser = userCredential.user;
      await updateProfile(createdUser, { displayName: normalizedName });
      await userService.createUserProfile({
        uid: createdUser.uid,
        email: createdUser.email || normalizedEmail,
        displayName: normalizedName,
        role: 'client',
        createdAt: new Date(),
        status: 'active',
        totalConsultations: 0,
        activeConsultations: 0,
        completedConsultations: 0,
      });
      profileCreated = true;
      await sendEmailVerification(createdUser);
      toast.success(t('auth.verify_email.sent'));
      router.push('/verify-email');
    } catch (error: any) {
      if (createdUser && !profileCreated) {
        try { await createdUser.delete(); } catch {}
      }
      const message =
        createdUser && !profileCreated && !error?.code
          ? t('auth.register.error.profile_sync_failed')
          : getRegisterErrorMessage(error, t);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

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
          {t('auth.register_title')}
        </h2>
        <p className="mt-2 text-center text-sm text-brand-slate">{t('auth.register_subtitle')}</p>
      </div>

      {/* Form card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10 border-soft-blue shadow-sm" hover={false}>
          <form className="space-y-5" onSubmit={handleRegister}>

            {/* Full name */}
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
                {t('auth.full_name')}
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3.5' : 'left-0 pl-3.5'} flex items-center pointer-events-none`}>
                  <UserIcon className="h-4 w-4 text-brand-slate" />
                </div>
                <input
                  id="name" name="name" type="text" required
                  value={name} onChange={(e) => setName(e.target.value)}
                  className={inputCls(isRTL, 'l')}
                  placeholder={t('auth.full_name_placeholder')}
                />
              </div>
            </div>

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
                  id="email" name="email" type="email" autoComplete="email" required dir="ltr"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className={inputCls(isRTL, 'l')}
                  placeholder={t('auth.email_placeholder')}
                />
              </div>
            </div>

            {/* Password */}
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3.5' : 'left-0 pl-3.5'} flex items-center pointer-events-none`}>
                  <Lock className="h-4 w-4 text-brand-slate" />
                </div>
                <input
                  id="password" name="password" type="password" autoComplete="new-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className={inputCls(isRTL, 'l')}
                  placeholder={t('auth.password_placeholder')}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                id="terms" name="terms" type="checkbox" required
                className="mt-0.5 h-4 w-4 rounded border-soft-blue text-blue-600 focus:ring-blue-600"
              />
              <label htmlFor="terms" className="text-sm text-brand-slate">
                {t('auth.agree_to')}{' '}
                <Link href="#" className="text-blue-600 font-medium hover:text-blue-700">{t('auth.terms')}</Link>{' '}
                {t('auth.and')}{' '}
                <Link href="#" className="text-blue-600 font-medium hover:text-blue-700">{t('auth.privacy')}</Link>
              </label>
            </div>

            <Button type="submit" className="w-full h-12 rounded-full mt-1" loading={loading}>
              {t('auth.register_button')}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-soft-blue" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-brand-slate font-mono tracking-wide">
                {t('auth.already_have')}
              </span>
            </div>
          </div>
          <div className="mt-5">
            <Link href="/login">
              <Button variant="outline" className="w-full h-12 rounded-full">
                {t('auth.signin_instead')}
              </Button>
            </Link>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs font-mono text-brand-slate tracking-[0.12em] uppercase">
          No commission · No agenda · Just clarity
        </p>
      </div>
    </div>
  );
}
