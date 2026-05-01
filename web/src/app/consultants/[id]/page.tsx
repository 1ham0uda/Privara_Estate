'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { consultantService } from '@/src/lib/db';
import { ConsultantProfile } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  ArrowLeft, 
  User, 
  Star, 
  CheckCircle2, 
  Briefcase, 
  Award,
  Linkedin,
  Globe
} from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import Image from 'next/image';

export default function ConsultantProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);

  useEffect(() => {
    if (id) {
      consultantService.getConsultantProfile(id as string).then(setProfile);
    }
  }, [id]);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-cloud">
      <Navbar />
      
      <main className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ${isRTL ? 'rtl' : 'ltr'}`}>
        <button onClick={() => router.back()} className={`flex items-center text-brand-slate hover:text-ink mb-8 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('common.back')}
        </button>

        <div className="space-y-8">
          {/* Header Card */}
          <Card className="p-8 border-none shadow-sm" hover={false}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 bg-soft-blue rounded-3xl overflow-hidden relative">
                {profile.avatarUrl ? (
                  <Image 
                    src={profile.avatarUrl} 
                    alt={profile.name} 
                    fill 
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-16 h-16 text-brand-slate/40" />
                  </div>
                )}
              </div>
              <div className={`flex-1 text-center ${isRTL ? 'md:text-right' : 'md:text-left'}`}>
                <h1 className="text-3xl font-bold text-ink mb-2">{profile.name}</h1>
                <p className="text-brand-slate mb-4">{profile.experienceYears} {t('consultant.years_exp_text')}</p>
                <div className={`flex flex-wrap justify-center ${isRTL ? 'md:justify-end' : 'md:justify-start'} gap-4 mb-6`}>
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-sm font-bold">{profile.rating} {t('consultant.rating_text')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-bold">{profile.completedConsultations} {t('consultant.completed_cases_text')}</span>
                  </div>
                </div>
                <div className={`flex flex-wrap justify-center ${isRTL ? 'md:justify-end' : 'md:justify-start'} gap-2`}>
                  {profile.specialties.map(s => (
                    <Badge key={s} variant="info">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Bio & Professional Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-brand-slate" /> {t('consultant.about')}
                </h2>
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <p className="text-brand-slate leading-relaxed">{profile.bio}</p>
                </Card>
              </section>

              <section>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand-slate" /> {t('consultant.prof_summary')}
                </h2>
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="prose prose-sm max-w-none text-brand-slate">
                    <p className="whitespace-pre-line">{profile.professionalSummary}</p>
                  </div>
                </Card>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-bold mb-4">{t('consultant.connect')}</h2>
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="space-y-4">
                    <button className={`w-full flex items-center justify-between p-3 bg-cloud rounded-xl hover:bg-soft-blue transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Linkedin className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium">{t('consultant.linkedin')}</span>
                      </div>
                      <Globe className={`w-4 h-4 text-brand-slate/40 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                    <p className="text-xs text-brand-slate text-center">
                      {t('consultant.verified_msg')}
                    </p>
                  </div>
                </Card>
              </section>

              <Card className="bg-ink text-white border-none p-8" hover={false}>
                <h3 className="text-lg font-bold mb-4">{t('consultant.why_title')}</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {profile.name} {t('consultant.why_desc')}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
