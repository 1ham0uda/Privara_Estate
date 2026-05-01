'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, userService, consultantService, availabilityService } from '@/src/lib/db';
import { ConsultationCase, UserProfile, ConsultantProfile, ConsultantAvailability } from '@/src/types';
import { Card, Badge, Button, Skeleton, SkeletonCard } from '@/src/components/UI';
import {
  MessageSquare,
  Clock,
  ChevronRight,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  Users,
  TrendingUp,
  Star,
  Wifi,
  WifiOff
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import SupportModal from '@/src/components/SupportModal';
import { useLanguage } from '@/src/context/LanguageContext';

export default function ConsultantDashboard() {
  const { t, isRTL, language } = useLanguage();
  const { profile, loading } = useRoleGuard(['consultant']);
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [consultantProfile, setConsultantProfile] = useState<ConsultantProfile | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [availability, setAvailability] = useState<ConsultantAvailability>('available');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [savingAvailability, setSavingAvailability] = useState(false);

  useEffect(() => {
    if (profile) {
      const unsubscribe = consultationService.subscribeToConsultations('consultant', profile.uid, (data) => {
        setCases(data);
      });

      consultantService.getConsultantProfile(profile.uid).then((p) => {
        setConsultantProfile(p);
        if (p?.availability) setAvailability(p.availability);
        if (p?.availabilityNote) setAvailabilityNote(p.availabilityNote);
      });

      return () => unsubscribe();
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="h-16 bg-white border-b border-soft-blue px-6 flex items-center"><Skeleton className="h-6 w-32" /></div>
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[1,2,3].map(i => <SkeletonCard key={i} lines={2} />)}
          </div>
          <SkeletonCard lines={6} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  if (profile?.status === 'deactivated') {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="max-w-md w-full p-8 text-center border-soft-blue shadow-sm" hover={false}>
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink mb-2">{t('auth.account_deactivated') || 'Account Deactivated'}</h1>
          <p className="text-brand-slate mb-8">{t('auth.account_deactivated_desc') || 'Your account has been deactivated by the administrator. Please contact support if you believe this is an error.'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="w-full" onClick={() => setIsSupportModalOpen(true)}>
              {t('support.new_message')}
            </Button>
            <Button variant="outline" className="w-full" as={Link} href="/consultant/support">
              {t('support.open_tickets')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const activeCases = cases.filter(c => c.status !== 'completed');
  const completedCases = cases.filter(c => c.status === 'completed');
  const ratedCases = cases.filter(c => c.rating);
  const avgRating = ratedCases.length > 0 
    ? (ratedCases.reduce((acc, c) => acc + (c.rating || 0), 0) / ratedCases.length).toFixed(1)
    : 'N/A';

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">{t('consultant.dashboard_title')}</h1>
          <p className="text-brand-slate mt-1">{t('consultant.dashboard_subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-brand-slate">{t('consultant.active_cases')}</p>
                <p className="text-2xl font-bold">{activeCases.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-brand-slate">{t('consultant.completed')}</p>
                <p className="text-2xl font-bold">{completedCases.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Star className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-brand-slate">{t('consultant.avg_rating')}</p>
                <p className="text-2xl font-bold">{avgRating}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="font-serif text-xl font-bold mb-6 flex items-center gap-2 text-ink">
                <Clock className="w-5 h-5 text-blue-600" /> {t('consultant.active_consultations')}
              </h2>
              
              <div className="space-y-4">
                {activeCases.length > 0 ? (
                  activeCases.map(c => (
                    <Card key={c.id} className="p-6 border-none shadow-sm bg-white" hover={true}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center overflow-hidden relative">
                            {c.clientAvatarUrl ? (
                              <Image 
                                src={c.clientAvatarUrl} 
                                alt="Client" 
                                fill 
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-6 h-6 text-brand-slate/40" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="info" className="text-[10px] uppercase">{t(`case.status.${c.status}`)}</Badge>
                              <span className="text-xs text-brand-slate">#{c.id.slice(-6)}</span>
                            </div>
                            <h3 className="font-bold text-ink">{c.clientName || t('common.client')}</h3>
                            <p className="text-xs text-brand-slate">{t('consultant.goal')}: <span className="capitalize">{c.intake.goal}</span> • {formatDate(c.createdAt, language)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link href={`/cases/${c.id}/chat`}>
                            <Button variant="outline" className="h-10 px-4 rounded-lg">
                              <MessageSquare className="w-4 h-4 mr-2" /> {t('consultant.chat')}
                            </Button>
                          </Link>
                          <Link href={`/consultant/cases/${c.id}`}>
                            <Button className="h-10 px-4 rounded-lg">
                              {t('consultant.view_details')} <ChevronRight className={`w-4 h-4 ${isRTL ? 'mr-1 rotate-180' : 'ml-1'}`} />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="py-12 text-center bg-white border-dashed border-2 border-soft-blue" hover={false}>
                    <p className="text-brand-slate">{t('consultant.no_active')}</p>
                  </Card>
                )}
              </div>
            </section>

            {ratedCases.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" /> {t('consultant.recent_feedback')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ratedCases.slice(0, 4).map(c => (
                    <Card key={c.id} className="p-4 bg-white border-none shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-ink">{c.clientName || t('common.client')}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${c.rating! >= s ? 'text-yellow-400 fill-current' : 'text-ink/20'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-brand-slate italic line-clamp-2">&quot;{c.feedback || t('consultant.no_comment')}&quot;</p>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {completedCases.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold mb-6">{t('consultant.completed_cases')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedCases.map(c => (
                    <Card key={c.id} className="p-4 bg-white border-none shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{c.clientName || t('common.client')}</p>
                            <p className="text-[10px] text-brand-slate">{formatDate(c.completedAt || c.updatedAt, language)}</p>
                          </div>
                        </div>
                        <Link href={`/consultant/cases/${c.id}`}>
                          <ChevronRight className={`w-4 h-4 text-brand-slate/40 ${isRTL ? 'rotate-180' : ''}`} />
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-8">
            {/* Availability Toggle */}
            <Card className="bg-white border-none shadow-sm p-6" hover={false}>
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                {availability === 'available' ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-brand-slate" />}
                {t('consultant.availability.title')}
              </h3>
              <div className="flex gap-2 mb-4">
                {(['available', 'busy', 'away'] as ConsultantAvailability[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setAvailability(s)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      availability === s
                        ? s === 'available'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : s === 'busy'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-slate-400 text-white border-slate-400'
                        : 'bg-cloud border-soft-blue text-brand-slate hover:border-blue-200'
                    }`}
                  >
                    {t(`consultant.availability.${s}`)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={availabilityNote}
                onChange={(e) => setAvailabilityNote(e.target.value)}
                placeholder={t('consultant.availability.note_placeholder')}
                className="w-full h-9 px-3 text-xs border border-soft-blue rounded-xl bg-cloud focus:outline-none focus:border-blue-400 mb-3"
              />
              <Button
                size="sm"
                className="w-full rounded-xl"
                loading={savingAvailability}
                onClick={async () => {
                  if (!profile) return;
                  setSavingAvailability(true);
                  try {
                    await availabilityService.updateAvailability(profile.uid, availability, availabilityNote);
                    const { toast } = await import('react-hot-toast');
                    toast.success(t('consultant.availability.saved'));
                  } finally {
                    setSavingAvailability(false);
                  }
                }}
              >
                {t('consultant.availability.save')}
              </Button>
            </Card>

            <Card className="bg-ink text-white border-none p-8" hover={false}>
              <h3 className="font-serif text-lg font-bold mb-4">{t('consultant.guidelines_title')}</h3>
              <ul className="space-y-4 text-sm text-white/60">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-white mt-0.5 shrink-0">1</div>
                  <span>{t('consultant.guideline_1')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-white mt-0.5 shrink-0">2</div>
                  <span>{t('consultant.guideline_2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-white mt-0.5 shrink-0">3</div>
                  <span>{t('consultant.guideline_3')}</span>
                </li>
              </ul>
            </Card>

            <Card className="bg-white border-none shadow-sm p-8" hover={false}>
              <h3 className="text-lg font-bold mb-4">{t('consultant.support_title')}</h3>
              <p className="text-sm text-brand-slate mb-6">
                {t('consultant.support_text')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setIsSupportModalOpen(true)}
                >
                  {t('support.new_message')}
                </Button>
                <Button variant="outline" className="w-full" as={Link} href="/consultant/support">
                  {t('support.open_tickets')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {profile && (
        <SupportModal 
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          userId={profile.uid}
          userName={profile.displayName || 'Consultant'}
          userEmail={profile.email}
          userRole="consultant"
        />
      )}
    </div>
  );
}
