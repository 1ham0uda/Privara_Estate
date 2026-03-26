'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, MessageSquare, Plus, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { supportService } from '@/src/lib/db';
import { formatDate } from '@/src/lib/utils';
import { Button, Card, Badge } from '@/src/components/UI';
import { SupportMessage, UserRole } from '@/src/types';

interface SupportWorkspaceProps {
  role: UserRole;
  initialTicketId?: string | null;
}

export default function SupportWorkspace({ role, initialTicketId = null }: SupportWorkspaceProps) {
  const { user, profile } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [creating, setCreating] = useState(false);
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setLoadError('');

    return supportService.subscribeToSupportMessages(
      user.uid,
      (data) => {
        setTickets(data as SupportMessage[]);
        setLoading(false);
      },
      () => {
        setLoadError(t('support.load_error'));
        setLoading(false);
      }
    );
  }, [user, t]);

  useEffect(() => {
    if (initialTicketId && tickets.some((ticket) => ticket.id === initialTicketId)) {
      setSelectedId(initialTicketId);
      return;
    }

    if (!selectedId && tickets.length > 0) {
      setSelectedId(tickets[0].id);
    }

    if (selectedId && !tickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(tickets[0]?.id || null);
    }
  }, [initialTicketId, tickets, selectedId]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [tickets, selectedId]
  );

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newMessage.trim()) return;

    setCreating(true);
    try {
      const ticketId = await supportService.sendSupportMessage(
        user.uid,
        profile.displayName,
        profile.email,
        role,
        newMessage
      );
      setNewMessage('');
      if (ticketId) {
        setSelectedId(ticketId);
      }
      toast.success(t('support.message_sent'));
    } catch (error) {
      toast.error(t('support.create_error'));
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedTicket || !replyText.trim()) return;

    setReplying(true);
    try {
      await supportService.replyToSupportMessage(selectedTicket.id, user.uid, profile.displayName, role, replyText);
      setReplyText('');
      toast.success(t('support.reply_sent'));
    } catch (error) {
      toast.error(t('support.reply_error'));
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
      <div className="space-y-6">
        <Card className="bg-white border-none shadow-sm" hover={false}>
          <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{t('support.create_title')}</h2>
              <p className="text-sm text-gray-500">{t('support.create_description')}</p>
            </div>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('support.type_here')}
              className={`w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-black focus:outline-none text-sm resize-none ${isRTL ? 'text-right' : ''}`}
            />
            <Button type="submit" className="w-full" loading={creating} disabled={!newMessage.trim()}>
              <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('support.submit_ticket')}
            </Button>
          </form>
        </Card>

        <Card className="p-0 bg-white border-none shadow-sm overflow-hidden" hover={false}>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">{t('support.your_tickets')}</h2>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center text-rose-600 text-sm">{loadError}</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">{t('support.no_messages')}</div>
          ) : (
            <div className="max-h-[540px] overflow-y-auto">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full p-4 border-b border-gray-50 text-left transition-colors hover:bg-gray-50 ${selectedId === ticket.id ? 'bg-blue-50' : ''} ${isRTL ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center justify-between gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Badge variant={ticket.status === 'open' ? 'warning' : 'success'}>{t(`support.${ticket.status}`)}</Badge>
                    <span className="text-[11px] text-gray-400">{formatDate(ticket.updatedAt || ticket.createdAt, language)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{ticket.text}</p>
                  <p className="text-xs text-gray-500 mt-1">{ticket.replies?.length || 0} {t('support.replies_count')}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-0 bg-white border-none shadow-sm overflow-hidden min-h-[620px]" hover={false}>
        {!selectedTicket ? (
          <div className="h-full flex items-center justify-center p-8 text-center text-gray-500">
            <div>
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">{t('support.select_ticket')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`p-5 border-b border-gray-100 flex items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div>
                <div className={`flex items-center gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <h2 className="font-bold text-gray-900">{t('support.ticket_details')}</h2>
                  <Badge variant={selectedTicket.status === 'open' ? 'warning' : 'success'}>{t(`support.${selectedTicket.status}`)}</Badge>
                </div>
                <p className="text-sm text-gray-500">{formatDate(selectedTicket.createdAt, language)}</p>
              </div>
            </div>

            <div className="p-6 h-[440px] overflow-y-auto space-y-4 bg-gray-50/60">
              <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
                <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                  <div className={`flex items-center gap-2 mb-2 text-xs text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="font-semibold text-gray-900">{selectedTicket.userName}</span>
                    <span>•</span>
                    <span>{t(`auth.demo_${selectedTicket.userRole}`)}</span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedTicket.text}</p>
                  <p className="text-[11px] text-gray-400 mt-2">{formatDate(selectedTicket.createdAt, language)}</p>
                </div>
              </div>

              {selectedTicket.replies?.map((reply, index) => {
                const isOwnReply = reply.senderId === user?.uid;
                return (
                  <div key={`${selectedTicket.id}-reply-${index}`} className={`flex flex-col ${isOwnReply ? (isRTL ? 'items-start' : 'items-end') : (isRTL ? 'items-end' : 'items-start')}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${isOwnReply ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                      <div className={`flex items-center gap-2 mb-2 text-xs ${isOwnReply ? 'text-gray-300' : 'text-gray-500'} ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={`font-semibold ${isOwnReply ? 'text-white' : 'text-gray-900'}`}>{reply.senderName}</span>
                        <span>•</span>
                        <span>{reply.senderRole === 'admin' ? t('support.support_team') : t(`auth.demo_${reply.senderRole}`)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                      <p className={`text-[11px] mt-2 ${isOwnReply ? 'text-gray-400' : 'text-gray-400'}`}>{formatDate(reply.createdAt, language)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedTicket.status === 'open' ? (
              <form onSubmit={handleSendReply} className="p-5 border-t border-gray-100 bg-white">
                <div className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('support.type_reply')}
                    className={`w-full h-24 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-black focus:outline-none text-sm resize-none ${isRTL ? 'text-right' : ''}`}
                  />
                  <div className={`flex justify-end ${isRTL ? 'justify-start' : ''}`}>
                    <Button type="submit" loading={replying} disabled={!replyText.trim()}>
                      <Send className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {t('support.send_reply')}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-5 border-t border-gray-100 bg-white text-sm text-gray-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t('support.closed_notice')}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
