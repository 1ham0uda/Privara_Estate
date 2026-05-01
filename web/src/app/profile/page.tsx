'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { userService, preferencesService } from '@/src/lib/db';
import { Button, Input, Card } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { User, Mail, Phone, MapPin, Save, Loader2, Download, Trash2, Bell, Gift, Copy, Check, MessageCircle } from 'lucide-react';
import { NotificationPreferences } from '@/src/types';
import { auth } from '@/src/lib/firebase';
import { motion } from 'motion/react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [exportingData, setExportingData] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [eraseConfirmEmail, setEraseConfirmEmail] = useState('');
  const [showEraseConfirm, setShowEraseConfirm] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(preferencesService.defaultPreferences());
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappSuccess, setWhatsappSuccess] = useState(false);

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
      if (profile.notificationPreferences) {
        setPrefs(profile.notificationPreferences);
      }
      setWhatsappOptIn(profile.whatsappOptIn ?? false);
      setWhatsappNumber(profile.whatsappNumber ?? '');
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

  const handleSavePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await preferencesService.updatePreferences(user.uid, prefs);
      await refreshProfile();
      setPrefsSuccess(true);
      setTimeout(() => setPrefsSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSaveWhatsapp = async () => {
    if (!user) return;
    setSavingWhatsapp(true);
    try {
      await userService.updateUserProfile(user.uid, {
        whatsappOptIn,
        whatsappNumber: whatsappOptIn ? whatsappNumber.trim() : '',
      });
      await refreshProfile();
      setWhatsappSuccess(true);
      setTimeout(() => setWhatsappSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleCopyReferral = () => {
    if (!profile?.referralCode) return;
    const url = `${window.location.origin}/register?ref=${profile.referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    });
  };

  const handleExportData = async () => {
    if (!user) return;
    setExportingData(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/user/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `real-real-estate-data.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('profile.export_failed') || 'Export failed. Please try again.');
    } finally {
      setExportingData(false);
    }
  };

  const handleEraseAccount = async () => {
    if (!user) return;
    setErasing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/user/erase', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: eraseConfirmEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erasure failed');
      await auth.signOut();
    } catch (err: any) {
      setError(err.message || t('profile.erase_failed') || 'Account erasure failed.');
      setErasing(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cloud pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className={isRTL ? 'text-right' : 'text-left'}>
            <h1 className="font-serif text-3xl font-bold text-ink">{t('profile.title')}</h1>
            <p className="mt-2 text-sm sm:text-base text-brand-slate">{t('profile.subtitle')}</p>
          </div>

          <Card hover={false}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">{t('profile.full_name')}</label>
                  <div className="relative">
                    <User className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-brand-slate`} />
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
                  <label className="block text-sm font-medium text-ink">{t('profile.email')}</label>
                  <div className="relative">
                    <Mail className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-brand-slate`} />
                    <Input type="email" value={profile.email} disabled className={isRTL ? 'pr-10 bg-soft-blue text-right' : 'pl-10 bg-soft-blue opacity-70'} />
                  </div>
                  <p className="text-xs text-brand-slate">{t('profile.email_note')}</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">{t('profile.phone')}</label>
                  <div className="relative">
                    <Phone className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-brand-slate`} />
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
                  <label className="block text-sm font-medium text-ink">{t('profile.location')}</label>
                  <div className="relative">
                    <MapPin className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} w-5 h-5 text-brand-slate`} />
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
                  {success && <span className="text-blue-600 text-sm font-medium">{t('profile.success')}</span>}
                  {error && <span className="text-red-600 text-sm font-medium">{error}</span>}
                </div>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('profile.save_changes')}
                </Button>
              </div>
            </form>
          </Card>

          {/* Your Data */}
          <Card hover={false}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h2 className="text-lg font-semibold text-ink">{t('profile.your_data') || 'Your Data'}</h2>
              <p className="mt-1 text-sm text-brand-slate">{t('profile.your_data_desc') || 'Download a copy of all data we hold about you, or permanently erase your account.'}</p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={handleExportData}
                  disabled={exportingData}
                  className="gap-2"
                >
                  {exportingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {t('profile.export_data') || 'Download my data'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Referral Program */}
          {profile.role === 'client' && (
            <Card hover={false}>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Gift className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-ink">{t('profile.referral_title')}</h2>
                </div>
                <p className="text-sm text-brand-slate mb-5">{t('profile.referral_desc')}</p>
                {profile.referralCode ? (
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="flex-1 px-4 py-3 bg-soft-blue border border-soft-blue rounded-xl font-mono text-sm font-bold tracking-widest text-ink">
                        {profile.referralCode}
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleCopyReferral}
                        className="gap-2 shrink-0"
                      >
                        {referralCopied
                          ? <><Check className="w-4 h-4 text-emerald-600" /> {t('profile.referral_copied')}</>
                          : <><Copy className="w-4 h-4" /> {t('profile.referral_copy')}</>
                        }
                      </Button>
                    </div>
                    <p className="text-xs text-brand-slate">
                      {t('profile.referral_count').replace('{count}', String(profile.referralCount ?? 0))}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-brand-slate italic">{t('profile.referral_none')}</p>
                )}
              </div>
            </Card>
          )}

          {/* WhatsApp Opt-in */}
          <Card hover={false}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <MessageCircle className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-ink">{t('profile.whatsapp_title')}</h2>
              </div>
              <p className="text-sm text-brand-slate mb-5">{t('profile.whatsapp_desc')}</p>

              <label className={`flex items-start gap-3 p-4 rounded-xl border border-soft-blue bg-soft-blue/40 cursor-pointer select-none mb-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={whatsappOptIn}
                    onChange={e => setWhatsappOptIn(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{t('profile.whatsapp_opt_in_label')}</p>
                  <p className="text-xs text-brand-slate mt-0.5">{t('profile.whatsapp_opt_in_sub')}</p>
                </div>
              </label>

              {whatsappOptIn && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-brand-slate uppercase mb-1">{t('profile.whatsapp_number_label')}</label>
                  <Input
                    type="tel"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    placeholder={t('profile.whatsapp_number_placeholder')}
                    dir="ltr"
                  />
                  <p className="text-xs text-brand-slate mt-1.5">{t('profile.whatsapp_consent_note')}</p>
                </div>
              )}

              <Button
                onClick={handleSaveWhatsapp}
                loading={savingWhatsapp}
                variant={whatsappSuccess ? 'secondary' : 'primary'}
                className="gap-2"
              >
                {whatsappSuccess
                  ? <><Check className="w-4 h-4" /> {t('common.saved') || 'Saved'}</>
                  : <><Save className="w-4 h-4" /> {t('common.save')}</>
                }
              </Button>
            </div>
          </Card>

          {/* Notification Preferences */}
          <Card hover={false}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Bell className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-ink">{t('prefs.title')}</h2>
              </div>
              <p className="text-sm text-brand-slate mb-5">{t('prefs.subtitle')}</p>

              {/* Top-level channel toggles */}
              <div className="space-y-3 mb-6">
                {([
                  ['emailEnabled', 'prefs.email_enabled', 'prefs.email_enabled_desc'],
                  ['inAppEnabled', 'prefs.inapp_enabled', 'prefs.inapp_enabled_desc'],
                ] as const).map(([key, labelKey, descKey]) => (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-xl border border-soft-blue bg-soft-blue/40 cursor-pointer select-none ${isRTL ? 'flex-row-reverse text-right' : ''}`}
                  >
                    <div className="mt-0.5">
                      <input
                        type="checkbox"
                        checked={prefs[key]}
                        onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{t(labelKey)}</p>
                      <p className="text-xs text-brand-slate">{t(descKey)}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Per-event toggles */}
              <p className="text-sm font-semibold text-ink mb-1">{t('prefs.events_title')}</p>
              <p className="text-xs text-brand-slate mb-3">{t('prefs.events_subtitle')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                {(Object.keys(prefs.events) as Array<keyof typeof prefs.events>).map(eventKey => (
                  <label
                    key={eventKey}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-soft-blue hover:bg-soft-blue/50 cursor-pointer select-none transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={prefs.events[eventKey]}
                      onChange={e =>
                        setPrefs(p => ({
                          ...p,
                          events: { ...p.events, [eventKey]: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 rounded accent-blue-600 shrink-0"
                    />
                    <span className="text-sm text-ink">{t(`prefs.event.${eventKey}` as any)}</span>
                  </label>
                ))}
              </div>

              <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button onClick={handleSavePrefs} disabled={savingPrefs} className="gap-2">
                  {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('prefs.save')}
                </Button>
                {prefsSuccess && <span className="text-blue-600 text-sm font-medium">{t('prefs.saved')}</span>}
              </div>
            </div>
          </Card>

          <Card className="border-red-100 bg-red-50/40" hover={false}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <h2 className="text-lg font-semibold text-red-900">{t('profile.danger_zone')}</h2>
              <p className="mt-1 text-sm text-red-700">{t('profile.delete_note')}</p>
              {!showEraseConfirm ? (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
                    onClick={() => setShowEraseConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('profile.delete_account')}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3 max-w-sm">
                  <p className="text-sm text-red-700 font-medium">{t('profile.erase_confirm_prompt') || 'Type your email address to confirm permanent erasure:'}</p>
                  <input
                    type="email"
                    value={eraseConfirmEmail}
                    onChange={e => setEraseConfirmEmail(e.target.value)}
                    placeholder={profile.email}
                    className="w-full px-4 py-2 border border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-400 bg-white"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowEraseConfirm(false); setEraseConfirmEmail(''); }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                      onClick={handleEraseAccount}
                      disabled={erasing || !eraseConfirmEmail}
                    >
                      {erasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t('profile.delete_account')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
