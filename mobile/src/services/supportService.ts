import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { SupportMessage, UserRole } from '@/src/types';
import { notificationService } from './notificationService';

export const supportService = {
  async sendSupportMessage(
    userId: string,
    userName: string,
    userEmail: string,
    userRole: UserRole,
    text: string,
  ): Promise<string> {
    const trimmedText = text.trim();
    if (!trimmedText) throw new Error('Support message text is required');

    const newDoc = await addDoc(collection(db, 'supportMessages'), {
      userId,
      userName,
      userEmail,
      userRole,
      text: trimmedText,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      replies: [],
    });

    const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
    const adminSnapshot = await getDocs(adminQuery);
    await Promise.all(
      adminSnapshot.docs.map((adminDoc) =>
        notificationService.sendNotification({
          userId: adminDoc.id,
          title: 'New support ticket',
          message: `${userName} sent a new support request.`,
          eventType: 'support_ticket_created',
          ticketId: newDoc.id,
          titleKey: 'notifications.support_ticket_created.title',
          messageKey: 'notifications.support_ticket_created.message',
          messageParams: { userName },
        }),
      ),
    );

    return newDoc.id;
  },

  async replyToSupportMessage(
    messageId: string,
    senderId: string,
    senderName: string,
    senderRole: UserRole,
    text: string,
  ): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) throw new Error('Support reply text is required');

    const docRef = doc(db, 'supportMessages', messageId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Support ticket not found');

    const data = docSnap.data();
    if (data.status === 'closed') throw new Error('This support ticket is already closed');

    const replies = Array.isArray(data.replies) ? [...data.replies] : [];
    replies.push({
      senderId,
      senderName,
      senderRole,
      text: trimmedText,
      createdAt: Timestamp.fromDate(new Date()),
    });

    await updateDoc(docRef, { replies, updatedAt: serverTimestamp() });

    if (senderRole === 'admin') {
      await notificationService.sendNotification({
        userId: data.userId,
        title: 'Support replied to your ticket',
        message: 'The support team replied to your ticket.',
        eventType: 'support_ticket_replied',
        ticketId: messageId,
        titleKey: 'notifications.support_ticket_replied.title',
        messageKey: 'notifications.support_ticket_replied.message_user',
      });
    } else {
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      await Promise.all(
        adminSnapshot.docs.map((adminDoc) =>
          notificationService.sendNotification({
            userId: adminDoc.id,
            title: 'New support reply',
            message: `${senderName} replied to a support ticket.`,
            eventType: 'support_ticket_replied',
            ticketId: messageId,
            titleKey: 'notifications.support_ticket_replied.title',
            messageKey: 'notifications.support_ticket_replied.message_admin',
            messageParams: { userName: senderName },
          }),
        ),
      );
    }
  },

  async closeSupportMessage(messageId: string, closedById?: string, closedByName?: string): Promise<void> {
    const docRef = doc(db, 'supportMessages', messageId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Support ticket not found');

    const data = docSnap.data();
    await updateDoc(docRef, {
      status: 'closed',
      updatedAt: serverTimestamp(),
      closedAt: serverTimestamp(),
      ...(closedById ? { closedById } : {}),
      ...(closedByName ? { closedByName } : {}),
    });

    await notificationService.sendNotification({
      userId: data.userId,
      title: 'Support ticket closed',
      message: 'Your support ticket was closed by the support team.',
      eventType: 'support_ticket_closed',
      ticketId: messageId,
      titleKey: 'notifications.support_ticket_closed.title',
      messageKey: 'notifications.support_ticket_closed.message',
    });
  },

  subscribeToSupportMessages(userId: string | undefined, callback: (messages: SupportMessage[]) => void) {
    const q = userId
      ? query(collection(db, 'supportMessages'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
      // Admin view: cap at 50 most recent to avoid unbounded reads
      : query(collection(db, 'supportMessages'), orderBy('createdAt', 'desc'), limit(50));

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SupportMessage));
      callback(messages);
    });
  },
};
