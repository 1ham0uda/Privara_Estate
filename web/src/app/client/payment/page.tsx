'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useAuth } from '@/src/context/AuthContext';
import { Button, Card } from '@/src/components/UI';
import { settingsService } from '@/src/lib/db';
import { IntakeData } from '@/src/types';
import {
  Shield,
  CreditCard,
  Lock,
  CheckCircle2,
  ArrowLeft,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';
import { useLanguage } from '@/src/context/LanguageContext';
import { Tag, X as XIcon } from 'lucide-react';
import { analyticsEvents } from '@/src/lib/analytics';

export default function PaymentPage() {
  const { t, isRTL, language } = useLanguage();
  const { profile, loading } = useRoleGuard(['client']);
  const { user } = useAuth();
  const router = useRouter();
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [consultationFee, setConsultationFee] = useState(500);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number } | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);

  useEffect(() => {
    analyticsEvents.paymentPageViewed();
    const savedCaseId = sessionStorage.getItem('pending_case_id');
    if (savedCaseId) {
      setPendingCaseId(savedCaseId);
    }

    const data = sessionStorage.getItem('pending_intake');
    if (!data) {
      router.push('/client/new-consultation');
      return;
    }

    try {
      const parsed = JSON.parse(data) as IntakeData;
      if (
        (parsed.selectedConsultantUid && !parsed.selectedConsultantName) ||
        (!parsed.selectedConsultantUid && parsed.selectedConsultantName)
      ) {
        sessionStorage.removeItem('pending_intake');
        sessionStorage.removeItem('pending_case_id');
        toast.error(t('payment.load_error'));
        router.push('/client/new-consultation');
        return;
      }
      setIntakeData(parsed);
    } catch (error) {
      console.error('Failed to parse intake data:', error);
      sessionStorage.removeItem('pending_intake');
      sessionStorage.removeItem('pending_case_id');
      toast.error(t('payment.load_error'));
      router.push('/client/new-consultation');
      return;
    }

    const fetchSettings = async () => {
      const settings = await settingsService.getSettings();
      if (settings && settings.consultationFee) {
        setConsultationFee(settings.consultationFee);
      }
    };

    void fetchSettings();
  }, [router, t]);

  const hasSelectedConsultant = useMemo(
    () => Boolean(intakeData?.selectedConsultantUid && intakeData?.selectedConsultantName),
    [intakeData],
  );

  const effectiveFee = appliedDiscount
    ? Math.round(consultationFee * (1 - appliedDiscount.percent / 100))
    : consultationFee;

  const handleApplyDiscount = async () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) return;
    setValidatingDiscount(true);
    try {
      const res = await fetch('/api/payments/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({ code: data.code, percent: data.discountPercent });
        analyticsEvents.discountApplied(data.discountPercent);
        toast.success(t('payment.discount_applied', { percent: data.discountPercent }));
      } else {
        toast.error(data.error === 'expired' ? t('payment.discount_expired') : data.error === 'exhausted' ? t('payment.discount_exhausted') : t('payment.discount_invalid'));
      }
    } catch {
      toast.error(t('payment.discount_validate_error'));
    } finally {
      setValidatingDiscount(false);
    }
  };

  const handlePayment = async () => {
    if (!intakeData || !user) return;

    analyticsEvents.paymentInitiated(effectiveFee, 'EGP');
    setProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/payments/geidea/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          intake: pendingCaseId ? undefined : intakeData,
          caseId: pendingCaseId ?? undefined,
          language,
          discountCode: appliedDiscount?.code ?? undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (data?.caseId && typeof data.caseId === 'string') {
        sessionStorage.setItem('pending_case_id', data.caseId);
        setPendingCaseId(data.caseId);
      }

      if (!response.ok) {
        if (data?.error === 'This consultation is already paid' && data?.caseId) {
          sessionStorage.removeItem('pending_intake');
          sessionStorage.removeItem('pending_case_id');
          router.push(`/client/cases/${data.caseId}`);
          return;
        }
        throw new Error(data?.error || t('payment.error_failed'));
      }

      sessionStorage.removeItem('pending_intake');
      sessionStorage.removeItem('pending_case_id');
      setPendingCaseId(null);
      setSuccess(true);
      analyticsEvents.paymentCompleted(effectiveFee, 'EGP');
      toast.success(t('payment.success_title'));
      setTimeout(() => {
        router.push(`/client/cases/${data.caseId}`);
      }, 900);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payment.error_failed'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !profile || !intakeData) return null;

  return (
    <div className="min-h-screen bg-cloud" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <Toaster />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center text-brand-slate hover:text-ink mb-8 transition-colors"
            >
              <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} />{' '}
              {t('payment.back_to_intake')}
            </button>

            <h1 className="text-3xl font-bold tracking-tight text-ink mb-8">
              {t('payment.title')}
            </h1>

            <Card className="bg-white border-none shadow-sm p-8" hover={false}>
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-6 border-b border-soft-blue">
                  <span className="text-brand-slate">{t('payment.service')}</span>
                  <span className="font-bold">{t('payment.service_name')}</span>
                </div>

                <div className="rounded-2xl border border-soft-blue bg-cloud p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-soft-blue">
                        <UserCheck className="w-5 h-5 text-ink" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-brand-slate uppercase mb-1">
                          {hasSelectedConsultant
                            ? t('intake.selected_consultant_label')
                            : t('payment.assignment_title')}
                        </p>
                        <p className="font-bold text-ink">
                          {hasSelectedConsultant
                            ? intakeData.selectedConsultantName
                            : t('payment.assign_later_title')}
                        </p>
                        <p className="text-sm text-brand-slate mt-1">
                          {hasSelectedConsultant
                            ? t('payment.selected_consultant_helper')
                            : t('payment.assign_later_desc')}
                        </p>
                      </div>
                    </div>

                    {hasSelectedConsultant && intakeData.selectedConsultantUid ? (
                      <Link href={`/consultants/${intakeData.selectedConsultantUid}`}>
                        <Button type="button" variant="outline" className="h-11 rounded-xl">
                          <ExternalLink className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {t('intake.view_consultant_profile')}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-slate">{t('intake.goal_label')}</span>
                    <span className="font-medium capitalize">
                      {t(`intake.goal_${intakeData.goal}`)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-slate">{t('intake.area_label')}</span>
                    <span className="font-medium">{intakeData.preferredArea}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-slate">{t('intake.budget_label')}</span>
                    <span className="font-medium">{intakeData.budgetRange}</span>
                  </div>
                </div>
                {/* Discount code */}
                <div className="pt-4 border-t border-soft-blue">
                  {appliedDiscount ? (
                    <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <Tag className="w-4 h-4" />
                        <span className="font-medium">{appliedDiscount.code}</span>
                        <span>— {appliedDiscount.percent}% off</span>
                      </div>
                      <button
                        onClick={() => setAppliedDiscount(null)}
                        className="text-emerald-500 hover:text-emerald-700"
                        aria-label="Remove discount"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        placeholder={t('payment.discount_placeholder') || 'Discount code'}
                        className="flex-1 px-4 py-2.5 bg-cloud border-2 border-soft-blue rounded-xl text-sm focus:outline-none focus:border-blue-600 transition-all uppercase"
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyDiscount}
                        loading={validatingDiscount}
                        disabled={!discountCode.trim()}
                      >
                        {t('payment.apply_discount') || 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-soft-blue">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">{t('payment.total_amount')}</span>
                    <div className="text-right">
                      {appliedDiscount && (
                        <p className="text-sm text-brand-slate line-through">{consultationFee.toLocaleString()} EGP</p>
                      )}
                      <p className="text-2xl font-bold">{effectiveFee.toLocaleString()} EGP</p>
                      <p className="text-xs text-brand-slate">{t('payment.one_time')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-8 flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100">
              <Shield className="w-5 h-5 mt-0.5" />
              <p className="text-sm">{t('payment.secure_msg')}</p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            {success ? (
              <Card className="bg-white border-none shadow-xl p-12 text-center" hover={false}>
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{t('payment.success_title')}</h2>
                <p className="text-brand-slate">{t('payment.success_desc')}</p>
              </Card>
            ) : (
              <Card className="bg-white border-none shadow-xl p-8" hover={false}>
                <div className="flex items-center gap-2 mb-8">
                  <CreditCard className="w-6 h-6" />
                  <h2 className="text-xl font-bold">{t('payment.details_title')}</h2>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-cloud rounded-xl border-2 border-soft-blue">
                    <p className="text-xs font-bold text-brand-slate uppercase mb-2">
                      {t('payment.simulated_title')}
                    </p>
                    <p className="text-sm text-brand-slate">{t('payment.simulated_desc')}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-brand-slate justify-center">
                      <Lock className="w-3 h-3" /> {t('payment.secure_ssl')}
                    </div>
                    <Button
                      onClick={handlePayment}
                      className="w-full h-14 text-lg rounded-2xl"
                      loading={processing}
                      disabled={processing}
                    >
                      {t('payment.confirm_and_pay').replace(
                        '{amount}',
                        consultationFee.toLocaleString(),
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
