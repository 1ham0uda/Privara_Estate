import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { ConsultantProfile } from '@/src/types';

export const consultantService = {
  async getConsultantProfile(uid: string): Promise<ConsultantProfile | null> {
    const docRef = doc(db, 'consultantProfiles', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ uid: docSnap.id, ...docSnap.data() } as ConsultantProfile) : null;
  },

  async getAllConsultants(): Promise<ConsultantProfile[]> {
    const q = query(collection(db, 'consultantProfiles'));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => ({ uid: d.id, ...d.data() } as ConsultantProfile))
      .filter((c) => c.status !== 'deactivated');
  },

  async updateConsultantProfile(uid: string, updates: Partial<ConsultantProfile>): Promise<void> {
    const docRef = doc(db, 'consultantProfiles', uid);
    await updateDoc(docRef, updates);
  },

  async createConsultantProfile(profile: ConsultantProfile): Promise<void> {
    await setDoc(doc(db, 'consultantProfiles', profile.uid), profile);
  },
};
