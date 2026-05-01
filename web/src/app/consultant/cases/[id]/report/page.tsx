'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { consultationService, reportBuilderService } from '@/src/lib/db';
import { ConsultationCase, ReportSection, ComparableProperty, StructuredReport } from '@/src/types';
import { useLanguage } from '@/src/context/LanguageContext';
import { Card, Button } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import {
  ArrowLeft, Eye, Edit3, Printer, Save, Send, Loader2,
  Plus, Trash2, Image as ImageIcon, CheckCircle2,
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

// ── Comparable row ──────────────────────────────────────────────────────────────

function ComparableRow({
  row, index, onChange, onRemove, isRTL, t,
}: {
  row: ComparableProperty;
  index: number;
  onChange: (index: number, field: keyof ComparableProperty, value: string) => void;
  onRemove: (index: number) => void;
  isRTL: boolean;
  t: (k: string) => string;
}) {
  return (
    <tr className="border-b border-soft-blue last:border-0">
      {(['address', 'price', 'area', 'notes'] as const).map((field) => (
        <td key={field} className="p-2">
          <input
            type="text"
            value={row[field]}
            onChange={(e) => onChange(index, field, e.target.value)}
            className="w-full bg-transparent text-sm text-ink outline-none border-b border-transparent focus:border-blue-400 py-0.5"
            placeholder="—"
          />
        </td>
      ))}
      <td className="p-2 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Preview panel ───────────────────────────────────────────────────────────────

function ReportPreview({
  consultation, sections, comparables, t, isRTL,
}: {
  consultation: ConsultationCase;
  sections: ReportSection[];
  comparables: ComparableProperty[];
  t: (k: string) => string;
  isRTL: boolean;
}) {
  return (
    <div id="report-preview" className={`bg-white p-8 space-y-8 font-serif text-ink ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className="border-b-2 border-ink pb-6">
        <p className="text-xs font-sans font-bold uppercase tracking-widest text-brand-slate mb-2">Privara Estate</p>
        <h1 className="text-2xl font-bold leading-tight">{consultation.intake?.propertyType || 'Real Estate Consultation'}</h1>
        <p className="mt-2 text-sm text-brand-slate font-sans">{consultation.intake?.preferredArea || ''}</p>
        <p className="text-xs text-brand-slate/60 font-sans mt-1">
          Case {consultation.id.substring(0, 8).toUpperCase()} · {consultation.clientName}
        </p>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        section.content.trim() ? (
          <div key={section.id}>
            <h2 className="text-lg font-bold mb-3">{section.title}</h2>
            <p className="text-sm leading-relaxed font-sans whitespace-pre-wrap">{section.content}</p>
            {section.photoUrls && section.photoUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {section.photoUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full rounded-lg object-cover aspect-video" />
                ))}
              </div>
            )}
          </div>
        ) : null
      ))}

      {/* Comparables */}
      {comparables.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">{t('report_builder.comparables')}</h2>
          <table className="w-full text-sm font-sans border-collapse">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="text-left py-2 pr-4 font-semibold">{t('report_builder.comparable.address')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{t('report_builder.comparable.price')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{t('report_builder.comparable.area')}</th>
                <th className="text-left py-2 font-semibold">{t('report_builder.comparable.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((c, i) => (
                <tr key={i} className="border-b border-soft-blue">
                  <td className="py-2 pr-4">{c.address}</td>
                  <td className="py-2 pr-4">{c.price}</td>
                  <td className="py-2 pr-4">{c.area}</td>
                  <td className="py-2">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-soft-blue pt-4 text-xs text-brand-slate/50 font-sans">
        Prepared by Privara Estate — confidential consultation report
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function ReportBuilderPage() {
  const { profile } = useRoleGuard(['consultant']);
  const { id: caseId } = useParams();
  const router = useRouter();
  const { t, isRTL } = useLanguage();

  const [consultation, setConsultation] = useState<ConsultationCase | null>(null);
  const [sections, setSections] = useState<ReportSection[]>(reportBuilderService.defaultSections());
  const [comparables, setComparables] = useState<ComparableProperty[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const activePhotoSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!caseId || !profile) return;
    consultationService.getConsultation(caseId as string).then((c) => {
      if (!c) return;
      setConsultation(c);
      if (c.structuredReport) {
        setSections(c.structuredReport.sections);
        setComparables(c.structuredReport.comparableProperties || []);
        setIsDraft(c.structuredReport.isDraft);
      }
    });
  }, [caseId, profile]);

  const buildReport = (draft: boolean): StructuredReport => ({
    sections,
    comparableProperties: comparables,
    isDraft: draft,
    publishedAt: draft ? undefined : new Date(),
  });

  const handleSaveDraft = async () => {
    if (!caseId) return;
    setSaving(true);
    try {
      await reportBuilderService.saveReport(caseId as string, buildReport(true));
      setIsDraft(true);
      toast.success(t('report_builder.draft_saved'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!caseId || !profile) return;
    setPublishing(true);
    try {
      await reportBuilderService.saveReport(caseId as string, buildReport(false));
      setIsDraft(false);
      toast.success(t('report_builder.published'));
      // Trigger report-uploaded email
      import('@/src/lib/firebase').then(({ auth }) =>
        auth.currentUser?.getIdToken().then(token =>
          fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ type: 'report_uploaded', caseId }),
          }).catch(() => {})
        )
      );
    } catch {
      toast.error(t('common.error'));
    } finally {
      setPublishing(false);
    }
  };

  const updateSection = (id: string, content: string) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, content } : s));
  };

  const openPhotoUpload = (sectionId: string) => {
    activePhotoSectionRef.current = sectionId;
    photoInputRef.current?.click();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sectionId = activePhotoSectionRef.current;
    if (!file || !sectionId || !caseId) return;
    e.target.value = '';
    setUploadingPhoto(sectionId);
    try {
      const url = await reportBuilderService.uploadSectionPhoto(caseId as string, file);
      setSections((prev) =>
        prev.map((s) =>
          s.id === sectionId
            ? { ...s, photoUrls: [...(s.photoUrls || []), url] }
            : s,
        ),
      );
    } catch {
      toast.error(t('common.error'));
    } finally {
      setUploadingPhoto(null);
    }
  };

  const removePhoto = (sectionId: string, photoUrl: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, photoUrls: (s.photoUrls || []).filter((u) => u !== photoUrl) }
          : s,
      ),
    );
  };

  const addComparable = () =>
    setComparables((prev) => [...prev, { address: '', price: '', area: '', notes: '' }]);

  const updateComparable = (index: number, field: keyof ComparableProperty, value: string) => {
    setComparables((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeComparable = (index: number) =>
    setComparables((prev) => prev.filter((_, i) => i !== index));

  const handlePrint = () => window.print();

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-cloud pb-16 ${isRTL ? 'rtl' : 'ltr'}`}>
      <Navbar />
      <Toaster position="top-center" toastOptions={{ style: { fontSize: '13px' } }} />
      <input type="file" accept="image/*" className="hidden" ref={photoInputRef} onChange={handlePhotoUpload} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 print:p-0 print:max-w-full">

        {/* ── Header bar ── */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={() => router.push(`/consultant/cases/${caseId}`)}
              className="p-2 rounded-xl text-brand-slate hover:bg-soft-blue transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-serif text-xl font-bold text-ink">{t('report_builder.title')}</h1>
              <p className="text-xs text-brand-slate">{t('report_builder.subtitle')}</p>
            </div>
          </div>

          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDraft ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isDraft ? t('report_builder.status_draft') : t('report_builder.status_published')}
            </span>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors
                ${showPreview ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-soft-blue hover:bg-soft-blue'}`}
            >
              {showPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPreview ? t('report_builder.edit') : t('report_builder.preview')}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-soft-blue bg-white hover:bg-soft-blue transition-colors text-ink"
            >
              <Printer className="w-4 h-4" />
              {t('report_builder.print')}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showPreview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl overflow-hidden shadow-sm border border-soft-blue print:shadow-none print:border-0"
            >
              <ReportPreview
                consultation={consultation}
                sections={sections}
                comparables={comparables}
                t={t}
                isRTL={isRTL}
              />
            </motion.div>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Sections */}
              {sections.map((section) => (
                <Card key={section.id} hover={false} className="p-5">
                  <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h3 className="font-semibold text-ink">{section.title}</h3>
                    <button
                      type="button"
                      onClick={() => openPhotoUpload(section.id)}
                      disabled={uploadingPhoto === section.id}
                      className="flex items-center gap-1.5 text-xs text-brand-slate hover:text-ink transition-colors disabled:opacity-50"
                    >
                      {uploadingPhoto === section.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ImageIcon className="w-3.5 h-3.5" />}
                      {t('report_builder.add_photo')}
                    </button>
                  </div>
                  <textarea
                    value={section.content}
                    onChange={(e) => updateSection(section.id, e.target.value)}
                    placeholder={t('report_builder.section_placeholder')}
                    rows={6}
                    className={`w-full bg-soft-blue/40 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-brand-slate/50 outline-none resize-y focus:ring-1 focus:ring-blue-200 leading-relaxed ${isRTL ? 'text-right' : ''}`}
                  />
                  {section.photoUrls && section.photoUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {section.photoUrls.map((url) => (
                        <div key={url} className="relative group">
                          <img src={url} alt="" className="w-20 h-14 object-cover rounded-lg border border-soft-blue" />
                          <button
                            type="button"
                            onClick={() => removePhoto(section.id, url)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}

              {/* Comparable properties */}
              <Card hover={false} className="p-5">
                <h3 className={`font-semibold text-ink mb-4 ${isRTL ? 'text-right' : ''}`}>{t('report_builder.comparables')}</h3>
                {comparables.length > 0 && (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-soft-blue text-brand-slate text-xs">
                          <th className="text-left py-2 pr-2 font-medium">{t('report_builder.comparable.address')}</th>
                          <th className="text-left py-2 pr-2 font-medium">{t('report_builder.comparable.price')}</th>
                          <th className="text-left py-2 pr-2 font-medium">{t('report_builder.comparable.area')}</th>
                          <th className="text-left py-2 pr-2 font-medium">{t('report_builder.comparable.notes')}</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {comparables.map((row, i) => (
                          <ComparableRow
                            key={i}
                            row={row}
                            index={i}
                            onChange={updateComparable}
                            onRemove={removeComparable}
                            isRTL={isRTL}
                            t={t}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  type="button"
                  onClick={addComparable}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {t('report_builder.add_comparable')}
                </button>
              </Card>

              {/* Action bar */}
              <div className={`flex items-center gap-3 pt-2 print:hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('report_builder.save_draft')}
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={publishing || !isDraft}
                  className="gap-2"
                >
                  {publishing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : isDraft ? <Send className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t('report_builder.publish')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Print styles */}
      <style>{`@media print { .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}
