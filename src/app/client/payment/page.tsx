'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { Button, Card } from '@/src/components/UI';
import { paymentService } from '@/src/lib/paymentService';
import { consultationService, settingsService } from '@/src/lib/db';
import { Shield, CreditCard, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import Navbar from '@/src/components/Navbar';
import { toast, Toaster } from 'react-hot-toast';

import { useLanguage } from '@/src/context/LanguageContext';

export default function PaymentPage() {
  const isRTL = false;
  const { profile, loading } = useRoleGuard(['client']);
  const router = useRouter();
  const [intakeData, setIntakeData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [consultationFee, setConsultationFee] = useState(500);

  useEffect(() => {
    const data = localStorage.getItem('pending_intake');
    if (!data) {
      router.push('/client/new-consultation');
      return;
    }
    try {
      setIntakeData(JSON.parse(data));
    } catch (error) {
      console.error('Failed to parse intake data:', error);
      localStorage.removeItem('pending_intake');
      toast.error('There was an issue loading your consultation details. Please start over.');
      router.push('/client/new-consultation');
    }

    const fetchSettings = async () => {
      const settings = await settingsService.getSettings();
      if (settings && settings.consultationFee) {
        setConsultationFee(settings.consultationFee);
      }
    };
    fetchSettings();
  }, [router]);

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const result = await paymentService.processPayment(consultationFee);
      if (result.success) {
        const caseId = await consultationService.createConsultation(
          profile!.uid, 
          profile!.displayName || profile!.email || 'Client', 
          profile!.avatarUrl || undefined, 
          intakeData
        );
        localStorage.removeItem('pending_intake');
        setSuccess(true);
        toast.success('Payment Successful!');
        setTimeout(() => {
          router.push(`/client/cases/${caseId}`);
        }, 2000);
      }
    } catch (error) {
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !intakeData) return null;

  return (
    <div className="min-h-screen bg-gray-50" dir="ltr">
      <Navbar forceLanguage="en" />
      <Toaster />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Summary */}
          <div>
            <button 
              onClick={() => router.back()}
              className="flex items-center text-gray-500 hover:text-black mb-8 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Intake
            </button>
            
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-8">Complete Payment</h1>
            
            <Card className="bg-white border-none shadow-sm p-8" hover={false}>
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                  <span className="text-gray-500">Service</span>
                  <span className="font-bold">Premium Real Estate Consultation</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Goal</span>
                    <span className="font-medium capitalize">{intakeData.goal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Preferred Area</span>
                    <span className="font-medium">{intakeData.preferredArea}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Budget Range</span>
                    <span className="font-medium">{intakeData.budgetRange}</span>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">Total Amount</span>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{consultationFee.toLocaleString()} EGP</p>
                      <p className="text-xs text-gray-400">One-time payment</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-8 flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100">
              <Shield className="w-5 h-5 mt-0.5" />
              <p className="text-sm">
                Your payment is secure. We use industry-standard encryption to protect your data.
              </p>
            </div>
          </div>

          {/* Payment Form */}
          <div className="flex flex-col justify-center">
            {success ? (
              <Card className="bg-white border-none shadow-xl p-12 text-center" hover={false}>
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
                <p className="text-gray-500">Redirecting you to your new consultation...</p>
              </Card>
            ) : (
              <Card className="bg-white border-none shadow-xl p-8" hover={false}>
                <div className="flex items-center gap-2 mb-8">
                  <CreditCard className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Payment Details</h2>
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Simulated Payment</p>
                    <p className="text-sm text-gray-600">
                      This is a demonstration. Clicking the button below will simulate a successful transaction.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
                      <Lock className="w-3 h-3" /> Secure SSL Encryption
                    </div>
                    <Button 
                      onClick={handlePayment} 
                      className="w-full h-14 text-lg rounded-2xl"
                      loading={processing}
                    >
                      Confirm and Pay {consultationFee.toLocaleString()} EGP
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
