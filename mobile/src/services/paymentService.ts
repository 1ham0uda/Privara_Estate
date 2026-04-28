import { auth } from '@/src/lib/firebase';
import { IntakeData } from '@/src/types';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export interface InitiatePaymentResponse {
  sessionId: string;
  caseId: string;
  amount: number;
  currency: string;
}

export const paymentService = {
  async initiate(params: { intake?: IntakeData; caseId?: string; language: string }): Promise<InitiatePaymentResponse> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    if (!API_BASE) throw new Error('API base URL is not configured');

    // Force-refresh to avoid sending an expired token (tokens expire after 1h)
    const idToken = await user.getIdToken(true);
    const res = await fetch(`${API_BASE}/api/payments/geidea/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(params),
    });

    if (res.status === 401) {
      // Token may have just expired between refresh and request — retry once
      const freshToken = await user.getIdToken(true);
      const retry = await fetch(`${API_BASE}/api/payments/geidea/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(params),
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryData?.error || 'Payment initiation failed');
      return retryData as InitiatePaymentResponse;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Payment initiation failed');
    return data as InitiatePaymentResponse;
  },

  buildCheckoutUrl(sessionId: string, language: 'en' | 'ar'): string {
    const base = API_BASE.replace(/\/$/, '');
    return `${base}/mobile-checkout?sessionId=${encodeURIComponent(sessionId)}&lang=${language}`;
  },
};
