'use client';

import React, { useState } from 'react';
import { Card, Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { Star } from 'lucide-react';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';
import { RatingDetails } from '@/src/types';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string, ratingDetails: RatingDetails) => void;
}

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-brand-slate min-w-[120px]">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
            aria-label={`${s} star${s !== 1 ? 's' : ''}`}
          >
            <Star className={`w-6 h-6 ${s <= value ? 'text-amber-400 fill-amber-400' : 'text-brand-slate/30'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RatingModal({ isOpen, onClose, onSubmit }: RatingModalProps) {
  const { t, isRTL } = useLanguage();
  const containerRef = useFocusTrap(isOpen, onClose);

  const [responsiveness, setResponsiveness] = useState(0);
  const [expertise, setExpertise] = useState(0);
  const [helpfulness, setHelpfulness] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  const subsFilled = responsiveness > 0 && expertise > 0 && helpfulness > 0 && nps !== null;
  const overallRating = subsFilled
    ? Math.round(((responsiveness + expertise + helpfulness) / 3) * 2) / 2
    : 0;

  const handleSubmit = () => {
    if (!subsFilled) return;
    const details: RatingDetails = {
      responsiveness,
      expertise,
      helpfulness,
      nps: nps!,
    };
    onSubmit(overallRating, feedback, details);
  };

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        className={isRTL ? 'rtl' : 'ltr'}
      >
        <Card className="max-w-lg w-full p-8 bg-white shadow-2xl">
          <h2 id="rating-modal-title" className="text-2xl font-bold mb-6">{t('rating.title')}</h2>

          {/* Sub-score rows */}
          <div className="space-y-4 mb-6">
            <StarRow label={t('rating.sub.responsiveness')} value={responsiveness} onChange={setResponsiveness} />
            <StarRow label={t('rating.sub.expertise')} value={expertise} onChange={setExpertise} />
            <StarRow label={t('rating.sub.helpfulness')} value={helpfulness} onChange={setHelpfulness} />
          </div>

          {/* NPS */}
          <div className="mb-6">
            <p className="text-sm text-brand-slate mb-3">{t('rating.sub.nps')}</p>
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNps(n)}
                  className={`w-9 h-9 text-xs font-bold rounded-lg border transition-colors ${
                    nps === n
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-cloud border-soft-blue text-brand-slate hover:border-blue-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-brand-slate/50 mt-1 px-0.5">
              <span>{t('rating.sub.nps_low')}</span>
              <span>{t('rating.sub.nps_high')}</span>
            </div>
          </div>

          {/* Overall indicator */}
          {subsFilled && (
            <div className="flex items-center gap-3 mb-5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-5 h-5 ${s <= overallRating ? 'text-amber-400 fill-amber-400' : 'text-brand-slate/20'}`} />
                ))}
              </div>
              <span className="text-sm font-bold text-amber-700">{overallRating.toFixed(1)} / 5</span>
              <span className="text-xs text-brand-slate ml-1">{t('rating.sub.overall')}</span>
            </div>
          )}

          {/* Feedback */}
          <textarea
            className="w-full p-4 border border-soft-blue rounded-xl mb-6 focus:outline-none focus:border-blue-600 text-sm"
            placeholder={t('rating.feedback_placeholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
          />

          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={handleSubmit}
              disabled={!subsFilled}
            >
              {t('rating.submit')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
