'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { supportService } from '@/src/lib/db';
import { Card, Button } from '@/src/components/UI';
import { useLanguage } from '@/src/context/LanguageContext';
import { formatDate } from '@/src/lib/utils';
import { Send, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function SupportMessagesContent() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const messageIdToScroll = searchParams.get('messageId');
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (user) {
      setLoading(true);
      return supportService.subscribeToSupportMessages(user.uid, (data) => {
        setMessages(data);
        setLoading(false);
      });
    }
  }, [user]);

  useEffect(() => {
    if (messageIdToScroll && messageRefs.current[messageIdToScroll]) {
      messageRefs.current[messageIdToScroll]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messageIdToScroll]);

  const handleSendReply = async (messageId: string) => {
    const text = replyTexts[messageId];
    if (!text?.trim() || !user) return;
    await supportService.replyToSupportMessage(messageId, user.uid, user.displayName || 'Consultant', text);
    setReplyTexts(prev => ({ ...prev, [messageId]: '' }));
  };

  if (loading) {
    return (
      <div className="text-center text-gray-500 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
      </div>
    );
  }

  if (messages.length === 0) {
    return <div className="text-center text-gray-500">{t('support.no_messages')}</div>;
  }

  return (
    <div className="space-y-6">
      {messages.map(msg => (
        <Card key={msg.id} className="p-6 bg-white" ref={el => { messageRefs.current[msg.id] = el; }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">{msg.text}</h3>
            <span className="text-xs text-gray-500">{formatDate(msg.createdAt, language)}</span>
          </div>
          <div className="space-y-4 mb-4">
            {msg.replies?.map((reply: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg ${reply.senderId === user?.uid ? 'bg-blue-50 text-right' : 'bg-gray-100'}`}>
                <p className="text-sm">{reply.text}</p>
                <p className="text-[10px] text-gray-400">{reply.senderName} • {formatDate(reply.createdAt, language)}</p>
              </div>
            ))}
          </div>
          {msg.status === 'open' && (
            <div className="flex gap-2">
              <input 
                type="text" 
                value={replyTexts[msg.id] || ''}
                onChange={(e) => setReplyTexts(prev => ({ ...prev, [msg.id]: e.target.value }))}
                placeholder={t('support.type_reply')}
                className="flex-1 px-4 py-2 border rounded-lg text-sm"
              />
              <Button onClick={() => handleSendReply(msg.id)}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function SupportMessages() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500">Loading...</div>}>
      <SupportMessagesContent />
    </Suspense>
  );
}
