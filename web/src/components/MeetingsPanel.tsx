'use client';

import React, { useEffect, useState } from 'react';
import { meetingService } from '@/src/lib/db';
import { ConsultationCase, ScheduledMeeting, MeetingStatus } from '@/src/types';
import { useLanguage } from '@/src/context/LanguageContext';
import { Button, Card } from '@/src/components/UI';
import {
  Calendar, Clock, Link as LinkIcon, Plus, X, Download,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDate } from '@/src/lib/utils';

const STATUS_CLASSES: Record<MeetingStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-brand-slate/10 text-brand-slate',
};

const DURATIONS = [30, 45, 60, 90] as const;

interface MeetingsPanelProps {
  consultation: ConsultationCase;
  currentUserId: string;
  currentUserName: string;
  currentRole: 'client' | 'consultant' | 'admin' | 'quality';
}

export default function MeetingsPanel({
  consultation,
  currentUserId,
  currentUserName,
  currentRole,
}: MeetingsPanelProps) {
  const { t, isRTL, language } = useLanguage();
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    scheduledAt: '',
    durationMinutes: 60 as typeof DURATIONS[number],
    meetingLink: '',
    notes: '',
  });

  const canPropose = currentRole === 'client' || currentRole === 'consultant';

  useEffect(() => {
    const unsub = meetingService.subscribeToMeetings(consultation.id, setMeetings);
    return () => unsub();
  }, [consultation.id]);

  const resetForm = () =>
    setForm({ title: '', scheduledAt: '', durationMinutes: 60, meetingLink: '', notes: '' });

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduledAt) return;
    setSubmitting(true);
    try {
      await meetingService.proposeMeeting({
        caseId: consultation.id,
        clientId: consultation.clientId,
        consultantId: consultation.consultantId || '',
        clientName: consultation.clientName || '',
        consultantName: consultation.consultantName || '',
        proposedBy: currentUserId,
        title: form.title.trim(),
        scheduledAt: new Date(form.scheduledAt),
        durationMinutes: form.durationMinutes,
        meetingLink: form.meetingLink.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: 'scheduled',
      });
      toast.success(t('meeting.propose_success'));
      resetForm();
      setShowForm(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (
    meetingId: string,
    action: 'confirm' | 'cancel' | 'complete',
  ) => {
    setActioning(meetingId + action);
    const statusMap: Record<string, MeetingStatus> = {
      confirm: 'confirmed',
      cancel: 'cancelled',
      complete: 'completed',
    };
    try {
      await meetingService.updateMeeting(meetingId, { status: statusMap[action] });
      const msgMap: Record<string, string> = {
        confirm: t('meeting.confirm_success'),
        cancel: t('meeting.cancel_success'),
        complete: t('meeting.confirm_success'),
      };
      toast.success(msgMap[action]);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setActioning(null);
    }
  };

  const handleDownloadICS = (meeting: ScheduledMeeting) => {
    const ics = meetingService.generateICS(meeting);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-${meeting.id.substring(0, 8)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const durationLabel = (min: number) => {
    const key = `meeting.min_${min}` as any;
    return t(key);
  };

  const active = meetings.filter((m) => m.status !== 'cancelled' && m.status !== 'completed');
  const past = meetings.filter((m) => m.status === 'cancelled' || m.status === 'completed');

  return (
    <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className={`font-semibold text-ink flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Calendar className="w-4 h-4 text-brand-slate" />
          {t('meeting.panel_title')}
        </h3>
        {canPropose && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('meeting.propose')}
          </button>
        )}
      </div>

      {/* Propose form */}
      {showForm && (
        <Card hover={false} className="p-4 border-blue-100 bg-blue-50/40">
          <form onSubmit={handlePropose} className="space-y-3">
            <div className={`flex items-center justify-between mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="text-sm font-semibold text-ink">{t('meeting.propose')}</p>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}>
                <X className="w-4 h-4 text-brand-slate hover:text-ink transition-colors" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-brand-slate mb-1">{t('meeting.title_label')}</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder={t('meeting.title_placeholder')}
                className={`w-full bg-white border border-soft-blue rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-blue-300 ${isRTL ? 'text-right' : ''}`}
              />
            </div>

            {/* Date + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-slate mb-1">{t('meeting.date_label')}</label>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduledAt}
                  onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                  className="w-full bg-white border border-soft-blue rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-slate mb-1">{t('meeting.duration_label')}</label>
                <select
                  value={form.durationMinutes}
                  onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) as typeof DURATIONS[number] }))}
                  className="w-full bg-white border border-soft-blue rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-blue-300"
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>{durationLabel(d)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Link */}
            <div>
              <label className="block text-xs font-medium text-brand-slate mb-1">{t('meeting.link_label')}</label>
              <input
                type="url"
                value={form.meetingLink}
                onChange={(e) => setForm((p) => ({ ...p, meetingLink: e.target.value }))}
                placeholder={t('meeting.link_placeholder')}
                className={`w-full bg-white border border-soft-blue rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-blue-300 ${isRTL ? 'text-right' : ''}`}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-brand-slate mb-1">{t('meeting.notes_label')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t('meeting.notes_placeholder')}
                rows={2}
                className={`w-full bg-white border border-soft-blue rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-blue-300 resize-none ${isRTL ? 'text-right' : ''}`}
              />
            </div>

            <div className={`flex justify-end gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('meeting.submit')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Active meetings */}
      {active.length === 0 && past.length === 0 && !showForm && (
        <p className="text-sm text-brand-slate py-4 text-center">{t('meeting.no_meetings')}</p>
      )}

      <div className="space-y-3">
        {active.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            currentUserId={currentUserId}
            currentRole={currentRole}
            actioning={actioning}
            onConfirm={() => handleAction(meeting.id, 'confirm')}
            onCancel={() => handleAction(meeting.id, 'cancel')}
            onComplete={() => handleAction(meeting.id, 'complete')}
            onDownloadICS={() => handleDownloadICS(meeting)}
            t={t}
            isRTL={isRTL}
            language={language}
          />
        ))}

        {past.length > 0 && (
          <PastMeetings
            meetings={past}
            onDownloadICS={handleDownloadICS}
            t={t}
            isRTL={isRTL}
            language={language}
          />
        )}
      </div>
    </div>
  );
}

// ── Meeting card ────────────────────────────────────────────────────────────────

function MeetingCard({
  meeting, currentUserId, currentRole, actioning,
  onConfirm, onCancel, onComplete, onDownloadICS,
  t, isRTL, language,
}: {
  meeting: ScheduledMeeting;
  currentUserId: string;
  currentRole: string;
  actioning: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onDownloadICS: () => void;
  t: (k: string) => string;
  isRTL: boolean;
  language: string;
}) {
  const isProposer = meeting.proposedBy === currentUserId;
  const canConfirm = !isProposer && meeting.status === 'scheduled';
  const canCancel = (currentRole === 'consultant' || currentRole === 'client') && meeting.status !== 'cancelled' && meeting.status !== 'completed';
  const canComplete = currentRole === 'consultant' && meeting.status === 'confirmed';

  const scheduledDate = meeting.scheduledAt?.toDate
    ? meeting.scheduledAt.toDate()
    : new Date(meeting.scheduledAt);

  return (
    <Card hover={false} className="p-4">
      <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 mb-1 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="font-semibold text-sm text-ink truncate">{meeting.title}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLASSES[meeting.status]}`}>
              {t(`meeting.status_${meeting.status}` as any)}
            </span>
          </div>

          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-slate mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Calendar className="w-3 h-3 shrink-0" />
              {formatDate(meeting.scheduledAt, language)}
            </span>
            <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Clock className="w-3 h-3 shrink-0" />
              {meeting.durationMinutes} min
            </span>
            {meeting.meetingLink && (
              <a
                href={meeting.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-blue-600 hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <LinkIcon className="w-3 h-3 shrink-0" />
                Join
              </a>
            )}
          </div>

          {meeting.notes && (
            <p className="text-xs text-brand-slate mt-2 leading-relaxed">{meeting.notes}</p>
          )}

          <p className="text-[10px] text-brand-slate/50 mt-1.5">
            {isProposer ? t('meeting.proposed_by_you') : `${t('meeting.proposed_by_other')} ${meeting.proposedBy === meeting.clientId ? meeting.clientName : meeting.consultantName}`}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className={`flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-soft-blue ${isRTL ? 'flex-row-reverse' : ''}`}>
        {canConfirm && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={actioning === meeting.id + 'confirm'}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 transition-colors"
          >
            {actioning === meeting.id + 'confirm'
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CheckCircle2 className="w-3 h-3" />}
            {t('meeting.confirm')}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={actioning === meeting.id + 'complete'}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
          >
            {actioning === meeting.id + 'complete'
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CheckCircle2 className="w-3 h-3" />}
            {t('meeting.complete')}
          </button>
        )}
        <button
          type="button"
          onClick={onDownloadICS}
          className="flex items-center gap-1 text-xs font-medium text-brand-slate hover:text-ink transition-colors"
        >
          <Download className="w-3 h-3" />
          {t('meeting.download_ics')}
        </button>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={actioning === meeting.id + 'cancel'}
            className={`flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors ${isRTL ? 'me-auto' : 'ms-auto'}`}
          >
            {actioning === meeting.id + 'cancel'
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <XCircle className="w-3 h-3" />}
            {t('meeting.cancel_meeting')}
          </button>
        )}
      </div>
    </Card>
  );
}

// ── Past meetings (collapsible) ────────────────────────────────────────────────

function PastMeetings({
  meetings, onDownloadICS, t, isRTL, language,
}: {
  meetings: ScheduledMeeting[];
  onDownloadICS: (m: ScheduledMeeting) => void;
  t: (k: string) => string;
  isRTL: boolean;
  language: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs text-brand-slate hover:text-ink transition-colors mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {meetings.length} past / cancelled
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {meetings.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-cloud/50 border border-soft-blue opacity-70 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink truncate">{m.title}</p>
                <p className="text-[10px] text-brand-slate mt-0.5">{formatDate(m.scheduledAt, language)}</p>
              </div>
              <div className={`flex items-center gap-2 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASSES[m.status]}`}>
                  {t(`meeting.status_${m.status}` as any)}
                </span>
                <button
                  type="button"
                  onClick={() => onDownloadICS(m)}
                  className="text-brand-slate hover:text-ink transition-colors"
                  title={t('meeting.download_ics')}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
