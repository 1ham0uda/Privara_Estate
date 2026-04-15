'use client';

import React, { useState } from 'react';
import { Card, Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { Star } from 'lucide-react';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => void;
}

export default function RatingModal({ isOpen, onClose, onSubmit }: RatingModalProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full p-8 bg-white shadow-2xl">
        <h2 className="text-2xl font-bold mb-4">{t('rating.title')}</h2>
        
        <div className="flex gap-2 mb-6 justify-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-8 h-8 cursor-pointer ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
              onClick={() => setRating(star)}
            />
          ))}
        </div>

        <textarea
          className="w-full p-4 border border-gray-200 rounded-xl mb-6 focus:outline-none focus:border-black"
          placeholder={t('rating.feedback_placeholder')}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
        />

        <div className="flex gap-4">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button 
            className="flex-1 rounded-xl" 
            onClick={() => onSubmit(rating, feedback)}
            disabled={rating === 0}
          >
            {t('rating.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
