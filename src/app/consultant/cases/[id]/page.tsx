'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, userService } from '@/src/lib/db';
import { ConsultationCase, UserProfile, ConsultationStatus, ConsultationStage } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  ArrowLeft, 
  MessageSquare, 
  User, 
  FileText, 
  Upload, 
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Target,
  DollarSign,
  Calendar,
  Save,
  Tag,
  Video
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';

import { useLanguage } from '@/src/context/LanguageContext';

export default function ConsultantCaseDetails() {
  const { profile, loading: authLoading } = useRoleGuard(['consultant', 'admin']);
  const { id: caseId } = useParams();
  const router = useRouter();
  const { t, isRTL, language } = useLanguage();
  const [consultation, setConsultation] = useState<ConsultationCase | null>(null);
  const [client, setClient] = useState<UserProfile | null>(null);
  const [updating, setUpdating] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingMeeting, setUploadingMeeting] = useState(false);

  useEffect(() => {
    if (caseId) {
      consultationService.getConsultation(caseId as string).then(async (data) => {
        setConsultation(data);
        if (data?.tags) setSelectedTags(data.tags);
        
        // Use data from consultation object for client profile
        if (data?.clientId) {
          setClient({
            uid: data.clientId,
            displayName: data.clientName || '',
            avatarUrl: data.clientAvatarUrl,
            role: 'client',
            email: '',
            createdAt: null
          } as UserProfile);
        }
      });
    }
  }, [caseId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseId) return;

    setUploading(true);
    try {
      const url = await consultationService.uploadReport(caseId as string, file);
      if (url) {
        setConsultation(prev => prev ? { ...prev, reportUrl: url, status: 'report_sent' } : null);
        toast.success(t('consultant.case_details.success_report'));
      }
    } catch (error) {
      toast.error(t('consultant.case_details.error_report'));
    } finally {
      setUploading(false);
    }
  };

  const handleMeetingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !caseId) return;

    setUploadingMeeting(true);
    try {
      const url = await consultationService.uploadMeetingRecording(caseId as string, file);
      if (url) {
        setConsultation(prev => prev ? { ...prev, meetingRecordingUrl: url } : null);
        toast.success(t('consultant.success_meeting_upload'));
      }
    } catch (error) {
      toast.error(t('consultant.error_meeting_upload'));
    } finally {
      setUploadingMeeting(false);
    }
  };

  const handleUpdateStatus = async (status: ConsultationStatus) => {
    if (!caseId) return;
    setUpdating(true);
    try {
      await consultationService.updateConsultation(caseId as string, { status });
      setConsultation(prev => prev ? { ...prev, status } : null);
      toast.success(t('consultant.case_details.success_status'));
    } catch (error) {
      toast.error(t('consultant.case_details.error_status'));
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStage = async (stage: ConsultationStage) => {
    if (!caseId) return;
    setUpdating(true);
    try {
      await consultationService.updateConsultation(caseId as string, { stage });
      setConsultation(prev => prev ? { ...prev, stage } : null);
      toast.success(t('consultant.case_details.success_stage'));
    } catch (error) {
      toast.error(t('consultant.case_details.error_stage'));
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveTags = async () => {
    if (!caseId) return;
    setUpdating(true);
    try {
      await consultationService.updateConsultation(caseId as string, { tags: selectedTags });
      toast.success(t('consultant.case_details.success_tags'));
    } catch (error) {
      toast.error(t('consultant.case_details.error_tags'));
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading || !consultation) return null;

  const stages: ConsultationStage[] = [
    'intake', 'need_analysis', 'shortlisting', 'comparison', 'meeting', 'final_recommendation', 'closure'
  ];

  const statuses: ConsultationStatus[] = [
    'assigned', 'active', 'waiting_for_client', 'waiting_for_consultant', 'report_sent', 'completed'
  ];

  const availableTags = [
    { id: 'Interested', label: t('consultant.tags.interested') },
    { id: 'Inquiry', label: t('consultant.tags.inquiry') },
    { id: 'Budget', label: t('consultant.tags.budget') },
    { id: 'Urgent', label: t('consultant.tags.urgent') },
    { id: 'Follow-up', label: t('consultant.tags.follow_up') },
    { id: 'Negotiation', label: t('consultant.tags.negotiation') },
    { id: 'Closed', label: t('consultant.tags.closed') },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="flex items-center text-gray-500 hover:text-black transition-colors">
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('consultant.case_details.back')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header Card */}
            <Card className="p-8 border-none shadow-sm" hover={false}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden relative">
                    {consultation.clientAvatarUrl ? (
                      <Image 
                        src={consultation.clientAvatarUrl} 
                        alt="Client" 
                        fill 
                        className="object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{client?.displayName || consultation.clientName || t('common.client')}</h1>
                    <p className="text-sm text-gray-500">{t('consultant.case_number')}{consultation.id.slice(-6)} • {t('consultant.started_on')} {formatDate(consultation.createdAt, language)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/cases/${caseId}/chat`}>
                    <Button variant="outline" className="h-12 rounded-xl">
                      <MessageSquare className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('consultant.case_details.chat')} {client?.displayName || consultation.clientName || t('common.client')}
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Status & Stage Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase">{t('consultant.case_details.status')}</label>
                  <select 
                    value={consultation.status}
                    onChange={(e) => handleUpdateStatus(e.target.value as ConsultationStatus)}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm font-medium"
                  >
                    {statuses.map(s => (
                      <option key={s} value={s}>{t(`status.${s}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 uppercase">{t('consultant.case_details.stage')}</label>
                  <select 
                    value={consultation.stage}
                    onChange={(e) => handleUpdateStage(e.target.value as ConsultationStage)}
                    disabled={updating}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all text-sm font-medium"
                  >
                    {stages.map(s => (
                      <option key={s} value={s}>{t(`stage.${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* Intake Data */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" /> {t('consultant.case_details.intake_form')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t('intake.goal_label')}</span>
                      <span className="text-sm font-bold capitalize">{t(`intake.goal_${consultation.intake.goal}`)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t('intake.area_label')}</span>
                      <span className="text-sm font-bold">{consultation.intake.preferredArea}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t('intake.budget_label')}</span>
                      <span className="text-sm font-bold">{consultation.intake.budgetRange}</span>
                    </div>
                  </div>
                </Card>
                <Card className="p-6 border-none shadow-sm" hover={false}>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t('intake.property_type_label')}</span>
                      <span className="text-sm font-bold">{consultation.intake.propertyType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t('intake.delivery_label')}</span>
                      <span className="text-sm font-bold">{consultation.intake.preferredDeliveryTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400 uppercase font-bold">{t('intake.projects_label')}</span>
                      <span className="text-sm font-bold">{consultation.intake.projectsInMind || t('common.na')}</span>
                    </div>
                  </div>
                </Card>
              </div>
              {consultation.intake.notes && (
                <Card className="mt-4 p-6 border-none shadow-sm" hover={false}>
                  <p className="text-xs text-gray-400 uppercase font-bold mb-2">{t('intake.notes_label')}</p>
                  <p className="text-sm text-gray-600 italic">&quot;{consultation.intake.notes}&quot;</p>
                </Card>
              )}
            </section>

            {/* Internal Notes */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Save className="w-5 h-5 text-gray-400" /> {t('consultant.case_details.internal_notes')}
              </h2>
              <Card className="p-6 border-none shadow-sm" hover={false}>
                <textarea 
                  rows={6}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder={t('consultant.case_details.notes_placeholder')}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all resize-none text-sm"
                />
                <div className={`mt-4 flex ${isRTL ? 'justify-start' : 'justify-end'}`}>
                  <Button variant="secondary" className="rounded-lg h-10">{t('consultant.case_details.save_notes')}</Button>
                </div>
              </Card>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Tags */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Tag className="w-5 h-5 text-gray-400" /> {t('consultant.case_details.tags')}
              </h2>
              <Card className="p-6 border-none shadow-sm" hover={false}>
                <div className="flex flex-wrap gap-2 mb-6">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (selectedTags.includes(tag.id)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag.id));
                        } else {
                          setSelectedTags([...selectedTags, tag.id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        selectedTags.includes(tag.id)
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
                <Button 
                  onClick={handleSaveTags} 
                  className="w-full h-10 text-sm rounded-xl"
                  loading={updating}
                >
                  {t('consultant.case_details.update_tags')}
                </Button>
              </Card>
            </section>

            {/* Report Upload */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Upload className="w-5 h-5 text-gray-400" /> {t('consultant.case_details.report_upload')}
              </h2>
              <Card className="p-6 border-none shadow-sm" hover={false}>
                {consultation.reportUrl ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold">{t('quality.case_audited')}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <a 
                        href={consultation.reportUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> {t('admin.case_details.view_chat_history')}
                      </a>
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                        <Button variant="outline" className="w-full h-10 text-sm rounded-xl" as="span">
                          {t('consultant.case_details.select_file')}
                        </Button>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="cursor-pointer block">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-gray-300 transition-all">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">{t('consultant.case_details.report_desc')}</p>
                      </div>
                      <Button className="w-full h-10 text-sm rounded-xl mt-4" as="span" loading={uploading}>
                        <Upload className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('consultant.case_details.select_file')}
                      </Button>
                    </label>
                  </div>
                )}
              </Card>
            </section>

            {/* Meeting Recording Upload */}
            <section>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Video className="w-5 h-5 text-gray-400" /> {t('consultant.case_details.meeting_upload')}
              </h2>
              <Card className="p-6 border-none shadow-sm" hover={false}>
                {consultation.meetingRecordingUrl ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-bold">{t('quality.meeting_recorded')}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <a 
                        href={consultation.meetingRecordingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <Video className="w-3 h-3" /> {t('quality.meeting_recording')}
                      </a>
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="video/*"
                          onChange={handleMeetingUpload}
                          disabled={uploadingMeeting}
                        />
                        <Button variant="outline" className="w-full h-10 text-sm rounded-xl" as="span">
                          {t('consultant.case_details.select_file')}
                        </Button>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="cursor-pointer block">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="video/*"
                        onChange={handleMeetingUpload}
                        disabled={uploadingMeeting}
                      />
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-gray-300 transition-all">
                        <Video className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">{t('consultant.case_details.meeting_desc')}</p>
                      </div>
                      <Button className="w-full h-10 text-sm rounded-xl mt-4" as="span" loading={uploadingMeeting}>
                        <Upload className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} /> {t('consultant.case_details.select_file')}
                      </Button>
                    </label>
                  </div>
                )}
              </Card>
            </section>

            {/* Case Closure */}
            <section>
              <Card className="p-6 bg-rose-50 border-rose-100 shadow-sm" hover={false}>
                <h3 className="text-lg font-bold text-rose-900 mb-2">{t('consultant.case_details.mark_completed')}</h3>
                <p className="text-xs text-rose-700 mb-6">
                  {t('consultant.case_details.mark_completed_desc')}
                </p>
                <Button 
                  variant="danger" 
                  className="w-full h-12 rounded-xl"
                  onClick={() => handleUpdateStatus('completed')}
                >
                  {t('consultant.case_details.mark_completed')}
                </Button>
              </Card>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
