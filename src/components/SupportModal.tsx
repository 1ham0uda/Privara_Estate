'use client';

import React, { useState } from 'react';
import { Card, Button, Input } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { supportService } from '@/src/lib/db';
import { toast } from 'react-hot-toast';
import { X, Send, MessageSquare } from 'lucide-react';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
}

export default function SupportModal({ isOpen, onClose, userId, userName, userEmail, userRole }: SupportModalProps) {
  const { t, isRTL } = useLanguage();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      await supportService.sendSupportMessage(
        userId,
        userName,
        userEmail,
        userRole as any,
        message
      );
      toast.success(t('support.message_sent'));
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending support message:', error);
      toast.error(t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <Card className={`max-w-md w-full p-8 bg-white border-none shadow-2xl relative ${isRTL ? 'text-right' : ''}`} hover={false}>
        <button 
          onClick={onClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} text-gray-400 hover:text-black transition-colors`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold">{t('consultant.message_admin')}</h2>
        </div>

        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {t('support.description')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {t('support.your_message')}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('support.type_here')}
              className={`w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-black focus:outline-none text-sm resize-none ${isRTL ? 'text-right' : ''}`}
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 rounded-xl shadow-lg shadow-black/5" 
            loading={sending}
            disabled={!message.trim()}
          >
            <Send className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('common.send')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
