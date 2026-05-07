'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, chatService, qualityService, auditService } from '@/src/lib/db';
import { callService } from '@/src/lib/callService';
import { CallSession, ConsultationCase, Message, QualityAuditReport, AuditCriterion, CapaStatus } from '@/src/types';
import { Card, Badge, Button } from '@/src/components/UI';
import { 
  ChevronLeft, 
  MessageSquare, 
  Mic,
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
    capaRequired: false,
    capaDescription: '',
    capaStatus: 'open' as CapaStatus,
  });
  const [criteria, setCriteria] = useState<AuditCriterion[]>(auditService.defaultCriteria());
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
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

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);

  const handleUploadEvidence = async (file: File) => {
    setUploadingEvidence(true);
    try {
      const url = await auditService.uploadEvidence(id, file);
      setEvidenceUrls((prev) => [...prev, url]);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setUploadingEvidence(false);
    }
  };

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
        status: 'completed',
        criteria,
        totalScore,
        evidenceUrls,
        capaRequired: auditForm.capaRequired,
        capaDescription: auditForm.capaDescription || undefined,
        capaStatus: auditForm.capaRequired ? auditForm.capaStatus : undefined,
      });
      toast.success(t('quality.success_submit'));
      const r = await qualityService.getAuditReports(id);
      setReports(r);
      setActiveTab('audit');
    } catch {
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
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-brand-slate hover:text-ink mb-8 transition-colors"
        >
          <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} /> {t('common.back')}
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{t('quality.case_review_title')}</h1>
            <p className="text-brand-slate mt-1">{consultation.clientName} • {consultation.consultantName}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-soft-blue">
            {(['chat', 'recordings', 'audit'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-brand-slate hover:text-ink'}`}
              >
                {t(`quality.tab_${tab}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {activeTab === 'chat' && (
            <Card className="p-0 border-none shadow-sm bg-white overflow-hidden" hover={false}>
              <div className="p-6 border-bottom border-soft-blue bg-cloud/50">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-500" /> {t('quality.chat_history')}
                </h2>
              </div>
              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                {messages.length > 0 ? (
                  messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.senderId === consultation.clientId ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-brand-slate">{m.senderName}</span>
                        <span className="text-[10px] text-brand-slate px-1">{formatDate(m.createdAt, language)}</span>
                      </div>
                      <div className={`max-w-[80%] p-4 rounded-2xl ${m.senderId === consultation.clientId ? 'bg-soft-blue text-ink rounded-tl-none' : 'bg-ink text-white rounded-tr-none'}`}>
                        {(m.type === 'text' || m.type === 'call_log') && (
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
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${m.senderId === consultation.clientId ? 'bg-white text-ink shadow-sm' : 'bg-white/20 text-white'}`}
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
                  <div className="py-20 text-center text-brand-slate">
                    <p>{t('quality.no_messages')}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {activeTab === 'recordings' && (
            <div className="space-y-8">
              {/* Call Recordings — sourced from the calls collection via subscribeToCallHistory */}
              <Card className="p-8 border-none shadow-sm bg-white" hover={false}>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Mic className="w-6 h-6 text-indigo-500" /> {t('quality.call_recordings')}
                </h2>
                {recordedCalls.length > 0 ? (
                  <div className="space-y-6">
                    {recordedCalls.map((call, idx) => {
                      const url = call.recordingUrl!;
                      const durationMin = call.durationSec
                        ? `${Math.floor(call.durationSec / 60)}:${String(call.durationSec % 60).padStart(2, '0')}`
                        : null;
                      return (
                        <div key={call.id} className="bg-cloud rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                <Mic className="w-4 h-4 text-indigo-500" />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{t('quality.call_number')} {idx + 1}</p>
                                {durationMin && (
                                  <p className="text-[10px] text-brand-slate">{durationMin}</p>
                                )}
                              </div>
                            </div>
                            <a
                              href={url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-brand-slate hover:text-ink"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          </div>
                          {/* Video player — recordings are video/webm with screen share + audio */}
                          <video
                            src={url}
                            controls
                            playsInline
                            className="w-full max-h-80 bg-black"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center bg-cloud rounded-2xl border-dashed border-2 border-soft-blue">
                    <p className="text-brand-slate">{t('quality.no_calls')}</p>
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
                          </div>
                          <span className="text-xs text-brand-slate">{formatDate(r.createdAt, language)}</span>
                        </div>
                        <p className="text-sm text-brand-slate whitespace-pre-wrap mb-4">{r.notes}</p>
                        <div className="flex items-center gap-2 text-[10px] text-brand-slate">
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
                    <FileText className="w-6 h-6 text-blue-600" /> {t('quality.new_audit_report')}
                  </h2>
                  <form onSubmit={handleSubmitAudit} className="space-y-8">
                    {/* Classification + Meeting Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-brand-slate uppercase mb-3">{t('quality.label_classification')}</label>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setAuditForm({...auditForm, classification: 'non-critical'})}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${auditForm.classification === 'non-critical' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-soft-blue text-brand-slate'}`}>
                            <CheckCircle2 className="w-4 h-4" /> {t('dashboard.non_critical')}
                          </button>
                          <button type="button" onClick={() => setAuditForm({...auditForm, classification: 'critical'})}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${auditForm.classification === 'critical' ? 'border-red-500 bg-red-50 text-red-700' : 'border-soft-blue text-brand-slate'}`}>
                            <XCircle className="w-4 h-4" /> {t('dashboard.critical')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 10-Criterion Rubric */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-xs font-bold text-brand-slate uppercase">{t('quality.criteria.title')}</label>
                        <span className="text-sm font-bold text-blue-600">{t('quality.criteria.total')}: {totalScore}/50</span>
                      </div>
                      <div className="space-y-3">
                        {criteria.map((c, idx) => (
                          <div key={c.id} className="bg-cloud rounded-xl p-4">
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <span className="text-sm font-medium text-ink flex-1">{idx + 1}. {c.label}</span>
                              <div className="flex gap-1 shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <button key={s} type="button"
                                    onClick={() => setCriteria((prev) => prev.map((cr) => cr.id === c.id ? { ...cr, score: s } : cr))}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${c.score >= s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-soft-blue text-brand-slate hover:border-blue-300'}`}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <input type="text" placeholder={t('quality.criteria.comment')}
                              value={c.comment ?? ''}
                              onChange={(e) => setCriteria((prev) => prev.map((cr) => cr.id === c.id ? { ...cr, comment: e.target.value } : cr))}
                              className="w-full h-8 px-3 text-xs border border-soft-blue rounded-lg bg-white focus:outline-none focus:border-blue-400"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* General Notes */}
                    <div>
                      <label className="block text-xs font-bold text-brand-slate uppercase mb-3">{t('quality.label_audit_notes')}</label>
                      <textarea required rows={4} value={auditForm.notes}
                        onChange={(e) => setAuditForm({...auditForm, notes: e.target.value})}
                        placeholder={t('quality.placeholder_audit_notes')}
                        className="w-full px-4 py-4 bg-cloud border border-soft-blue rounded-2xl focus:border-blue-600 focus:outline-none resize-none" />
                    </div>

                    {/* Evidence Attachments */}
                    <div>
                      <label className="block text-xs font-bold text-brand-slate uppercase mb-3">{t('quality.evidence.title')}</label>
                      <label className="cursor-pointer inline-flex items-center gap-2 h-9 px-4 bg-cloud border border-soft-blue rounded-xl text-xs font-medium text-brand-slate hover:bg-soft-blue transition-colors">
                        <input type="file" className="hidden" accept="image/*,.pdf"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadEvidence(f); }} />
                        {uploadingEvidence ? t('quality.evidence.uploading') : t('quality.evidence.upload')}
                      </label>
                      {evidenceUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {evidenceUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-500 underline">{t('quality.evidence.title')} {i + 1}</a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* CAPA */}
                    <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-900">{t('quality.capa.title')}</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={auditForm.capaRequired}
                            onChange={(e) => setAuditForm({...auditForm, capaRequired: e.target.checked})}
                            className="w-4 h-4 rounded accent-amber-600" />
                          <span className="text-xs font-medium text-amber-800">{t('quality.capa.required')}</span>
                        </label>
                      </div>
                      {auditForm.capaRequired && (
                        <>
                          <textarea rows={3} value={auditForm.capaDescription}
                            onChange={(e) => setAuditForm({...auditForm, capaDescription: e.target.value})}
                            placeholder={t('quality.capa.description_placeholder')}
                            className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 resize-none" />
                          <div className="flex gap-2">
                            {(['open', 'in_progress', 'closed'] as CapaStatus[]).map((s) => (
                              <button key={s} type="button"
                                onClick={() => setAuditForm({...auditForm, capaStatus: s})}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${auditForm.capaStatus === s ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-amber-200 text-amber-800'}`}>
                                {t(`quality.capa.${s}`)}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
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
