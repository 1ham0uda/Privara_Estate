'use client';

import React, { useEffect, useState } from 'react';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, qualityService } from '@/src/lib/db';
import { ConsultationCase, QualityAuditReport } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  ClipboardCheck, 
  MessageSquare, 
  Mic, 
  Video, 
  ChevronRight,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { useLanguage } from '@/src/context/LanguageContext';
import SupportModal from '@/src/components/SupportModal';

export default function QualityDashboard() {
  const { t, isRTL, language } = useLanguage();
  const { profile, loading } = useRoleGuard(['quality']);
  const [cases, setCases] = useState<ConsultationCase[]>([]);
  const [reports, setReports] = useState<Record<string, QualityAuditReport[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'audited'>('all');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      const unsubscribe = consultationService.subscribeToConsultations('quality', profile.uid, (data) => {
        setCases(data);
        // Fetch reports for each case
        data.forEach(async (c) => {
          const caseReports = await qualityService.getAuditReports(c.id);
          setReports(prev => ({ ...prev, [c.id]: caseReports }));
        });
      });
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
            <Button variant="outline" className="w-full" as={Link} href="/quality/support">
              {t('support.open_tickets')}
            </Button>
          </div>
          {profile ? (
            <SupportModal
              isOpen={isSupportModalOpen}
              onClose={() => setIsSupportModalOpen(false)}
              userId={profile.uid}
              userName={profile.displayName}
              userEmail={profile.email}
              userRole={profile.role}
            />
          ) : null}
        </Card>
      </div>
    );
  }

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.consultantName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isAudited = reports[c.id] && reports[c.id].length > 0;
    
    if (filter === 'pending') return matchesSearch && !isAudited;
    if (filter === 'audited') return matchesSearch && isAudited;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">{t('quality.dashboard_title')}</h1>
            <p className="text-brand-slate mt-1">{t('quality.dashboard_subtitle')}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
              <input 
                type="text"
                placeholder={t('quality.search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-white border border-soft-blue rounded-xl text-sm text-ink placeholder:text-brand-slate focus:outline-none focus:border-blue-600 transition-all`}
              />
            </div>
            <Button variant="outline" as={Link} href="/quality/support">{t('admin.dashboard.tab.support')}</Button>
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-soft-blue">
              {(['all', 'pending', 'audited'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-blue-600 text-white shadow-md' : 'text-brand-slate hover:text-ink'}`}
                >
                  {t(`quality.filter_${f}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('quality.stats_assigned')}</p>
                <p className="text-2xl font-bold">{cases.length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('quality.stats_pending')}</p>
                <p className="text-2xl font-bold">{cases.filter(c => !reports[c.id] || reports[c.id].length === 0).length}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white border-none shadow-sm p-6" hover={false}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('quality.stats_completed')}</p>
                <p className="text-2xl font-bold">{Object.values(reports).flat().length}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredCases.length > 0 ? (
            filteredCases.map(c => {
              const caseReports = reports[c.id] || [];
              const isAudited = caseReports.length > 0;
              
              return (
                <Card key={c.id} className="p-6 bg-white border-none shadow-sm" hover={false}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center shrink-0">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900">{c.clientName}</h3>
                          <Badge variant={isAudited ? 'success' : 'warning'} className="text-[10px] uppercase">
                            {isAudited ? t('quality.case_audited') : t('quality.case_pending')}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          {t('quality.consultant')}: <span className="font-medium text-gray-700">{c.consultantName}</span>
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(c.createdAt, language)}
                          </span>
                          {c.meetingRecordingUrl && (
                            <span className="flex items-center gap-1 text-blue-500 font-medium">
                              <Video className="w-3 h-3" /> {t('quality.meeting_recorded')}
                            </span>
                          )}
                          {c.callRecordings && c.callRecordings.length > 0 && (
                            <span className="flex items-center gap-1 text-indigo-500 font-medium">
                              <Mic className="w-3 h-3" /> {c.callRecordings.length} {t('quality.calls_recorded')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Link href={`/quality/cases/${c.id}`}>
                        <Button className="h-11 px-8 rounded-xl shadow-lg shadow-blue-600/10">
                          {t('quality.review_case')} <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180 mr-2' : 'ml-2'}`} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="py-20 text-center bg-white border-dashed border-2 border-gray-200" hover={false}>
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">{t('quality.no_cases')}</p>
            </Card>
          )}
        </div>
      </main>
      {profile ? (
        <SupportModal
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          userId={profile.uid}
          userName={profile.displayName}
          userEmail={profile.email}
          userRole={profile.role}
        />
      ) : null}
    </div>
  );
}
