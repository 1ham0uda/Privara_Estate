'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { Button, Card } from '@/src/components/UI';
import { IntakeData } from '@/src/types';
import { 
  Building2, 
  Target, 
  MapPin, 
  DollarSign, 
  Calendar, 
  FileText,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';

import { useLanguage } from '@/src/context/LanguageContext';

export default function NewConsultation() {
  const { t, isRTL } = useLanguage();
  const { profile, loading } = useRoleGuard(['client']);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<IntakeData>({
    goal: 'living',
    preferredArea: '',
    budgetRange: '',
    propertyType: '',
    preferredDeliveryTime: '',
    notes: '',
    projectsInMind: '',
  });

  if (loading) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we might save this to session storage or a temporary doc
    localStorage.setItem('pending_intake', JSON.stringify(formData));
    router.push('/client/payment');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-500 hover:text-black mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('client.back_to_dashboard')}
        </button>

        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('intake.title')}</h1>
          <p className="text-gray-500 mt-2">{t('intake.subtitle')}</p>
        </div>

        <Card className="p-8 border-none shadow-xl" hover={false}>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Goal */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Target className="w-4 h-4" /> {t('intake.goal_label')}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {['living', 'investment', 'resale'].map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setFormData({ ...formData, goal: goal as any })}
                      className={`px-4 py-3 rounded-xl text-sm font-medium text-left border-2 transition-all ${
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

              {/* Property Type */}
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

              {/* Area */}
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

              {/* Budget */}
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

              {/* Delivery Time */}
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

              {/* Projects in Mind */}
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

            {/* Notes */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700">{t('intake.notes_label')}</label>
              <textarea
                rows={4}
                placeholder={t('intake.notes_placeholder')}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-black focus:outline-none transition-all resize-none"
              />
            </div>

            <div className="pt-6">
              <Button type="submit" className="w-full h-14 text-lg rounded-2xl">
                {t('intake.continue_payment')} <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
