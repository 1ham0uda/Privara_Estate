import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { SystemSettings } from '@/src/types';

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    const docRef = doc(db, 'settings', 'system');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data() as SystemSettings;
    return { consultationFee: 500 };
  },

  async updateSettings(updates: Partial<SystemSettings>): Promise<void> {
    const docRef = doc(db, 'settings', 'system');
    await setDoc(docRef, updates, { merge: true });
  },
};
