// Analytics helpers — PostHog (product analytics) + GA4 (traffic / SEO).
// Both are opt-in: functions are no-ops when keys are absent.

declare global {
  interface Window {
    posthog?: {
      init: (key: string, options: Record<string, unknown>) => void;
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify: (distinctId: string, properties?: Record<string, unknown>) => void;
      reset: () => void;
      getFeatureFlag: (flag: string) => boolean | string | undefined;
      onFeatureFlags: (callback: () => void) => (() => void) | undefined;
      isFeatureEnabled: (flag: string) => boolean | undefined;
    };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let posthogInitialised = false;

export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (posthogInitialised) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage',
      autocapture: false,
    });
    window.posthog = posthog as typeof window.posthog;
    posthogInitialised = true;
  });
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.posthog?.capture(event, properties);

  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', event, properties ?? {});
  }
}

export function identifyUser(uid: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.posthog?.identify(uid, properties);
}

export function resetAnalyticsUser() {
  if (typeof window === 'undefined') return;
  window.posthog?.reset();
}

// ─── Funnel event helpers ──────────────────────────────────────────────────────

export const analyticsEvents = {
  // Intake funnel
  intakeStepViewed:   (step: number) => captureEvent('intake_step_viewed',   { step }),
  intakeStepComplete: (step: number) => captureEvent('intake_step_completed', { step }),
  intakeSubmitted:    (goal: string) => captureEvent('intake_submitted',      { goal }),

  // Payment funnel
  paymentPageViewed:     ()            => captureEvent('payment_page_viewed'),
  discountApplied:       (pct: number) => captureEvent('discount_applied', { discount_percent: pct }),
  paymentInitiated:      (amount: number, currency: string) =>
    captureEvent('payment_initiated', { amount, currency }),
  paymentCompleted:      (amount: number, currency: string) =>
    captureEvent('payment_completed', { amount, currency }),

  // Engagement
  firstMessageSent:    (caseId: string) => captureEvent('first_message_sent',    { case_id: caseId }),
  reportUploaded:      (caseId: string) => captureEvent('report_uploaded',       { case_id: caseId }),
  caseRated:           (nps: number)    => captureEvent('case_rated',            { nps }),
  referralCodeShared:  ()               => captureEvent('referral_code_shared'),
  referralSignup:      (code: string)   => captureEvent('referral_signup',       { referral_code: code }),
};
