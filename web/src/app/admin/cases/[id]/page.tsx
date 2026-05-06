'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, userService, consultantService, qualityService } from '@/src/lib/db';
import { ConsultationCase, UserProfile, ChangeRequest, ConsultantProfile, QualityAuditReport } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  ArrowLeft, 
  MessageSquare, 
  User, 
  FileText, 
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Target,
  DollarSign,
  Calendar,
  RefreshCw,
  ClipboardCheck,
  Shield
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Link from 'next/link';

import { useLanguage } from '@/src/context/LanguageContext';

export default function AdminCaseDetails() {
  const { profile, loading: authLoading } = useRoleGuard(['admin']);
  const { id: caseId } = useParams();
  const router = useRouter();
  const { t, isRTL, language } = useLanguage();
  const [consultation, setConsultation] = useState<ConsultationCase | null>(null);
  const [client, setClient] = useState<UserProfile | null>(null);
  const [consultant, setConsultant] = useState<UserProfile | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [allConsultants, setAllConsultants] = useState<ConsultantProfile[]>([]);
  const [allQuality, setAllQuality] = useState<UserProfile[]>([]);
  const [auditReports, setAuditReports] = useState<QualityAuditReport[]>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState('');
  const [selectedQualityId, setSelectedQualityId] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  const [isAssigningQuality, setIsAssigningQuality] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  useEffect(() => {
    if (caseId) {
      consultationService.getConsultation(caseId as string).then(async (data) => {
        setConsultation(data);
        if (data?.clientId) {
          const cp = await userService.getUserProfile(data.clientId);
          setClient(cp);
        }
        if (data?.consultantId) {
          const con = await userService.getUserProfile(data.consultantId);
          setConsultant(con);
        }
      });

      consultationService.getChangeRequests(caseId as string).then(setChangeRequests);
      consultantService.getAllConsultants().then(setAllConsultants);
      qualityService.getAllQualitySpecialists().then(setAllQuality);
      qualityService.getAuditReports(caseId as string).then(setAuditReports);
    }
  }, [caseId]);

  useEffect(() => {
    if (consultation?.intake.selectedConsultantUid && !consultation.consultantId) {
      setSelectedConsultantId(consultation.intake.selectedConsultantUid);
    }
  }, [consultation?.id, consultation?.consultantId, consultation?.intake.selectedConsultantUid]);

  const handleAssignQuality = async () => {
    if (!selectedQualityId) {
      toast.error(t('admin.case_details.select_quality_first'));
      return;
    }

    const specialist = allQuality.find(q => q.uid === selectedQualityId);
    if (!specialist) return;

    setIsAssigningQuality(true);
    try {
      await consultationService.assignQualitySpecialist(
        caseId as string,
        selectedQualityId,
        specialist.displayName || 'Quality Specialist'
      );
      toast.success(t('admin.dashboard.case.reassigned_success'));

      const updated = await consultationService.getConsultation(caseId as string);
      setConsultation(updated);
    } catch (error) {
      toast.error(t('admin.case_details.assign_quality_failed'));
    } finally {
      setIsAssigningQuality(false);
    }
  };

  const handleReassign = async (requestId?: string) => {
    if (!selectedConsultantId) {
      toast.error(t('admin.case_details.select_consultant_first'));
      return;
    }

    const newConsultant = allConsultants.find(c => c.uid === selectedConsultantId);
    if (!newConsultant) return;

    setIsReassigning(true);
    try {
      await consultationService.reassignConsultant(
        caseId as string,
        selectedConsultantId,
        newConsultant.name,
        requestId
      );
      toast.success(t('admin.dashboard.case.reassigned_success'));
      
      const updated = await consultationService.getConsultation(caseId as string);
      setConsultation(updated);
      if (updated?.consultantId) {
        const con = await userService.getUserProfile(updated.consultantId);
        setConsultant(con);
      }
      const updatedRequests = await consultationService.getChangeRequests(caseId as string);
      setChangeRequests(updatedRequests);
    } catch (error) {
      toast.error(t('admin.case_details.reassign_failed'));
    } finally {
      setIsReassigning(false);
    }
  };

  const handleMarkPaymentPaid = async () => {
    if (!caseId || consultation?.paymentStatus === 'paid') return;

    setIsMarkingPaid(true);
    try {
      await consultationService.updateConsultation(caseId as string, { paymentStatus: 'paid' });
      setConsultation(prev => prev ? { ...prev, paymentStatus: 'paid' } : prev);
      toast.success(t('admin.case_details.payment_marked_paid'));
    } catch (error) {
      toast.error(t('admin.case_details.payment_mark_paid_failed'));
    } finally {
      setIsMarkingPaid(false);
    }
  };

  if (authLoading || !consultation) return null;

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`flex items-center justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button 
            onClick={() => router.back()} 
            className={`flex items-center text-brand-slate hover:text-ink transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('common.back')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-8 border-none shadow-sm" hover={false}>
              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : 'text-left'}>
                  <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Badge variant="info" className="uppercase tracking-wider">
                      {t(`case.status.${consultation.status}`)}
                    </Badge>
                    <span className="text-sm text-brand-slate">{t('dashboard.case_number')}{consultation.id.slice(-6)}</span>
                  </div>
                  <h1 className="text-3xl font-bold text-ink">{t('admin.case_details.overview')}</h1>
                  <p className="text-brand-slate">{t('admin.case_details.overview_subtitle')}</p>
                </div>
                <Link href={`/cases/${caseId}/chat`}>
                  <Button variant="outline" className={`h-12 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <MessageSquare className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('admin.case_details.view_chat_history')}
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-t border-soft-blue">
                <div className={`p-4 bg-cloud rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-xs font-bold text-brand-slate uppercase mb-1">{t('dashboard.status')}</p>
                  <p className="font-bold text-ink capitalize">{t(`case.status.${consultation.status}`)}</p>
                </div>
                <div className={`p-4 bg-cloud rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-xs font-bold text-brand-slate uppercase mb-1">{t('dashboard.stage')}</p>
                  <p className="font-bold text-ink capitalize">{t(`dashboard.stage_${consultation.stage}`)}</p>
                </div>
                <div className={`p-4 bg-cloud rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="text-xs font-bold text-brand-slate uppercase mb-1">{t('dashboard.payment_status')}</p>
                  <p className={`font-bold capitalize ${consultation.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{t(`payment.status.${consultation.paymentStatus}`)}</p>
                  {consultation.paymentStatus !== 'paid' ? (
                    <Button size="sm" className="mt-3 w-full text-xs" onClick={handleMarkPaymentPaid} loading={isMarkingPaid}>
                      {t('admin.case_details.mark_payment_paid')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>

            {/* Reassignment Requests */}
            {changeRequests.some(r => r.status === 'pending') && (
              <section>
                <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 text-rose-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <RefreshCw className="w-5 h-5" /> {t('admin.case_details.reassignment_request')}
                </h2>
                {changeRequests.filter(r => r.status === 'pending').map(request => (
                  <Card key={request.id} className="p-8 border-rose-100 bg-rose-50/30 mb-4" hover={false}>
                    <div className={`flex items-start gap-4 mb-6 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-6 h-6 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-sm text-brand-slate mb-1">{t('admin.case_details.reason_for_request')}</p>
                        <p className="text-ink font-medium italic">&quot;{request.reason}&quot;</p>
                        <p className="text-xs text-brand-slate mt-2">{t('admin.case_details.requested_on')} {formatDate(request.createdAt, language)}</p>
                      </div>
                    </div>

                    <div className={`flex flex-col md:flex-row gap-4 items-end ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                      <div className={`flex-1 w-full ${isRTL ? 'text-right' : ''}`}>
                        <label className="block text-xs font-bold text-brand-slate uppercase mb-2">{t('admin.case_details.select_new_consultant')}</label>
                        <select 
                          className="w-full h-12 px-4 rounded-xl border border-soft-blue bg-white focus:ring-2 focus:ring-blue-600 outline-none"
                          value={selectedConsultantId}
                          onChange={(e) => setSelectedConsultantId(e.target.value)}
                          dir={isRTL ? 'rtl' : 'ltr'}
                        >
                          <option value="">{t('admin.case_details.choose_consultant')}</option>
                          {allConsultants.filter(c => c.uid !== consultation.consultantId).map(c => (
                            <option key={c.uid} value={c.uid}>
                              {c.name} ({c.experienceYears}y exp){consultation.intake.selectedConsultantUid === c.uid ? ` • ${t('intake.requested_consultant_short')}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button 
                        onClick={() => handleReassign(request.id)}
                        disabled={isReassigning}
                        className="h-12 px-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-none"
                      >
                        {isReassigning ? t('admin.case_details.reassigning') : t('admin.case_details.approve_reassign')}
                      </Button>
                    </div>
                  </Card>
                ))}
              </section>
            )}

            <section>
              <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <FileText className="w-5 h-5 text-brand-slate" /> {t('admin.case_details.intake_info')}
              </h2>
              <Card className="p-8 border-none shadow-sm" hover={false}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm text-brand-slate">{t('admin.case_details.goal')}</span>
                      <span className="text-sm font-bold capitalize">{t(`intake.goal_${consultation.intake.goal}`)}</span>
                    </div>
                    <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm text-brand-slate">{t('admin.case_details.preferred_area')}</span>
                      <span className="text-sm font-bold">{consultation.intake.preferredArea}</span>
                    </div>
                    <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm text-brand-slate">{t('admin.case_details.budget_range')}</span>
                      <span className="text-sm font-bold">{consultation.intake.budgetRange}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm text-brand-slate">{t('admin.case_details.property_type')}</span>
                      <span className="text-sm font-bold">{consultation.intake.propertyType}</span>
                    </div>
                    <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm text-brand-slate">{t('admin.case_details.delivery_time')}</span>
                      <span className="text-sm font-bold">{consultation.intake.preferredDeliveryTime}</span>
                    </div>
                  </div>
                </div>
                {consultation.intake.notes && (
                  <div className="mt-8 pt-8 border-t border-soft-blue">
                    <p className={`text-sm text-brand-slate mb-2 font-bold uppercase ${isRTL ? 'text-right' : ''}`}>{t('admin.case_details.additional_notes')}</p>
                    <p className={`text-sm text-brand-slate italic ${isRTL ? 'text-right' : ''}`}>&quot;{consultation.intake.notes}&quot;</p>
                  </div>
                )}
              </Card>
            </section>

            {/* Quality Audit Reports */}
            {auditReports.length > 0 && (
              <section>
                <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 text-emerald-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <ClipboardCheck className="w-5 h-5" /> {t('admin.case_details.audit_reports')}
                </h2>
                <div className="space-y-4">
                  {auditReports.map(report => (
                    <Card key={report.id} className="p-6 border-emerald-100 bg-emerald-50/30" hover={false}>
                      <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Badge variant={report.classification === 'critical' ? 'error' : 'success'}>
                            {report.classification === 'critical' ? t('dashboard.critical') : t('dashboard.non_critical')}
                          </Badge>
                        </div>
                        <span className="text-xs text-brand-slate">{formatDate(report.createdAt, language)}</span>
                      </div>
                      <p className={`text-sm text-brand-slate whitespace-pre-wrap mb-4 ${isRTL ? 'text-right' : ''}`}>{report.notes}</p>
                      <div className={`flex items-center gap-2 text-[10px] text-brand-slate ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Shield className="w-3 h-3" /> {t('admin.case_details.audited_by')}: {report.specialistName}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-8">
            <section>
              <h2 className={`text-xl font-bold mb-6 ${isRTL ? 'text-right' : ''}`}>{t('admin.case_details.participants')}</h2>
              <Card className="p-6 border-none shadow-sm space-y-6" hover={false}>
                <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-brand-slate/40" />
                  </div>
                  <div>
                    <p className="text-xs text-brand-slate font-bold uppercase">{t('admin.case_details.client')}</p>
                    <p className="font-bold">{client?.displayName || consultation.clientName || t('common.loading')}</p>
                    <p className="text-xs text-brand-slate">{client?.email}</p>
                  </div>
                </div>
                {consultation.intake.selectedConsultantName ? (
                  <div className={`flex items-center gap-4 pt-6 border-t border-soft-blue ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-brand-slate font-bold uppercase">{t('intake.requested_consultant_label')}</p>
                      <p className="font-bold">{consultation.intake.selectedConsultantName}</p>
                      <div className={`mt-2 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {consultation.intake.selectedConsultantUid ? (
                          <Link href={`/consultants/${consultation.intake.selectedConsultantUid}`} className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2">
                            {t('intake.view_consultant_profile')}
                          </Link>
                        ) : null}
                        {!consultation.consultantId && consultation.intake.selectedConsultantUid === selectedConsultantId ? (
                          <span className="text-xs text-emerald-600 font-medium">{t('intake.requested_consultant_prefill')}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className={`flex items-center gap-4 pt-6 border-t border-soft-blue ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-brand-slate/40" />
                  </div>
                  <div>
                    <p className="text-xs text-brand-slate font-bold uppercase">{t('admin.case_details.assigned_consultant')}</p>
                    <p className="font-bold">{consultant?.displayName || consultation.consultantName || t('dashboard.unassigned')}</p>
                    <p className="text-xs text-brand-slate">{consultant?.email || 'N/A'}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-4 pt-6 border-t border-soft-blue ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="w-12 h-12 bg-soft-blue rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-brand-slate/40" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-brand-slate font-bold uppercase">{t('admin.case_details.quality_specialist')}</p>
                    {consultation.qualitySpecialistId ? (
                      <>
                        <p className="font-bold">{consultation.qualitySpecialistName}</p>
                        <p className="text-xs text-brand-slate">{allQuality.find(q => q.uid === consultation.qualitySpecialistId)?.email || 'N/A'}</p>
                      </>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <select 
                          className="w-full text-xs p-2 rounded-lg border border-soft-blue"
                          value={selectedQualityId}
                          onChange={(e) => setSelectedQualityId(e.target.value)}
                          dir={isRTL ? 'rtl' : 'ltr'}
                        >
                          <option value="">{t('admin.case_details.select_quality')}</option>
                          {allQuality.map(q => (
                            <option key={q.uid} value={q.uid}>{q.displayName}</option>
                          ))}
                        </select>
                        <Button 
                          size="sm" 
                          className="w-full text-[10px]" 
                          onClick={handleAssignQuality}
                          loading={isAssigningQuality}
                        >
                          {t('admin.case_details.assign_specialist')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </section>

            <section>
              <h2 className={`text-xl font-bold mb-6 ${isRTL ? 'text-right' : ''}`}>{t('admin.case_details.admin_logs')}</h2>
              <Card className="p-6 border-none shadow-sm" hover={false}>
                <div className="space-y-4">
                  <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${consultation.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <div className="text-xs">
                      <p className="font-bold">{consultation.paymentStatus === 'paid' ? t('admin.case_details.payment_confirmed') : t('admin.case_details.payment_pending')}</p>
                      <p className="text-brand-slate">{formatDate(consultation.createdAt, language)}</p>
                    </div>
                  </div>
                  {consultation.consultantId && (
                    <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                      <div className="text-xs">
                        <p className="font-bold">{t('admin.case_details.consultant_assigned')}</p>
                        <p className="text-brand-slate">{formatDate(consultation.updatedAt, language)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
