'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { Button, Card } from '@/src/components/UI';
import { IntakeData, ConsultantProfile } from '@/src/types';
import { consultantService } from '@/src/lib/db';
import {
  Building2,
  Target,
  MapPin,
  DollarSign,
  Calendar,
  FileText,
  ChevronRight,
  ArrowLeft,
  Search,
  UserCheck,
  ExternalLink,
  Loader2,
  AlertCircle,
  Star,
  CheckCircle2,
} from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import { useLanguage } from '@/src/context/LanguageContext';

export default function NewConsultation() {
  const { t, isRTL } = useLanguage();
  const { loading } = useRoleGuard(['client']);
  const router = useRouter();
  const [consultants, setConsultants] = useState<ConsultantProfile[]>([]);
  const [consultantSearch, setConsultantSearch] = useState('');
  const [consultantsLoading, setConsultantsLoading] = useState(true);
  const [consultantsError, setConsultantsError] = useState('');
  const [formData, setFormData] = useState<IntakeData>({
    goal: 'living',
    preferredArea: '',
    budgetRange: '',
    propertyType: '',
    preferredDeliveryTime: '',
    notes: '',
    projectsInMind: '',
    selectedConsultantUid: '',
    selectedConsultantName: '',
  });

  const loadConsultants = useCallback(async () => {
    setConsultantsLoading(true);
    setConsultantsError('');
    try {
      const data = await consultantService.getAllConsultants();
      const activeConsultants = data
        .filter((consultant) => consultant.status !== 'deactivated')
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.completedConsultations - a.completedConsultations;
        });
      setConsultants(activeConsultants);
    } catch (error) {
      console.error('Failed to load consultants:', error);
      setConsultantsError(t('intake.consultant_search_error'));
    } finally {
      setConsultantsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConsultants();
  }, [loadConsultants]);

  const selectedConsultant = useMemo(
    () => consultants.find((consultant) => consultant.uid === formData.selectedConsultantUid) || null,
    [consultants, formData.selectedConsultantUid]
  );

  const filteredConsultants = useMemo(() => {
    const normalizedSearch = consultantSearch.trim().toLowerCase();
    if (!normalizedSearch) return consultants;
    return consultants.filter((consultant) => consultant.name.toLowerCase().includes(normalizedSearch));
  }, [consultantSearch, consultants]);

  if (loading) return null;

  const handleSelectConsultant = (consultant: ConsultantProfile) => {
    setFormData((current) => ({
      ...current,
      selectedConsultantUid: consultant.uid,
      selectedConsultantName: consultant.name,
    }));
  };

  const clearSelectedConsultant = () => {
    setFormData((current) => ({
      ...current,
      selectedConsultantUid: '',
      selectedConsultantName: '',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.selectedConsultantUid || !formData.selectedConsultantName) {
      toast.error(t('intake.consultant_required'));
      return;
    }

    localStorage.setItem('pending_intake', JSON.stringify(formData));
    router.push('/client/payment');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => router.back()}
          className={`flex items-center text-gray-500 hover:text-black mb-8 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} /> {t('client.back_to_dashboard')}
        </button>

        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('intake.title')}</h1>
          <p className="text-gray-500 mt-2">{t('intake.subtitle')}</p>
        </div>

        <Card className="p-8 border-none shadow-xl" hover={false}>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Target className="w-4 h-4" /> {t('intake.goal_label')}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {['living', 'investment', 'resale'].map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setFormData({ ...formData, goal: goal as IntakeData['goal'] })}
                      className={`px-4 py-3 rounded-xl text-sm font-medium ${isRTL ? 'text-right' : 'text-left'} border-2 transition-all ${
                        formData.goal === goal
                          ? 'border-black bg-black text-white'
                          : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                      }`}
                    >
                      {t(`intake.goal_${goal}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> {t('intake.property_type_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('intake.property_type_placeholder')}
                  required
                  value={formData.propertyType}
                  onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {t('intake.area_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('intake.area_placeholder')}
                  required
                  value={formData.preferredArea}
                  onChange={(e) => setFormData({ ...formData, preferredArea: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> {t('intake.budget_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('intake.budget_placeholder')}
                  required
                  value={formData.budgetRange}
                  onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {t('intake.delivery_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('intake.delivery_placeholder')}
                  required
                  value={formData.preferredDeliveryTime}
                  onChange={(e) => setFormData({ ...formData, preferredDeliveryTime: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> {t('intake.projects_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('intake.projects_placeholder')}
                  value={formData.projectsInMind}
                  onChange={(e) => setFormData({ ...formData, projectsInMind: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all"
                />
              </div>
            </div>

            <section className="space-y-4 pt-2">
              <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={isRTL ? 'text-right' : ''}>
                  <label className={`text-sm font-bold text-gray-700 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Search className="w-4 h-4" /> {t('intake.consultant_search_label')}
                  </label>
                  <p className="text-sm text-gray-500 mt-2">{t('intake.consultant_search_helper')}</p>
                </div>
                {selectedConsultant ? (
                  <Button type="button" variant="ghost" onClick={clearSelectedConsultant} className="text-sm">
                    {t('intake.change_consultant')}
                  </Button>
                ) : null}
              </div>

              <div className="relative">
                <Search className={`w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'}`} />
                <input
                  type="text"
                  value={consultantSearch}
                  onChange={(e) => setConsultantSearch(e.target.value)}
                  placeholder={t('intake.consultant_search_placeholder')}
                  className={`w-full py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all ${isRTL ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'}`}
                />
              </div>

              {selectedConsultant ? (
                <Card className="border-emerald-200 bg-emerald-50/70 p-5" hover={false}>
                  <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                    <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <p className="font-bold text-gray-900">{selectedConsultant.name}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            {t('intake.selected_consultant_badge')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {selectedConsultant.experienceYears} {t('dashboard.years_experience')} • {selectedConsultant.rating.toFixed(1)} {t('consultant.rating_text')} • {selectedConsultant.completedConsultations} {t('consultant.completed_cases_text')}
                        </p>
                        {selectedConsultant.specialties.length > 0 ? (
                          <div className={`flex flex-wrap gap-2 mt-3 ${isRTL ? 'justify-end' : ''}`}>
                            {selectedConsultant.specialties.slice(0, 3).map((specialty) => (
                              <span key={specialty} className="text-xs px-2.5 py-1 rounded-full bg-white text-gray-600 border border-emerald-100">
                                {specialty}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <Link href={`/consultants/${selectedConsultant.uid}`} className="shrink-0">
                      <Button type="button" variant="outline" className={`h-11 rounded-xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <ExternalLink className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('intake.view_consultant_profile')}
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : null}

              {consultantsLoading ? (
                <Card className="p-6 border-dashed border-2 border-gray-200 bg-gray-50" hover={false}>
                  <div className={`flex items-center justify-center gap-3 text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('intake.consultant_search_loading')}</span>
                  </div>
                </Card>
              ) : consultantsError ? (
                <Card className="p-6 border-rose-100 bg-rose-50/50" hover={false}>
                  <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
                    <div className={`flex items-start gap-3 text-rose-700 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                      <AlertCircle className="w-5 h-5 mt-0.5" />
                      <p>{consultantsError}</p>
                    </div>
                    <Button type="button" variant="outline" onClick={loadConsultants}>
                      {t('intake.consultant_search_retry')}
                    </Button>
                  </div>
                </Card>
              ) : consultants.length === 0 ? (
                <Card className="p-6 border-dashed border-2 border-gray-200 bg-gray-50" hover={false}>
                  <p className={`text-sm text-gray-500 ${isRTL ? 'text-right' : ''}`}>{t('intake.consultant_search_empty')}</p>
                </Card>
              ) : filteredConsultants.length === 0 ? (
                <Card className="p-6 border-dashed border-2 border-gray-200 bg-gray-50" hover={false}>
                  <p className={`text-sm text-gray-500 ${isRTL ? 'text-right' : ''}`}>{t('intake.consultant_search_no_match')}</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredConsultants.map((consultant) => {
                    const isSelected = consultant.uid === formData.selectedConsultantUid;
                    return (
                      <Card
                        key={consultant.uid}
                        className={`p-5 border-2 transition-all ${
                          isSelected ? 'border-black bg-gray-50' : 'border-gray-100'
                        }`}
                        hover={false}
                      >
                        <div className="space-y-4">
                          <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div className={isRTL ? 'text-right' : ''}>
                              <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <h3 className="font-bold text-gray-900">{consultant.name}</h3>
                                {isSelected ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
                              </div>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{consultant.bio}</p>
                            </div>
                            <div className={`flex items-center gap-1 text-amber-500 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <Star className="w-4 h-4 fill-current" />
                              <span className="text-sm font-semibold">{consultant.rating.toFixed(1)}</span>
                            </div>
                          </div>

                          <div className={`flex flex-wrap gap-2 text-xs text-gray-500 ${isRTL ? 'justify-end' : ''}`}>
                            <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100">
                              {consultant.experienceYears} {t('dashboard.years_experience')}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100">
                              {consultant.completedConsultations} {t('consultant.completed_cases_text')}
                            </span>
                          </div>

                          {consultant.specialties.length > 0 ? (
                            <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : ''}`}>
                              {consultant.specialties.slice(0, 3).map((specialty) => (
                                <span key={specialty} className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                  {specialty}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Button
                              type="button"
                              onClick={() => handleSelectConsultant(consultant)}
                              className="flex-1 h-11 rounded-xl"
                              variant={isSelected ? 'secondary' : 'primary'}
                            >
                              {isSelected ? t('intake.selected_consultant_badge') : t('intake.select_consultant')}
                            </Button>
                            <Link href={`/consultants/${consultant.uid}`} className="shrink-0">
                              <Button type="button" variant="outline" className="h-11 rounded-xl">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="space-y-3">
              <label className={`text-sm font-bold text-gray-700 ${isRTL ? 'text-right block' : ''}`}>{t('intake.notes_label')}</label>
              <textarea
                rows={4}
                placeholder={t('intake.notes_placeholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all resize-none ${isRTL ? 'text-right' : 'text-left'}`}
              />
            </div>

            <div className="pt-6">
              <Button type="submit" className={`w-full h-14 text-lg rounded-2xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                {t('intake.continue_payment')}
                <ChevronRight className={`w-5 h-5 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
