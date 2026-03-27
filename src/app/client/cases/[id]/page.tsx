'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, consultantService } from '@/src/lib/db';
import { ConsultationCase, ConsultantProfile } from '@/src/types';
import { Card, Badge, Button, Input } from '@/src/components/UI';
import { 
  ArrowLeft, 
  MessageSquare, 
  User, 
  FileText, 
  Download, 
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Target,
  DollarSign,
  Calendar,
  Building2,
  Star
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'motion/react';

import { useLanguage } from '@/src/context/LanguageContext';

export default function CaseDetails() {
  const { t, isRTL, language } = useLanguage();
  const { profile, loading: authLoading } = useRoleGuard(['client', 'consultant', 'admin']);
  const { id: caseId } = useParams();
  const router = useRouter();
  const [consultation, setConsultation] = useState<ConsultationCase | null>(null);
  const [consultant, setConsultant] = useState<ConsultantProfile | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const [showReassignmentModal, setShowReassignmentModal] = useState(false);
  const [reassignmentReason, setReassignmentReason] = useState('');
  const [isSubmittingReassignment, setIsSubmittingReassignment] = useState(false);

  useEffect(() => {
    if (caseId) {
      consultationService.getConsultation(caseId as string).then(async (data) => {
        setConsultation(data);
        if (data?.consultantId) {
          const cp = await consultantService.getConsultantProfile(data.consultantId);
          setConsultant(cp);
        }
      });
    }
  }, [caseId]);

  const handleRatingSubmit = async () => {
    if (rating === 0) {
      toast.error(t('client.error_rating'));
      return;
    }
    setSubmittingRating(true);
    try {
      await consultationService.submitRating(caseId as string, rating, feedback);
      toast.success(t('client.success_feedback'));
      // Refresh consultation data
      const updated = await consultationService.getConsultation(caseId as string);
      setConsultation(updated);
    } catch (error) {
      toast.error(t('client.error_feedback'));
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleReassignmentRequest = async () => {
    if (!reassignmentReason.trim()) {
      toast.error(t('client.error_reason'));
      return;
    }
    setIsSubmittingReassignment(true);
    try {
      await consultationService.requestConsultantChange(
        caseId as string,
        profile!.uid,
        consultation!.consultantId!,
        reassignmentReason
      );
      toast.success(t('client.success_reassignment'));
      setShowReassignmentModal(false);
      // Refresh consultation data
      const updated = await consultationService.getConsultation(caseId as string);
      setConsultation(updated);
    } catch (error) {
      toast.error(t('client.error_reassignment'));
    } finally {
      setIsSubmittingReassignment(false);
    }
  };

  if (authLoading || !consultation) return null;

  const stages = [
    'intake', 'need_analysis', 'shortlisting', 'comparison', 'meeting', 'final_recommendation', 'closure'
  ];

  const currentStageIndex = stages.indexOf(consultation.stage);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <button onClick={() => router.back()} className="inline-flex items-center text-sm text-gray-500 hover:text-black transition-colors">
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('client.case.back')}
          </button>
          
          <div className="relative">
            <button onClick={() => setShowOptions(!showOptions)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {showOptions && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-10 py-2">
                <button 
                  onClick={() => {
                    setShowOptions(false);
                    setShowReassignmentModal(true);
                  }}
                  disabled={consultation.reassignmentRequestStatus === 'pending' || !consultation.consultantId}
                  className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {consultation.reassignmentRequestStatus === 'pending' ? t('client.case.request_pending') : t('client.case.request_consultant_change')}
                </button>
                <button
                  onClick={() => {
                    setShowOptions(false);
                    toast.success(t('client.case.issue_redirected'));
                    router.push('/client/support');
                  }}
                  className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t('dashboard.report_issue')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Header Card */}
            <Card className="p-4 sm:p-6 border-none shadow-sm" hover={false}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-5 sm:mb-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="info" className="uppercase tracking-wider">
                      {consultation.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-gray-400">Case #{consultation.id.slice(-6)}</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{t('client.case.title')}</h1>
                  <p className="text-sm sm:text-base text-gray-500">{t('consultant.started_on')} {formatDate(consultation.createdAt, language)}</p>
                </div>
                <Link href={`/cases/${caseId}/chat`}>
                  <Button className="h-10 sm:h-12 rounded-xl px-4 sm:px-6 w-full sm:w-auto text-sm">
                    <MessageSquare className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('client.case.open_chat')}
                  </Button>
                </Link>
              </div>

              {/* Progress Tracker */}
              <div className="mt-2">
                <div className="flex items-center justify-between gap-3 mb-3 sm:hidden">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{t('client.case.title')}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{consultation.stage.replace('_', ' ')}</p>
                  </div>
                  <Badge variant="info" className="text-[11px] uppercase tracking-wide">{currentStageIndex + 1}/{stages.length}</Badge>
                </div>

                <div className="overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="relative min-w-[620px] pt-6 pb-4 px-1">
                    <div className="absolute top-[1.9rem] left-2 right-2 h-1 bg-gray-100 rounded-full" />
                    <div 
                      className="absolute top-[1.9rem] left-2 h-1 bg-black rounded-full transition-all duration-500"
                      style={{ width: `calc(${Math.max(currentStageIndex, 0) / (stages.length - 1) * 100}% - 8px)` }}
                    />
                    <div className="relative flex justify-between gap-5">
                      {stages.map((s, i) => (
                        <div key={s} className="flex min-w-[78px] flex-col items-center text-center">
                          <div className={`w-4 h-4 rounded-full border-[3px] ${
                            i <= currentStageIndex ? 'bg-black border-black' : 'bg-white border-gray-200'
                          } z-10`} />
                          <span className={`mt-2 text-[10px] sm:text-[11px] font-semibold uppercase leading-4 tracking-tight ${
                            i === currentStageIndex ? 'text-black' : 'text-gray-400'
                          }`}>
                            {s.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Rating Section */}
            {consultation.status === 'report_sent' && !consultation.rating && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-4 sm:p-6 border-indigo-100 bg-indigo-50/30" hover={false}>
                  <div className="text-center max-w-md mx-auto">
                    <Star className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-600 mx-auto mb-4" />
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('rating.title')}</h2>
                    <p className="text-gray-600 mb-6">{t('dashboard.feedback_help')}</p>
                    
                    <div className="flex justify-center gap-2 mb-6">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`p-2 transition-transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          <Star className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                        </button>
                      ))}
                    </div>

                    <Input
                      placeholder={t('rating.feedback_placeholder')}
                      value={feedback}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFeedback(e.target.value)}
                      className="mb-6"
                    />

                    <Button 
                      onClick={handleRatingSubmit}
                      disabled={submittingRating}
                      className="w-full h-12 rounded-xl"
                    >
                      {submittingRating ? t('common.loading') : t('rating.submit')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {consultation.rating && (
              <Card className="p-6 bg-gray-50 border-none" hover={false}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">{t('rating.title')}</h3>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-4 h-4 ${consultation.rating! >= star ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                </div>
                {consultation.feedback && (
                  <p className="text-gray-600 italic">&quot;{consultation.feedback}&quot;</p>
                )}
              </Card>
            )}

            {/* Intake Details */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" /> Intake Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Target className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Goal</p>
                        <p className="font-bold capitalize">{consultation.intake.goal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Preferred Area</p>
                        <p className="font-bold">{consultation.intake.preferredArea}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Budget Range</p>
                        <p className="font-bold">{consultation.intake.budgetRange}</p>
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Property Type</p>
                        <p className="font-bold">{consultation.intake.propertyType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">Delivery Time</p>
                        <p className="font-bold">{consultation.intake.preferredDeliveryTime}</p>
                      </div>
                    </div>
                    {consultation.intake.projectsInMind && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-bold">Projects in Mind</p>
                          <p className="font-bold">{consultation.intake.projectsInMind}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
              {consultation.intake.notes && (
                <Card className="mt-4 p-6 border-none shadow-sm" hover={false}>
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">Additional Notes</p>
                  <p className="text-gray-600 italic">&quot;{consultation.intake.notes}&quot;</p>
                </Card>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Consultant Card */}
            <section>
              <h2 className="text-xl font-bold mb-6">Your Consultant</h2>
              {consultant ? (
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-gray-100 rounded-2xl mb-4 overflow-hidden">
                      {consultant.avatarUrl ? (
                        <div className="w-full h-full relative">
                          <Image 
                            src={consultant.avatarUrl} 
                            alt={consultant.name} 
                            fill 
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-bold">{consultant.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{consultant.experienceYears} Years Experience</p>
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {consultant.specialties.slice(0, 3).map(s => (
                        <Badge key={s} variant="default" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                    <Link href={`/consultants/${consultant.uid}`} className="w-full">
                      <Button variant="outline" className="w-full rounded-xl">View Profile</Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 sm:p-6 text-center bg-gray-50 border-dashed border-2 border-gray-200" hover={false}>
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm text-gray-500">{t('client.case.assignment_in_progress')}</p>
                  {consultation.intake.selectedConsultantName ? (
                    <div className="mt-4 rounded-xl bg-white border border-gray-100 p-4 text-left">
                      <p className="text-xs text-gray-400 uppercase font-bold mb-1">{t('intake.requested_consultant_label')}</p>
                      <p className="font-bold text-gray-900">{consultation.intake.selectedConsultantName}</p>
                      {consultation.intake.selectedConsultantUid ? (
                        <Link href={`/consultants/${consultation.intake.selectedConsultantUid}`} className="inline-flex mt-3 text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2">
                          {t('intake.view_consultant_profile')}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              )}
            </section>

            {/* Report Card */}
            <section>
              <h2 className="text-xl font-bold mb-6">{t('client.case.report_ready')}</h2>
              {consultation.reportUrl ? (
                <Card className="p-6 bg-emerald-50 border-emerald-100 shadow-sm" hover={false}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900">{t('client.case.report_ready')}</p>
                      <p className="text-xs text-emerald-600">PDF Document • 2.4 MB</p>
                    </div>
                  </div>
                  <a href={consultation.reportUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-xl">
                      <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('client.case.download_report')}
                    </Button>
                  </a>
                </Card>
              ) : (
                <Card className="p-6 bg-gray-50 border-none shadow-sm" hover={false}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-500">
                      {t('client.case.report_pending')}
                    </p>
                  </div>
                </Card>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Reassignment Modal */}
      {showReassignmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6"
          >
            <h2 className="text-2xl font-bold mb-4">{t('client.case.reassignment_title')}</h2>
            <p className="text-gray-600 mb-6">
              {t('client.case.reassignment_desc')}
            </p>
            
            <textarea
              className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-black focus:border-transparent mb-6 resize-none"
              placeholder={t('client.case.reassignment_placeholder')}
              value={reassignmentReason}
              onChange={(e) => setReassignmentReason(e.target.value)}
            />

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl"
                onClick={() => setShowReassignmentModal(false)}
              >
                {t('common.back')}
              </Button>
              <Button 
                className="flex-1 rounded-xl"
                onClick={handleReassignmentRequest}
                disabled={isSubmittingReassignment}
              >
                {isSubmittingReassignment ? t('common.loading') : t('client.case.send_request')}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
