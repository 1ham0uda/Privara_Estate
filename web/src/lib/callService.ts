import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { CallIceCandidate, CallSession, ConsultationCase, UserRole } from '../types';

function getCurrentUserErrorContext(error: unknown) {
  return {
    error: error instanceof Error ? error.message : String(error),
    uid: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
  };
}

function logCallError(scope: string, error: unknown) {
  console.error(`[callService:${scope}]`, getCurrentUserErrorContext(error));
}

function mapCallSnapshot<T extends { id: string }>(snapshot: any): T {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export const callService = {
  async createCall(consultation: ConsultationCase, initiator: { uid: string; displayName: string; role: UserRole }) {
    const callRef = await addDoc(collection(db, 'calls'), {
      consultationId: consultation.id,
      clientId: consultation.clientId,
      consultantId: consultation.consultantId || '',
      initiatedBy: initiator.uid,
      initiatedByName: initiator.displayName || 'Unknown',
      initiatedByRole: initiator.role,
      type: 'audio',
      status: 'ringing',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      acceptedAt: null,
      endedAt: null,
      endedBy: null,
      callerJoinedAt: serverTimestamp(),
      calleeJoinedAt: null,
      durationSec: null,
      recordingStatus: 'not_started',
      recordingUrl: null,
      offer: null,
      answer: null,
    });

    return callRef.id;
  },

  async getCall(callId: string): Promise<CallSession | null> {
    try {
      const snapshot = await getDoc(doc(db, 'calls', callId));
      return snapshot.exists() ? mapCallSnapshot<CallSession>(snapshot) : null;
    } catch (error) {
      logCallError('getCall', error);
      return null;
    }
  },

  subscribeToLatestCall(consultationId: string, callback: (call: CallSession | null) => void) {
    const q = query(
      collection(db, 'calls'),
      where('consultationId', '==', consultationId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          callback(null);
          return;
        }
        callback(mapCallSnapshot<CallSession>(snapshot.docs[0]));
      },
      (error) => {
        logCallError('subscribeToLatestCall', error);
      }
    );
  },

  subscribeToCallHistory(consultationId: string, callback: (calls: CallSession[]) => void) {
    const q = query(
      collection(db, 'calls'),
      where('consultationId', '==', consultationId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((docSnap) => mapCallSnapshot<CallSession>(docSnap)));
      },
      (error) => {
        logCallError('subscribeToCallHistory', error);
      }
    );
  },

  async updateCall(callId: string, updates: Partial<CallSession>) {
    try {
      await updateDoc(doc(db, 'calls', callId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      const terminalStatuses: Array<CallSession['status']> = ['ended', 'declined', 'missed'];
      if (updates.status && terminalStatuses.includes(updates.status)) {
        void this.cleanupIceCandidates(callId);
      }
    } catch (error) {
      logCallError('updateCall', error);
      throw error;
    }
  },

  async cleanupIceCandidates(callId: string): Promise<void> {
    try {
      // Only the call initiator performs cleanup to avoid a double-delete race
      // when both peers transition the call to a terminal status simultaneously.
      const callSnap = await getDoc(doc(db, 'calls', callId));
      if (!callSnap.exists()) return;
      const initiatedBy = (callSnap.data() as CallSession).initiatedBy;
      if (auth.currentUser?.uid !== initiatedBy) return;

      const subcollections = ['callerCandidates', 'calleeCandidates'] as const;
      await Promise.all(
        subcollections.map(async (sub) => {
          const snapshot = await getDocs(collection(db, 'calls', callId, sub));
          await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
        })
      );
    } catch (error) {
      logCallError('cleanupIceCandidates', error);
    }
  },

  async saveOffer(callId: string, description: RTCSessionDescriptionInit) {
    return this.updateCall(callId, {
      offer: {
        type: 'offer',
        sdp: description.sdp || '',
      },
    });
  },

  async saveAnswer(callId: string, description: RTCSessionDescriptionInit) {
    return this.updateCall(callId, {
      answer: {
        type: 'answer',
        sdp: description.sdp || '',
      },
      acceptedAt: serverTimestamp() as any,
      status: 'active',
      calleeJoinedAt: serverTimestamp() as any,
    });
  },

  async addIceCandidate(callId: string, candidateRole: 'caller' | 'callee', candidate: RTCIceCandidate) {
    try {
      const subcollection = candidateRole === 'caller' ? 'callerCandidates' : 'calleeCandidates';
      await addDoc(collection(db, 'calls', callId, subcollection), {
        senderId: auth.currentUser?.uid || '',
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      logCallError('addIceCandidate', error);
    }
  },

  subscribeToIceCandidates(callId: string, sourceRole: 'caller' | 'callee', callback: (candidates: CallIceCandidate[]) => void) {
    const subcollection = sourceRole === 'caller' ? 'callerCandidates' : 'calleeCandidates';
    const q = query(collection(db, 'calls', callId, subcollection), orderBy('createdAt', 'asc'));

    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((docSnap) => mapCallSnapshot<CallIceCandidate>(docSnap)));
      },
      (error) => {
        logCallError('subscribeToIceCandidates', error);
      }
    );
  },

  async uploadRecording(consultationId: string, callId: string, file: File, durationSec: number) {
    try {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageRef = ref(storage, `calls/${consultationId}/${callId}/${crypto.randomUUID()}${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      const recordingUrl = await getDownloadURL(snapshot.ref);
      await this.updateCall(callId, {
        recordingUrl,
        recordingStatus: 'ready',
        durationSec,
      });
      // Persist URL to the consultation document so Quality Specialists can access it.
      await updateDoc(doc(db, 'consultations', consultationId), {
        callRecordings: arrayUnion(recordingUrl),
      });
      return recordingUrl;
    } catch (error) {
      logCallError('uploadRecording', error);
      await this.updateCall(callId, { recordingStatus: 'failed' });
      throw error;
    }
  },
};
