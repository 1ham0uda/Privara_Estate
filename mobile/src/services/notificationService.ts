import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { AppNotification, NotificationEventType } from '@/src/types';

interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  link?: string;
  actorId?: string;
  eventType?: NotificationEventType;
  caseId?: string;
  ticketId?: string;
  previousConsultantId?: string | null;
  titleKey?: string;
  messageKey?: string;
  messageParams?: Record<string, string>;
}

export const notificationService = {
  async sendNotification(payload: NotificationPayload): Promise<void> {
    await addDoc(collection(db, 'notifications'), {
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      link: payload.link || null,
      actorId: payload.actorId || auth.currentUser?.uid || '',
      eventType: payload.eventType || null,
      caseId: payload.caseId || null,
      ticketId: payload.ticketId || null,
      previousConsultantId: payload.previousConsultantId || null,
      titleKey: payload.titleKey || null,
      messageKey: payload.messageKey || null,
      messageParams: payload.messageParams || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  subscribeToNotifications(userId: string, callback: (notifications: AppNotification[]) => void) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
      callback(notifications);
    });
  },

  async markAsRead(id: string): Promise<void> {
    const docRef = doc(db, 'notifications', id);
    await updateDoc(docRef, { read: true });
  },
};
