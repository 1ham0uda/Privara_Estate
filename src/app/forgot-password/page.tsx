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
import { toast } from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const { t, isRTL } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(t('auth.forgotPassword.success'));
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/login">
            <Button variant="ghost" className="p-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{t('auth.forgotPassword.title')}</h1>
        </div>

        <Card className="p-6 bg-white shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.dashboard.modal.addUser.email')}</label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e: any) => setEmail(e.target.value)} 
                required 
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
