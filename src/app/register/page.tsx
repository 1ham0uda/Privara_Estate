'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import { Shield, Mail, Lock, User as UserIcon } from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

function getRegisterErrorMessage(error: any, t: (key: string) => string) {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return t('auth.register.error.email_in_use');
    case 'auth/invalid-email':
      return t('auth.register.error.invalid_email');
    case 'auth/weak-password':
      return t('auth.register.error.weak_password');
    case 'auth/operation-not-allowed':
      return t('auth.register.error.operation_not_allowed');
    default:
      return error?.message || t('auth.register.error.generic');
  }
}

export default function RegisterPage() {
  const { t, isRTL } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { profile, loading: authLoading, refreshProfile } = useAuth();

  useEffect(() => {
    if (!authLoading && profile) {
      router.push(`/${profile.role}/dashboard`);
    }
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
      await refreshProfile();
      toast.success(t('auth.register.success'));
      router.push('/client/dashboard');
    } catch (error: any) {
      if (createdUser && !profileCreated) {
        try {
          await createdUser.delete();
        } catch (rollbackError) {
          console.error('Failed to rollback auth user after registration error:', rollbackError);
        }
      }

      const message = createdUser && !profileCreated && !error?.code
        ? t('auth.register.error.profile_sync_failed')
        : getRegisterErrorMessage(error, t);

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:py-12 sm:px-6 lg:px-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <Toaster position="top-center" />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex justify-center items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
            <Shield className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Privara Estate</span>
        </Link>
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          {t('auth.register_title')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('auth.register_subtitle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="py-8 px-4 sm:px-10 shadow-xl border-none" hover={false}>
          <form className="space-y-6" onSubmit={handleRegister}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                {t('auth.full_name')}
              </label>
              <div className="mt-1 relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`block w-full ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all`}
                  placeholder={t('auth.full_name_placeholder')}
                />
              </div>
            </div>

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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.password')}
              </label>
              <div className="mt-1 relative">
                <div className={`absolute inset-y-0 ${isRTL ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full ${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-black focus:border-black sm:text-sm transition-all`}
                  placeholder={t('auth.password_placeholder')}
                />
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="focus:ring-black h-4 w-4 text-black border-gray-300 rounded"
                />
              </div>
              <div className={`${isRTL ? 'mr-3' : 'ml-3'} text-sm`}>
                <label htmlFor="terms" className="text-gray-500">
                  {t('auth.agree_to')}{' '}
                  <Link href="#" className="text-black font-medium underline">{t('auth.terms')}</Link>{' '}
                  {t('auth.and')}{' '}
                  <Link href="#" className="text-black font-medium underline">{t('auth.privacy')}</Link>
                </label>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full h-12 rounded-xl" loading={loading}>
                {t('auth.register_button')}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t('auth.already_have')}</span>
              </div>
            </div>

            <div className="mt-6">
              <Link href="/login">
                <Button variant="outline" className="w-full h-12 rounded-xl">
                  {t('auth.signin_instead')}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
