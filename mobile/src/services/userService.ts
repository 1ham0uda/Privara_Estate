import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { UserProfile, UserRole } from '@/src/types';

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
  },

  async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile;
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'users', profile.uid), {
      ...profile,
      createdAt: serverTimestamp(),
    });
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, updates);
  },

  async getAllUsersByRole(role: UserRole): Promise<UserProfile[]> {
    const q = query(collection(db, 'users'), where('role', '==', role), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
  },
};
