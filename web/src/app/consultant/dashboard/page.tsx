'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, userService, consultantService } from '@/src/lib/db';
import { ConsultationCase, UserProfile, ConsultantProfile } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
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
  Star
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

  useEffect(() => {
    if (profile) {
      const unsubscribe = consultationService.subscribeToConsultations('consultant', profile.uid, (data) => {
        setCases(data);
      });

      consultantService.getConsultantProfile(profile.uid).then(setConsultantProfile);

      return () => unsubscribe();
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                <p className="text-sm text-gray-500">{t('consultant.active_cases')}</p>
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
                <p className="text-sm text-gray-500">{t('consultant.completed')}</p>
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
                <p className="text-sm text-gray-500">{t('consultant.avg_rating')}</p>
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
                              <User className="w-6 h-6 text-gray-300" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="info" className="text-[10px] uppercase">{t(`case.status.${c.status}`)}</Badge>
                              <span className="text-xs text-gray-400">#{c.id.slice(-6)}</span>
                            </div>
                            <h3 className="font-bold text-gray-900">{c.clientName || t('common.client')}</h3>
                            <p className="text-xs text-gray-500">{t('consultant.goal')}: <span className="capitalize">{c.intake.goal}</span> • {formatDate(c.createdAt, language)}</p>
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
                  <Card className="py-12 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
                    <p className="text-gray-500">{t('consultant.no_active')}</p>
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
                        <span className="text-xs font-bold text-gray-900">{c.clientName || t('common.client')}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${c.rating! >= s ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 italic line-clamp-2">&quot;{c.feedback || t('consultant.no_comment')}&quot;</p>
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
                            <p className="text-[10px] text-gray-400">{formatDate(c.completedAt || c.updatedAt, language)}</p>
                          </div>
                        </div>
                        <Link href={`/consultant/cases/${c.id}`}>
                          <ChevronRight className={`w-4 h-4 text-gray-300 ${isRTL ? 'rotate-180' : ''}`} />
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-8">
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
              <p className="text-sm text-gray-500 mb-6">
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
