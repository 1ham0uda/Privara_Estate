'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from 'lucide-react';
import { notificationService } from '@/src/lib/db';
import { AppNotification } from '@/src/types';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

export default function NotificationDropdown() {
  const { user } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = notificationService.subscribeToNotifications(user.uid, (data) => {
      setNotifications(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const resolveNotificationText = (notification: AppNotification, key: 'title' | 'message') => {
    const translationKey = key === 'title' ? notification.titleKey : notification.messageKey;
    if (translationKey) {
      return t(translationKey, notification.messageParams);
    }
    return key === 'title' ? notification.title : notification.message;
  };

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await Promise.all(notifications.filter(n => !n.read).map(n => notificationService.markAsRead(n.id)));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-brand-slate hover:text-ink transition-colors rounded-full hover:bg-soft-blue"
        aria-label={unreadCount > 0 ? `${t('notifications.title')} — ${unreadCount} ${t('notifications.new')}` : t('notifications.title')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute z-50 mt-2 w-80 bg-white rounded-xl shadow-xl border border-soft-blue overflow-hidden right-0"
            >
              <div className={`p-4 border-b border-soft-blue flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className="font-semibold text-ink">
                  {t('notifications.title')}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    aria-label={t('notifications.mark_all_read') || 'Mark all as read'}
                  >
                    <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('notifications.mark_all_read') || 'Mark all read'}
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-slate" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-brand-slate text-sm">
                    {t('notifications.none')}
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-soft-blue hover:bg-cloud transition-colors relative ${!notification.read ? 'bg-soft-blue/50' : ''}`}
                    >
                      <div className={`flex justify-between items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <p className="text-sm font-medium text-ink">{resolveNotificationText(notification, 'title')}</p>
                          <p className="text-xs text-brand-slate mt-1">{resolveNotificationText(notification, 'message')}</p>
                          {notification.link && (
                            <Link
                              href={notification.link}
                              onClick={() => setIsOpen(false)}
                              className={`text-xs text-blue-600 font-medium mt-2 flex items-center gap-1 hover:underline ${isRTL ? 'flex-row-reverse' : ''}`}
                            >
                              {t('notifications.view_details')}
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1 text-blue-600 hover:bg-soft-blue rounded-full transition-colors shrink-0"
                            aria-label={t('notifications.mark_as_read')}
                            title={t('notifications.mark_as_read')}
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <p className={`text-[10px] text-brand-slate mt-2 ${isRTL ? 'text-left' : 'text-right'}`}>
                        {notification.createdAt?.toDate ? new Date(notification.createdAt.toDate()).toLocaleString(language) : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
