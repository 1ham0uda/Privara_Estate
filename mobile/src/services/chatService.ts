import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Message } from '@/src/types';

export const chatService = {
  async sendMessage(
    caseId: string,
    senderId: string,
    senderName: string,
    senderRole: string,
    text: string,
    clientId: string,
    consultantId?: string,
    imageUrl?: string,
    audioUrl?: string,
    type: Message['type'] = 'text',
  ): Promise<void> {
    await addDoc(collection(db, 'messages'), {
      caseId,
      senderId,
      senderName,
      senderRole,
      text: text || '',
      clientId,
      consultantId: consultantId || null,
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      type,
      createdAt: serverTimestamp(),
    });
  },

  subscribeToMessages(caseId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, 'messages'),
      where('caseId', '==', caseId),
      orderBy('createdAt', 'asc'),
      limit(100),
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      callback(messages);
    });
  },
};
