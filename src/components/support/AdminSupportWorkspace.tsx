'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useLanguage } from '@/src/context/LanguageContext';
import { supportService } from '@/src/lib/db';
import { formatDate } from '@/src/lib/utils';
import { Badge, Button, Card } from '@/src/components/UI';
import { SupportMessage } from '@/src/types';

export default function AdminSupportWorkspace() {
  const { profile, loading: authLoading } = useRoleGuard(['admin']);
  const { t, isRTL, language } = useLanguage();
  const searchParams = useSearchParams();
  const ticketIdFromUrl = searchParams.get('ticketId') || searchParams.get('messageId');
  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError('');

    return supportService.subscribeToSupportMessages(
      undefined,
      (data) => {
        setTickets(data as SupportMessage[]);
        setLoading(false);
      },
      () => {
        setLoadError(t('support.load_error'));
        setLoading(false);
      }
    );
  }, [t]);

  useEffect(() => {
    if (ticketIdFromUrl && tickets.some((ticket) => ticket.id === ticketIdFromUrl)) {
      setSelectedId(ticketIdFromUrl);
      return;
    }

    if (!selectedId && tickets.length > 0) {
      setSelectedId(tickets[0].id);
    }

    if (selectedId && !tickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(tickets[0]?.id || null);
    }
  }, [ticketIdFromUrl, tickets, selectedId]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [tickets, selectedId]
  );

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedTicket || !replyText.trim()) return;

    setReplying(true);
    try {
      await supportService.replyToSupportMessage(selectedTicket.id, profile.uid, profile.displayName, 'admin', replyText);
      setReplyText('');
      toast.success(t('support.reply_sent'));
    } catch (error) {
      toast.error(t('support.reply_error'));
    } finally {
      setReplying(false);
    }
  };

  const handleClose = async () => {
    if (!profile || !selectedTicket) return;

    setClosing(true);
    try {
      await supportService.closeSupportMessage(selectedTicket.id, profile.uid, profile.displayName);
      toast.success(t('support.ticket_closed'));
    } catch (error) {
      toast.error(t('support.close_error'));
    } finally {
      setClosing(false);
    }
  };

  if (authLoading) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 h-[calc(100vh-220px)] min-h-[640px]">
      <Card className="p-0 bg-white border-none shadow-sm overflow-hidden" hover={false}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{t('admin.dashboard.tab.support')}</h2>
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
          <div className="max-h-full overflow-y-auto">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => setSelectedId(ticket.id)}
                className={`w-full p-4 border-b border-gray-50 text-left transition-colors hover:bg-gray-50 ${selectedId === ticket.id ? 'bg-blue-50' : ''} ${isRTL ? 'text-right' : ''}`}
              >
                <div className={`flex items-center justify-between gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-semibold text-gray-900">{ticket.userName}</span>
                  <Badge variant={ticket.status === 'open' ? 'warning' : 'success'}>{t(`support.${ticket.status}`)}</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-1">{ticket.userEmail}</p>
                <p className="text-sm text-gray-700 line-clamp-2">{ticket.text}</p>
                <p className="text-[11px] text-gray-400 mt-2">{formatDate(ticket.updatedAt || ticket.createdAt, language)}</p>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0 bg-white border-none shadow-sm overflow-hidden" hover={false}>
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
                  <h2 className="font-bold text-gray-900">{selectedTicket.userName}</h2>
                  <Badge variant={selectedTicket.status === 'open' ? 'warning' : 'success'}>{t(`support.${selectedTicket.status}`)}</Badge>
                </div>
                <p className="text-sm text-gray-500">{selectedTicket.userEmail} • {t(`auth.demo_${selectedTicket.userRole}`)}</p>
              </div>
              {selectedTicket.status === 'open' ? (
                <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" loading={closing} onClick={handleClose}>
                  {t('support.close_ticket')}
                </Button>
              ) : null}
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
                const isAdminReply = reply.senderRole === 'admin';
                return (
                  <div key={`${selectedTicket.id}-reply-${index}`} className={`flex flex-col ${isAdminReply ? (isRTL ? 'items-start' : 'items-end') : (isRTL ? 'items-end' : 'items-start')}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${isAdminReply ? 'bg-black text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                      <div className={`flex items-center gap-2 mb-2 text-xs ${isAdminReply ? 'text-gray-300' : 'text-gray-500'} ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={`font-semibold ${isAdminReply ? 'text-white' : 'text-gray-900'}`}>{reply.senderName}</span>
                        <span>•</span>
                        <span>{reply.senderRole === 'admin' ? t('support.support_team') : t(`auth.demo_${reply.senderRole}`)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
                      <p className={`text-[11px] mt-2 ${isAdminReply ? 'text-gray-400' : 'text-gray-400'}`}>{formatDate(reply.createdAt, language)}</p>
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
