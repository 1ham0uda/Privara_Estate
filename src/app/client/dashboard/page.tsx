'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, consultantService } from '@/src/lib/db';
import { ConsultationCase, ConsultantProfile } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  ChevronRight, 
  User, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Shield,
  Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import SupportModal from '@/src/components/SupportModal';
import RatingModal from '@/src/components/RatingModal';

export default function ClientDashboard() {
  const { t, isRTL, language } = useLanguage();
  const { profile, loading } = useRoleGuard(['client']);
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [consultants, setConsultants] = useState<Record<string, ConsultantProfile>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [selectedCaseForRating, setSelectedCaseForRating] = useState<ConsultationCase | null>(null);

  useEffect(() => {
    if (profile) {
      const unsubscribe = consultationService.subscribeToConsultations('client', profile.uid, (data) => {
        setCases(data);
        
        // Fetch consultant profiles for assigned cases
        data.forEach(async (c) => {
          if (c.consultantId) {
            setConsultants(prev => {
              if (prev[c.consultantId!]) return prev;
              
              // Fetch only if not in state
              consultantService.getConsultantProfile(c.consultantId!).then(cp => {
                if (cp) {
                  setConsultants(current => ({ ...current, [c.consultantId!]: cp }));
                }
              });
              return prev;
            });
          }
        });
      });
      return () => unsubscribe();
    }
  }, [profile]);

  const handleRatingSubmit = async (rating: number, feedback: string) => {
    if (!selectedCaseForRating) return;
    try {
      await consultationService.submitRating(selectedCaseForRating.id, rating, feedback);
      toast.success(t('client.success_feedback'));
      setIsRatingModalOpen(false);
      setSelectedCaseForRating(null);
    } catch (error) {
      toast.error(t('client.error_feedback'));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (profile?.status === 'deactivated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="max-w-md w-full p-8 text-center bg-white border-none shadow-xl" hover={false}>
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('auth.account_deactivated') || 'Account Deactivated'}
          </h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            {t('auth.account_deactivated_message') || 'Your account has been deactivated. Please contact support for more information.'}
          </p>
          <Button 
            className="w-full h-12 rounded-xl"
            onClick={() => setIsSupportModalOpen(true)}
          >
            {t('admin.dashboard.tab.support')}
          </Button>
          <SupportModal 
            isOpen={isSupportModalOpen}
            onClose={() => setIsSupportModalOpen(false)}
            userId={profile.uid}
            userName={profile.displayName || 'Client'}
            userEmail={profile.email}
            userRole={profile.role}
          />
        </Card>
      </div>
    );
  }

  const activeCase = cases.find(c => c.status !== 'completed');
  const history = cases.filter(c => c.status === 'completed');

  const filteredHistory = history.filter(c => 
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.intake.goal.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('client.welcome').replace('{name}', profile?.displayName || '')}</h1>
            <p className="text-gray-500 mt-1">{t('client.dashboard_subtitle')}</p>
          </div>
          {!activeCase && (
            <Link href="/client/new-consultation">
              <Button className="h-12 rounded-xl">
                <Plus className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('client.new_consultation')}
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Consultation */}
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> {t('client.active_consultation')}
              </h2>
              
              {activeCase ? (
                <Card className="p-0 overflow-hidden border-none shadow-sm">
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <Badge variant="info" className="mb-2 uppercase tracking-wider">
                          {activeCase.status.replace('_', ' ')}
                        </Badge>
                        <h3 className="text-2xl font-bold">{t('client.case_number')} {activeCase.id.slice(-6)}</h3>
                        <p className="text-gray-500">{t('client.started_on')} {formatDate(activeCase.createdAt, language)}</p>
                      </div>
                      <Link href={`/client/cases/${activeCase.id}`}>
                        <Button variant="outline" className="rounded-xl">{t('client.view_details')}</Button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-xs font-medium text-gray-400 uppercase mb-1">{t('client.current_stage')}</p>
                        <p className="font-bold text-gray-900 capitalize">{activeCase.stage.replace('_', ' ')}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <p className="text-xs font-medium text-gray-400 uppercase mb-1">{t('client.goal')}</p>
                        <p className="font-bold text-gray-900 capitalize">{activeCase.intake.goal}</p>
                      </div>
                    </div>

                    {activeCase.consultantId ? (
                      <div className="flex items-center justify-between p-4 bg-black text-white rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden relative">
                            {consultants[activeCase.consultantId]?.avatarUrl ? (
                              <Image 
                                src={consultants[activeCase.consultantId].avatarUrl!} 
                                alt="Consultant" 
                                fill 
                                className="object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">{t('client.assigned_consultant')}</p>
                            <p className="font-bold">{consultants[activeCase.consultantId]?.name || 'Loading...'}</p>
                          </div>
                        </div>
                        <Link href={`/cases/${activeCase.id}/chat`}>
                          <Button className="bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg text-sm">
                            <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('client.chat')}
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100">
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-sm font-medium">{t('client.waiting_assignment')}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="flex flex-col items-center justify-center py-16 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{t('client.no_active_title')}</h3>
                  <p className="text-gray-500 max-w-xs mx-auto mb-6">
                    {t('client.no_active_text')}
                  </p>
                  <Link href="/client/new-consultation">
                    <Button>{t('client.start_now')}</Button>
                  </Link>
                </Card>
              )}
            </section>

            {/* History */}
            <section>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-bold">{t('client.consultation_history')}</h2>
                <div className="relative flex-1 max-w-md">
                  <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`} />
                  <input 
                    type="text"
                    placeholder={t('client.find_consultation')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black shadow-sm`}
                  />
                </div>
              </div>

              {filteredHistory.length > 0 ? (
                <div className="space-y-4">
                  {filteredHistory.map(c => (
                    <Card key={c.id} className="flex items-center justify-between p-4 bg-white border-none shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-bold">{t('client.case_number')} {c.id.slice(-6)}</p>
                          <p className="text-xs text-gray-500">{formatDate(c.completedAt || c.updatedAt, language)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!c.rating && (
                          <Button 
                            variant="outline" 
                            className="text-xs h-8 rounded-lg"
                            onClick={() => {
                              setSelectedCaseForRating(c);
                              setIsRatingModalOpen(true);
                            }}
                          >
                            {t('client.rate')}
                          </Button>
                        )}
                        <Link href={`/client/cases/${c.id}`}>
                          <Button variant="ghost" className="p-2">
                            <ChevronRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : searchQuery ? (
                <Card className="py-12 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
                  <p className="text-gray-500">{t('client.no_history_search')}</p>
                </Card>
              ) : history.length === 0 ? (
                <Card className="py-12 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
                  <p className="text-gray-500">{t('client.no_history')}</p>
                </Card>
              ) : null}
            </section>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <Card className="bg-black text-white border-none p-8" hover={false}>
              <Shield className="w-10 h-10 mb-6 text-gray-400" />
              <h3 className="text-xl font-bold mb-4">{t('client.privacy_promise_title')}</h3>
              <ul className="space-y-4 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  <span>{t('client.privacy_promise_text')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  <span>{t('client.privacy_promise_text_2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                  <span>{t('client.privacy_promise_text_3')}</span>
                </li>
              </ul>
            </Card>

            <Card className="bg-white border-none shadow-sm p-8" hover={false}>
              <h3 className="text-lg font-bold mb-4">{t('client.need_help_title')}</h3>
              <p className="text-sm text-gray-500 mb-6">
                {t('client.need_help_text')}
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setIsSupportModalOpen(true)}
              >
                {t('client.contact_support')}
              </Button>
            </Card>
          </div>
        </div>
      </main>

      {profile && (
        <>
        <SupportModal 
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          userId={profile.uid}
          userName={profile.displayName || 'Client'}
          userEmail={profile.email}
          userRole={profile.role}
        />
        <RatingModal 
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          onSubmit={handleRatingSubmit}
        />
        </>
      )}
    </div>
  );
}
