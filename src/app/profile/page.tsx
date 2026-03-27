'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { userService } from '@/src/lib/db';
import { Button, Input, Card } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { User, Mail, Phone, MapPin, Save, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '',
    location: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        phoneNumber: profile.phoneNumber || '',
        location: profile.location || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await userService.updateUserProfile(user.uid, formData);
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="text-3xl font-bold text-gray-900">{t('profile.title')}</h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600">{t('profile.subtitle')}</p>
          </div>

          <Card hover={false}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('profile.full_name')}</label>
                  <div className="relative">
                    <User className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-gray-400`} />
                    <Input
                      type="text"
                      value={formData.displayName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, displayName: e.target.value })}
                      className={isRTL ? 'pr-10 text-right' : 'pl-10'}
                      placeholder={t('profile.full_name_placeholder')}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('profile.email')}</label>
                  <div className="relative">
                    <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-gray-400`} />
                    <Input type="email" value={profile.email} disabled className={isRTL ? 'pr-10 bg-gray-100 text-right' : 'pl-10 bg-gray-100'} />
                  </div>
                  <p className="text-xs text-gray-500">{t('profile.email_note')}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('profile.phone')}</label>
                  <div className="relative">
                    <Phone className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-gray-400`} />
                    <Input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className={isRTL ? 'pr-10 text-right' : 'pl-10'}
                      placeholder={'+20 100 000 0000'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('profile.location')}</label>
                  <div className="relative">
                    <MapPin className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-gray-400`} />
                    <Input
                      type="text"
                      value={formData.location}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, location: e.target.value })}
                      className={isRTL ? 'pr-10 text-right' : 'pl-10'}
                      placeholder={t('profile.location_placeholder')}
                    />
                  </div>
                </div>
              </div>

              <div className={`pt-2 flex flex-col sm:flex-row sm:items-center gap-3 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                <div>
                  {success && <span className="text-green-600 text-sm font-medium">{t('profile.success')}</span>}
                  {error && <span className="text-red-600 text-sm font-medium">{error}</span>}
                </div>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('profile.save_changes')}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="border-red-100 bg-red-50/40" hover={false}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h2 className="text-lg font-semibold text-red-900">{t('profile.danger_zone')}</h2>
              <p className="mt-1 text-sm text-red-700">{t('profile.delete_note')}</p>
              <div className="mt-4">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  {t('profile.delete_account')}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
