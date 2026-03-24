'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, ExternalLink, Loader2 } from 'lucide-react';
import { notificationService } from '@/src/lib/db';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';

export default function NotificationDropdown() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isRTL = false;
  const [notifications, setNotifications] = useState<any[]>([]);
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

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
  };

  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      notifications.forEach(n => {
        if (!n.read) {
          handleMarkAsRead(n.id);
        }
      });
    }
  }, [isOpen, unreadCount, notifications]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-black transition-colors rounded-full hover:bg-gray-100"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
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
              className="absolute z-50 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden right-0"
            >
              <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {t('notifications.title')}
                </h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                    {unreadCount} {t('notifications.new')}
                  </span>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    {t('notifications.none')}
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors relative ${!notification.read ? 'bg-indigo-50/30' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                          {notification.link && (
                            <Link 
                              href={notification.link}
                              onClick={() => setIsOpen(false)}
                              className="text-xs text-indigo-600 font-medium mt-2 flex items-center gap-1 hover:underline"
                            >
                              {t('notifications.view_details')}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                            title={t('notifications.mark_as_read')}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 text-right">
                        {notification.createdAt?.toDate ? new Date(notification.createdAt.toDate()).toLocaleString() : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-gray-50 text-center">
                <button className="text-xs font-medium text-gray-600 hover:text-black">
                  {t('notifications.view_all')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
