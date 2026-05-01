'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { Button, Card } from '@/src/components/UI';
import { IntakeData, ConsultantProfile } from '@/src/types';
import { consultantService } from '@/src/lib/db';
import {
  Building2, Target, MapPin, DollarSign, Calendar, FileText,
  ChevronRight, ArrowLeft, Search, UserCheck, ExternalLink,
  Loader2, AlertCircle, Star, CheckCircle2, Save,
} from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import { useLanguage } from '@/src/context/LanguageContext';
import { analyticsEvents } from '@/src/lib/analytics';

const DRAFT_KEY = 'intake_draft_v2';
const TOTAL_STEPS = 3;

const EMPTY_FORM: IntakeData = {
  goal: 'living',
  preferredArea: '',
  budgetRange: '',
  propertyType: '',
  preferredDeliveryTime: '',
  notes: '',
  projectsInMind: '',
  selectedConsultantUid: '',
  selectedConsultantName: '',
};

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <React.Fragment key={s}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
            s < step ? 'bg-emerald-500 text-white' : s === step ? 'bg-blue-600 text-white' : 'bg-soft-blue text-brand-slate'
          }`}>
            {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          {s < total && <div className={`flex-1 h-0.5 ${s < step ? 'bg-emerald-400' : 'bg-soft-blue'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function NewConsultation() {
  const { t, isRTL } = useLanguage();
  const { loading } = useRoleGuard(['client']);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [consultants, setConsultants] = useState<ConsultantProfile[]>([]);
  const [consultantSearch, setConsultantSearch] = useState('');
  const [consultantsLoading, setConsultantsLoading] = useState(true);
  const [consultantsError, setConsultantsError] = useState('');
  const [formData, setFormData] = useState<IntakeData>(EMPTY_FORM);
  const [hasDraft, setHasDraft] = useState(false);

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<IntakeData & { _step?: number }>;
        const { _step, ...data } = draft;
        setFormData({ ...EMPTY_FORM, ...data });
        if (_step && _step > 1) setStep(_step);
        setHasDraft(true);
        toast(t('intake.draft.restored'), { icon: '📋', duration: 3000 });
      }
    } catch {
      // stale draft — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = useCallback((data: IntakeData, currentStep: number) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, _step: currentStep }));
  }, []);

  const update = (patch: Partial<IntakeData>) => {
    const next = { ...formData, ...patch };
    setFormData(next);
    saveDraft(next, step);
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setFormData(EMPTY_FORM);
    setStep(1);
    setHasDraft(false);
  };

  const loadConsultants = useCallback(async () => {
    setConsultantsLoading(true);
    setConsultantsError('');
    try {
      const data = await consultantService.getAllConsultants();
      setConsultants(
        data.filter((c) => c.status !== 'deactivated')
            .sort((a, b) => b.rating - a.rating || b.completedConsultations - a.completedConsultations)
      );
    } catch {
      setConsultantsError(t('intake.consultant_search_error'));
    } finally {
      setConsultantsLoading(false);
    }
  }, [t]);

  useEffect(() => { void loadConsultants(); }, [loadConsultants]);

  const selectedConsultant = useMemo(
    () => consultants.find((c) => c.uid === formData.selectedConsultantUid) || null,
    [consultants, formData.selectedConsultantUid]
  );

  const searchTerm = consultantSearch.trim().toLowerCase();
  const filteredConsultants = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return consultants.filter(
      (c) => c.name.toLowerCase().includes(searchTerm) || c.specialties?.some((s) => s.toLowerCase().includes(searchTerm))
    );
  }, [searchTerm, consultants]);

  if (loading) return null;

  const handleNext = () => {
    // Validate current step
    if (step === 1 && (!formData.propertyType.trim() || !formData.budgetRange.trim() || !formData.preferredDeliveryTime.trim())) {
      toast.error(t('common.required_fields') || 'Please fill in all required fields.');
      return;
    }
    if (step === 2 && !formData.preferredArea.trim()) {
      toast.error(t('common.required_fields') || 'Please fill in all required fields.');
      return;
    }
    analyticsEvents.intakeStepComplete(step);
    const nextStep = step + 1;
    setStep(nextStep);
    analyticsEvents.intakeStepViewed(nextStep);
    saveDraft(formData, nextStep);
  };

  const handleBack = () => {
    const prevStep = step - 1;
    setStep(prevStep);
    saveDraft(formData, prevStep);
  };

  const handleManualSave = () => {
    saveDraft(formData, step);
    toast.success(t('intake.draft.saved'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    analyticsEvents.intakeSubmitted(formData.goal);
    const payload: IntakeData = {
      ...formData,
      ...(formData.selectedConsultantUid && formData.selectedConsultantName
        ? { selectedConsultantUid: formData.selectedConsultantUid, selectedConsultantName: formData.selectedConsultantName }
        : {}),
    };
    if (!payload.selectedConsultantUid) {
      delete payload.selectedConsultantUid;
      delete payload.selectedConsultantName;
    }
    localStorage.removeItem(DRAFT_KEY);
    sessionStorage.setItem('pending_intake', JSON.stringify(payload));
    router.push('/client/payment');
  };

  const stepTitles = [t('intake.step1.title'), t('intake.step2.title'), t('intake.step3.title')];

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`flex items-center justify-between mb-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => router.back()}
            className={`flex items-center text-brand-slate hover:text-ink transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('client.back_to_dashboard')}
          </button>
          <div className="flex items-center gap-2">
            {hasDraft && (
              <button onClick={clearDraft} className="text-xs text-brand-slate hover:text-rose-600 transition-colors">
                {t('intake.draft.clear')}
              </button>
            )}
            <button onClick={handleManualSave} className="flex items-center gap-1.5 text-xs text-brand-slate hover:text-blue-600 transition-colors">
              <Save className="w-3.5 h-3.5" /> {t('intake.draft.saved').split(' ')[0]}
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t('intake.title')}</h1>
          <p className="text-brand-slate mt-1">{stepTitles[step - 1]}</p>
        </div>

        <StepIndicator step={step} total={TOTAL_STEPS} />

        <Card className="p-8 border-none shadow-xl" hover={false}>
          <form onSubmit={handleSubmit}>
            {/* ── Step 1: Goals ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-ink flex items-center gap-2">
                    <Target className="w-4 h-4" /> {t('intake.goal_label')}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(['living', 'investment', 'resale'] as IntakeData['goal'][]).map((goal) => (
                      <button key={goal} type="button" onClick={() => update({ goal })}
                        className={`px-4 py-3 rounded-xl text-sm font-medium text-left border-2 transition-all ${
                          formData.goal === goal ? 'border-blue-600 bg-blue-600 text-white' : 'border-soft-blue bg-cloud text-brand-slate hover:border-blue-600'
                        }`}>
                        {t(`intake.goal_${goal}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-ink flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> {t('intake.property_type_label')} <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" required placeholder={t('intake.property_type_placeholder')}
                    value={formData.propertyType} onChange={(e) => update({ propertyType: e.target.value })}
                    className="w-full px-4 py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ink flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> {t('intake.budget_label')} <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" required placeholder={t('intake.budget_placeholder')}
                      value={formData.budgetRange} onChange={(e) => update({ budgetRange: e.target.value })}
                      className="w-full px-4 py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ink flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {t('intake.delivery_label')} <span className="text-rose-500">*</span>
                    </label>
                    <input type="text" required placeholder={t('intake.delivery_placeholder')}
                      value={formData.preferredDeliveryTime} onChange={(e) => update({ preferredDeliveryTime: e.target.value })}
                      className="w-full px-4 py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Location & Details ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-ink flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {t('intake.area_label')} <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" required placeholder={t('intake.area_placeholder')}
                    value={formData.preferredArea} onChange={(e) => update({ preferredArea: e.target.value })}
                    className="w-full px-4 py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none" />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-ink flex items-center gap-2">
                    <FileText className="w-4 h-4" /> {t('intake.projects_label')}
                  </label>
                  <input type="text" placeholder={t('intake.projects_placeholder')}
                    value={formData.projectsInMind ?? ''} onChange={(e) => update({ projectsInMind: e.target.value })}
                    className="w-full px-4 py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none" />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-ink">{t('intake.notes_label')}</label>
                  <textarea rows={4} placeholder={t('intake.notes_placeholder')}
                    value={formData.notes} onChange={(e) => update({ notes: e.target.value })}
                    className="w-full px-4 py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none resize-none" />
                </div>
              </div>
            )}

            {/* ── Step 3: Choose Consultant ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div>
                    <p className="text-sm font-bold text-ink">{t('intake.consultant_search_label')}</p>
                    <p className="text-sm text-brand-slate mt-1">{t('intake.consultant_optional_helper')}</p>
                  </div>
                  {selectedConsultant && (
                    <Button type="button" variant="ghost" onClick={() => update({ selectedConsultantUid: '', selectedConsultantName: '' })} className="text-sm shrink-0">
                      {t('intake.change_consultant')}
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <Search className={`w-4 h-4 text-brand-slate absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'}`} />
                  <input type="text" value={consultantSearch} onChange={(e) => setConsultantSearch(e.target.value)}
                    placeholder={t('intake.consultant_search_placeholder')}
                    className={`w-full py-3 bg-cloud border-2 border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'}`} />
                </div>

                {selectedConsultant && (
                  <Card className="border-emerald-200 bg-emerald-50/70 p-5" hover={false}>
                    <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-ink">{selectedConsultant.name}</p>
                        <p className="text-sm text-brand-slate">{selectedConsultant.experienceYears} yrs • {selectedConsultant.rating.toFixed(1)} ⭐</p>
                      </div>
                      <Link href={`/consultants/${selectedConsultant.uid}`}>
                        <Button type="button" variant="outline" className="h-9 rounded-xl">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                )}

                {!selectedConsultant && (
                  <Card className="border-dashed border-2 border-soft-blue bg-cloud p-5" hover={false}>
                    <p className="font-bold text-ink mb-1">{t('intake.assign_later_title')}</p>
                    <p className="text-sm text-brand-slate">{t('intake.assign_later_desc')}</p>
                  </Card>
                )}

                {consultantsLoading ? (
                  <div className="flex items-center justify-center gap-3 py-6 text-brand-slate">
                    <Loader2 className="w-5 h-5 animate-spin" />{t('intake.consultant_search_loading')}
                  </div>
                ) : consultantsError ? (
                  <div className="flex items-center gap-3 text-rose-600 text-sm">
                    <AlertCircle className="w-5 h-5" />{consultantsError}
                    <Button type="button" variant="outline" size="sm" onClick={loadConsultants}>{t('intake.consultant_search_retry')}</Button>
                  </div>
                ) : searchTerm.length < 2 ? null : filteredConsultants.length === 0 ? (
                  <p className="text-sm text-brand-slate text-center py-4">{t('intake.consultant_search_no_match')}</p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {filteredConsultants.map((consultant) => {
                      const isSelected = consultant.uid === formData.selectedConsultantUid;
                      return (
                        <Card key={consultant.uid} className={`p-5 border-2 transition-all ${isSelected ? 'border-blue-600 bg-soft-blue' : 'border-soft-blue'}`} hover={false}>
                          <div className="space-y-4">
                            <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-ink">{consultant.name}</h3>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                                </div>
                                <p className="text-sm text-brand-slate mt-1 line-clamp-2">{consultant.bio}</p>
                              </div>
                              <div className="flex items-center gap-1 text-amber-500 shrink-0">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="text-sm font-semibold">{consultant.rating.toFixed(1)}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-brand-slate">
                              <span className="px-2.5 py-1 rounded-full bg-cloud border border-soft-blue">{consultant.experienceYears} {t('dashboard.years_experience')}</span>
                              <span className="px-2.5 py-1 rounded-full bg-cloud border border-soft-blue">{consultant.completedConsultations} {t('consultant.completed_cases_text')}</span>
                            </div>
                            {consultant.specialties.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {consultant.specialties.slice(0, 3).map((s) => (
                                  <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{s}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <Button type="button" onClick={() => update({ selectedConsultantUid: consultant.uid, selectedConsultantName: consultant.name })}
                                className="flex-1 h-11 rounded-xl" variant={isSelected ? 'secondary' : 'primary'}>
                                {isSelected ? t('intake.selected_consultant_badge') : t('intake.select_consultant')}
                              </Button>
                              <Link href={`/consultants/${consultant.uid}`} className="shrink-0">
                                <Button type="button" variant="outline" className="h-11 rounded-xl"><ExternalLink className="w-4 h-4" /></Button>
                              </Link>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className={`flex gap-4 mt-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {step > 1 && (
                <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={handleBack}>
                  <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('intake.back')}
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button type="button" className="flex-1 h-12 rounded-xl" onClick={handleNext}>
                  {t('intake.next')} <ChevronRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              ) : (
                <Button type="submit" className="flex-1 h-12 rounded-xl">
                  {t('intake.continue_payment')} <ChevronRight className={`w-4 h-4 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
                </Button>
              )}
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
