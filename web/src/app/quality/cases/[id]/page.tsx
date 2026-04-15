'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, chatService, qualityService } from '@/src/lib/db';
import { callService } from '@/src/lib/callService';
import { CallSession, ConsultationCase, Message, QualityAuditReport } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  ChevronLeft, 
  MessageSquare, 
  Mic, 
  Video, 
  Play, 
  Pause, 
  Download,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';
import { formatDate } from '@/src/lib/utils';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import { useLanguage } from '@/src/context/LanguageContext';
import Image from 'next/image';

export default function QualityCaseReview() {
  const { t, isRTL, language } = useLanguage();
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { profile, loading } = useRoleGuard(['quality', 'admin']);
  
  const [consultation, setConsultation] = useState<ConsultationCase | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reports, setReports] = useState<QualityAuditReport[]>([]);
  const [recordedCalls, setRecordedCalls] = useState<CallSession[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'recordings' | 'audit'>('chat');
  
  const [auditForm, setAuditForm] = useState({
    classification: 'non-critical' as 'critical' | 'non-critical',
    notes: '',
    meetingStatus: 'recorded' as 'recorded' | 'not-recorded' | 'failed'
  });
  const [submitting, setSubmitting] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    if (profile && id) {
      const unsubConsultation = consultationService.subscribeToConsultation(id, (data) => {
        if (data) setConsultation(data);
      });
      
      const unsubMessages = chatService.subscribeToMessages(id, (data) => {
        setMessages(data);
      });
      
      const fetchReports = async () => {
        const r = await qualityService.getAuditReports(id);
        setReports(r);
      };
      fetchReports();

      const unsubCalls = callService.subscribeToCallHistory(id, (calls) => {
        setRecordedCalls(calls.filter((call) => Boolean(call.recordingUrl)));
      });
      
      return () => {
        unsubConsultation();
        unsubMessages();
        unsubCalls();
      };
    }
  }, [profile, id]);

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !consultation) return;
    
    setSubmitting(true);
    try {
      await qualityService.submitAuditReport({
        caseId: id,
        specialistId: profile.uid,
        specialistName: profile.displayName || 'Quality Specialist',
        classification: auditForm.classification,
        notes: auditForm.notes,
        meetingStatus: auditForm.meetingStatus,
        status: 'completed'
      });
      toast.success(t('quality.success_submit'));
      const r = await qualityService.getAuditReports(id);
      setReports(r);
      setActiveTab('audit');
    } catch (error) {
      toast.error(t('quality.error_submit'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAudio = (url: string) => {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingAudio(url);
      }
    }
  };

  if (loading || !consultation) return null;

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-black mb-8 transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} /> {t('common.back')}
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('quality.case_review_title')}</h1>
            <p className="text-gray-500 mt-1">{consultation.clientName} • {consultation.consultantName}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
            {(['chat', 'recordings', 'audit'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
              >
                {t(`quality.tab_${tab}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {activeTab === 'chat' && (
            <Card className="p-0 border-none shadow-sm bg-white overflow-hidden" hover={false}>
              <div className="p-6 border-bottom border-gray-100 bg-gray-50/50">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-500" /> {t('quality.chat_history')}
                </h2>
              </div>
              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                {messages.length > 0 ? (
                  messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.senderId === consultation.clientId ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">{m.senderName}</span>
                        <span className="text-[10px] text-gray-400 px-1">{formatDate(m.createdAt, language)}</span>
                      </div>
                      <div className={`max-w-[80%] p-4 rounded-2xl ${m.senderId === consultation.clientId ? 'bg-gray-100 text-gray-900 rounded-tl-none' : 'bg-black text-white rounded-tr-none'}`}>
                        {(m.type === 'text' || m.type === 'meeting_request' || m.type === 'meeting_link' || m.type === 'call_log') && (
                          <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                        )}
                        {m.type === 'image' && m.imageUrl && (
                          <div className="relative w-64 h-64 rounded-lg overflow-hidden mt-2">
                            <Image 
                              src={m.imageUrl} 
                              alt="Chat image" 
                              fill 
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        {m.type === 'audio' && m.audioUrl && (
                          <div className="flex items-center gap-3 mt-2">
                            <button 
                              onClick={() => toggleAudio(m.audioUrl!)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${m.senderId === consultation.clientId ? 'bg-white text-black shadow-sm' : 'bg-white/20 text-white'}`}
                            >
                              {playingAudio === m.audioUrl ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <span className="text-xs font-medium">{t('quality.voice_note')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-gray-400">
                    <p>{t('quality.no_messages')}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'recordings' && (
            <div className="space-y-8">
              {/* Meeting Recording */}
              <Card className="p-8 border-none shadow-sm bg-white" hover={false}>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Video className="w-6 h-6 text-blue-500" /> {t('quality.meeting_recording')}
                </h2>
                {consultation.meetingRecordingUrl ? (
                  <div className="space-y-4">
                    <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
                      <video 
                        src={consultation.meetingRecordingUrl} 
                        controls 
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex justify-end">
                      <a 
                        href={consultation.meetingRecordingUrl} 
                        download 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-500 font-medium hover:underline"
                      >
                        <Download className="w-4 h-4" /> {t('quality.download')}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center bg-gray-50 rounded-2xl border-dashed border-2 border-gray-200">
                    <p className="text-gray-400">{t('quality.no_meeting')}</p>
                  </div>
                )}
              </Card>

              {/* Call Recordings */}
              <Card className="p-8 border-none shadow-sm bg-white" hover={false}>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Mic className="w-6 h-6 text-indigo-500" /> {t('quality.call_recordings')}
                </h2>
                {consultation.callRecordings && consultation.callRecordings.length > 0 ? (
                  <div className="space-y-4">
                    {consultation.callRecordings.map((url, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Mic className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{t('quality.call_number')} {idx + 1}</p>
                            <p className="text-[10px] text-gray-400">{t('quality.recorded_call')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleAudio(url)}
                            className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-lg shadow-black/20 hover:scale-105 transition-transform"
                          >
                            {playingAudio === url ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </button>
                          <a href={url} download target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-black">
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center bg-gray-50 rounded-2xl border-dashed border-2 border-gray-200">
                    <p className="text-gray-400">{t('quality.no_calls')}</p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-8">
              {/* Existing Reports */}
              {reports.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ClipboardCheck className="w-6 h-6 text-emerald-500" /> {t('quality.audit_reports')}
                  </h2>
                  <div className="space-y-4">
                    {reports.map((r) => (
                      <Card key={r.id} className="p-6 bg-white border-none shadow-sm" hover={false}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Badge variant={r.classification === 'critical' ? 'error' : 'success'}>
                              {r.classification === 'critical' ? t('dashboard.critical') : t('dashboard.non_critical')}
                            </Badge>
                            <Badge variant="info">{t('quality.label_meeting_status')}: {t(`quality.meeting_${r.meetingStatus.replace('-', '_')}`)}</Badge>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(r.createdAt, language)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{r.notes}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <FileText className="w-3 h-3" /> {t('quality.audited_by')}: {r.specialistName}
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* New Audit Form */}
              {profile?.role === 'quality' && (
                <Card className="p-8 border-none shadow-sm bg-white" hover={false}>
                  <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-black" /> {t('quality.new_audit_report')}
                  </h2>
                  <form onSubmit={handleSubmitAudit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-3">{t('quality.label_classification')}</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setAuditForm({...auditForm, classification: 'non-critical'})}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${auditForm.classification === 'non-critical' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> {t('dashboard.non_critical')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuditForm({...auditForm, classification: 'critical'})}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${auditForm.classification === 'critical' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}
                          >
                            <XCircle className="w-4 h-4" /> {t('dashboard.critical')}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-3">{t('quality.label_meeting_status')}</label>
                        <select 
                          value={auditForm.meetingStatus}
                          onChange={(e) => setAuditForm({...auditForm, meetingStatus: e.target.value as any})}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-black focus:outline-none"
                        >
                          <option value="recorded">{t('quality.meeting_recorded_success')}</option>
                          <option value="not-recorded">{t('quality.meeting_not_recorded')}</option>
                          <option value="failed">{t('quality.meeting_failed')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-3">{t('quality.label_audit_notes')}</label>
                      <textarea 
                        required
                        rows={6}
                        value={auditForm.notes}
                        onChange={(e) => setAuditForm({...auditForm, notes: e.target.value})}
                        placeholder={t('quality.placeholder_audit_notes')}
                        className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:border-black focus:outline-none resize-none"
                      />
                    </div>
                    <Button type="submit" className="w-full h-14 rounded-2xl text-lg shadow-xl shadow-black/10" loading={submitting}>
                      {t('quality.submit_audit')}
                    </Button>
                  </form>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
      
      {/* Hidden Audio Player */}
      <audio ref={audioRef} onEnded={() => setPlayingAudio(null)} className="hidden" />
    </div>
  );
}
