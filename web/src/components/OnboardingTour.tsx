'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/src/context/LanguageContext';
import {
  LayoutDashboard,
  Plus,
  MessageSquare,
  Headphones,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from './UI';

const STORAGE_KEY = (uid: string) => `onboarding_done_${uid}`;

interface Step {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
}

const STEPS: Step[] = [
  {
    icon: <LayoutDashboard className="w-8 h-8" />,
    titleKey: 'onboarding.step1.title',
    descKey: 'onboarding.step1.desc',
  },
  {
    icon: <Plus className="w-8 h-8" />,
    titleKey: 'onboarding.step2.title',
    descKey: 'onboarding.step2.desc',
  },
  {
    icon: <MessageSquare className="w-8 h-8" />,
    titleKey: 'onboarding.step3.title',
    descKey: 'onboarding.step3.desc',
  },
  {
    icon: <Headphones className="w-8 h-8" />,
    titleKey: 'onboarding.step4.title',
    descKey: 'onboarding.step4.desc',
  },
  {
    icon: <Sparkles className="w-8 h-8" />,
    titleKey: 'onboarding.step5.title',
    descKey: 'onboarding.step5.desc',
  },
];

interface Props {
  uid: string;
}

export default function OnboardingTour({ uid }: Props) {
  const { t, isRTL } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const done = localStorage.getItem(STORAGE_KEY(uid));
    if (!done) setVisible(true);
  }, [uid]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY(uid), '1');
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.aria_label')}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative ${isRTL ? 'text-right' : 'text-left'}`}
      >
        {/* Skip button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-1 rounded-lg text-brand-slate hover:text-ink hover:bg-soft-blue transition-colors"
          aria-label={t('onboarding.skip')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step indicator dots */}
        <div className={`flex gap-1.5 mb-8 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-soft-blue'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-16 h-16 bg-soft-blue rounded-2xl flex items-center justify-center text-blue-600 mb-6">
          {current.icon}
        </div>

        {/* Content */}
        <h2 className="font-serif font-bold text-xl text-ink mb-3">
          {t(current.titleKey)}
        </h2>
        <p className="text-sm text-brand-slate leading-relaxed mb-8">
          {t(current.descKey)}
        </p>

        {/* Navigation */}
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          {!isFirst ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className={`flex items-center gap-1 text-sm text-brand-slate hover:text-ink transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {t('onboarding.back')}
            </button>
          ) : (
            <div />
          )}

          {isLast ? (
            <Button onClick={dismiss} className="px-6">
              {t('onboarding.done')}
            </Button>
          ) : (
            <Button onClick={() => setStep(s => s + 1)} className="px-6">
              {t('onboarding.next')}
              {isRTL ? <ChevronLeft className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
