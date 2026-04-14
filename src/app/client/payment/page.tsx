'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
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

declare global {
  interface Window {
    GeideaCheckout?: new (
      onSuccess: (data: any) => void,
      onError: (data: any) => void,
      onCancel: (data: any) => void,
    ) => {
      startPayment: (sessionId: string, paymentOptions?: unknown, containerId?: string) => void;
    };
  }
}

const CHECKOUT_SCRIPT_URL =
  process.env.NEXT_PUBLIC_GEIDEA_CHECKOUT_SCRIPT_URL ||
  'https://www.merchant.geidea.net/hpp/geideaCheckout.min.js';

export default function PaymentPage() {
  const { t, isRTL, language } = useLanguage();
  const { profile, loading } = useRoleGuard(['client']);
  const { user } = useAuth();
  const router = useRouter();
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [consultationFee, setConsultationFee] = useState(500);
  const [gatewayReady, setGatewayReady] = useState(false);
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);

  useEffect(() => {
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

  const launchCheckout = (sessionId: string, caseId: string) => {
    if (!window.GeideaCheckout) {
      throw new Error(t('payment.gateway_error'));
    }

    const onSuccess = () => {
      sessionStorage.removeItem('pending_intake');
      sessionStorage.removeItem('pending_case_id');
      setPendingCaseId(null);
      setSuccess(true);
      toast.success(t('payment.success_title'));
      setTimeout(() => {
        router.push(`/client/cases/${caseId}`);
      }, 1200);
    };

    const onError = () => {
      toast.error(t('payment.error_failed'));
    };

    const onCancel = () => {
      toast.error(t('payment.cancelled'));
    };

    const payment = new window.GeideaCheckout(onSuccess, onError, onCancel);
    payment.startPayment(sessionId);
  };

  const handlePayment = async () => {
    if (!intakeData || !user) return;
    if (!gatewayReady) {
      toast.error(t('payment.gateway_loading'));
      return;
    }

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

      launchCheckout(data.sessionId, data.caseId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payment.error_failed'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !profile || !intakeData) return null;

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Script
        src={CHECKOUT_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={() => setGatewayReady(true)}
        onError={() => {
          setGatewayReady(false);
          toast.error(t('payment.gateway_error'));
        }}
      />
      <Navbar />
      <Toaster />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-500 hover:text-black mb-8 transition-colors"
            >
              <ArrowLeft className={`w-4 h-4 ${isRTL ? 'ml-2 rotate-180' : 'mr-2'}`} />{' '}
              {t('payment.back_to_intake')}
            </button>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">
              {t('payment.title')}
            </h1>

            <Card className="bg-white border-none shadow-sm p-8" hover={false}>
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                  <span className="text-gray-500">{t('payment.service')}</span>
                  <span className="font-bold">{t('payment.service_name')}</span>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-gray-100">
                        <UserCheck className="w-5 h-5 text-gray-700" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                          {hasSelectedConsultant
                            ? t('intake.selected_consultant_label')
                            : t('payment.assignment_title')}
                        </p>
                        <p className="font-bold text-gray-900">
                          {hasSelectedConsultant
                            ? intakeData.selectedConsultantName
                            : t('payment.assign_later_title')}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
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
                    <span className="text-gray-500">{t('intake.goal_label')}</span>
                    <span className="font-medium capitalize">
                      {t(`intake.goal_${intakeData.goal}`)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('intake.area_label')}</span>
                    <span className="font-medium">{intakeData.preferredArea}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t('intake.budget_label')}</span>
                    <span className="font-medium">{intakeData.budgetRange}</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">{t('payment.total_amount')}</span>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{consultationFee.toLocaleString()} EGP</p>
                      <p className="text-xs text-gray-400">{t('payment.one_time')}</p>
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
                <p className="text-gray-500">{t('payment.success_desc')}</p>
              </Card>
            ) : (
              <Card className="bg-white border-none shadow-xl p-8" hover={false}>
                <div className="flex items-center gap-2 mb-8">
                  <CreditCard className="w-6 h-6" />
                  <h2 className="text-xl font-bold">{t('payment.details_title')}</h2>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                      {t('payment.simulated_title')}
                    </p>
                    <p className="text-sm text-gray-600">{t('payment.simulated_desc')}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
                      <Lock className="w-3 h-3" /> {t('payment.secure_ssl')}
                    </div>
                    <Button
                      onClick={handlePayment}
                      className="w-full h-14 text-lg rounded-2xl"
                      loading={processing}
                      disabled={!gatewayReady || processing}
                    >
                      {gatewayReady
                        ? t('payment.confirm_and_pay').replace(
                            '{amount}',
                            consultationFee.toLocaleString(),
                          )
                        : t('payment.gateway_loading')}
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
