'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { supportService } from '@/src/lib/db';
import { toast } from 'react-hot-toast';
import { X, Send, MessageSquare, Inbox } from 'lucide-react';
import { UserRole } from '@/src/types';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
}

const getSupportPath = (role: UserRole, ticketId?: string | null) => {
  const basePath = role === 'client'
    ? '/client/support'
    : role === 'consultant'
      ? '/consultant/support'
      : role === 'quality'
        ? '/quality/support'
        : '/admin/support';

  return ticketId ? `${basePath}?ticketId=${ticketId}` : basePath;
};

export default function SupportModal({ isOpen, onClose, userId, userName, userEmail, userRole }: SupportModalProps) {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const containerRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      const ticketId = await supportService.sendSupportMessage(
        userId,
        userName,
        userEmail,
        userRole,
        message
      );
      toast.success(t('support.message_sent'));
      setMessage('');
      onClose();
      router.push(getSupportPath(userRole, ticketId));
    } catch (error) {
      console.error('Error sending support message:', error);
      toast.error(t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="support-modal-title">
        <Card className={`max-w-md w-full p-8 bg-white border-none shadow-2xl relative ${isRTL ? 'text-right' : ''}`} hover={false}>
          <button
            onClick={onClose}
            aria-label={t('common.close') || 'Close'}
            className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-brand-slate hover:text-ink transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 rounded`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-500" aria-hidden="true" />
            </div>
            <h2 id="support-modal-title" className="text-xl font-bold">{t('consultant.message_admin')}</h2>
          </div>

          <p className="text-sm text-brand-slate mb-6 leading-relaxed">
            {t('support.description')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => {
                onClose();
                router.push(getSupportPath(userRole));
              }}
            >
              <Inbox className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} aria-hidden="true" />
              {t('support.open_tickets')}
            </Button>

            <div className="h-11 rounded-xl border border-dashed border-soft-blue text-xs text-brand-slate flex items-center justify-center px-4">
              {t('support.open_tickets_hint')}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="support-message" className="text-[10px] font-bold text-brand-slate uppercase tracking-wider">
                {t('support.your_message')}
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('support.type_here')}
                className={`w-full h-32 px-4 py-3 bg-cloud border border-soft-blue rounded-xl focus:border-blue-600 focus:outline-none text-sm resize-none ${isRTL ? 'text-right' : ''}`}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl shadow-lg shadow-black/5"
              loading={sending}
              disabled={!message.trim()}
            >
              <Send className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} aria-hidden="true" />
              {t('support.new_message')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
