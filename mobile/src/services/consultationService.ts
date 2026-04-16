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
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { ConsultationCase, ChangeRequest } from '@/src/types';
import { notificationService } from './notificationService';

export const consultationService = {
  async getConsultation(id: string): Promise<ConsultationCase | null> {
    const docRef = doc(db, 'consultations', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as ConsultationCase) : null;
  },

  async updateConsultation(id: string, updates: Partial<ConsultationCase>): Promise<void> {
    const docRef = doc(db, 'consultations', id);
    await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
  },

  async assignConsultant(caseId: string, consultantId: string, consultantName: string): Promise<void> {
    const consultation = await this.getConsultation(caseId);
    if (!consultation) return;

    await this.updateConsultation(caseId, {
      consultantId,
      consultantName,
      status: 'assigned',
    });

    await notificationService.sendNotification({
      userId: consultation.clientId,
      title: 'Consultant assigned',
      message: `${consultantName} has been assigned to your consultation.`,
      eventType: 'consultation_assigned',
      caseId,
      titleKey: 'notifications.consultation_assigned.title',
      messageKey: 'notifications.consultation_assigned.message_client',
      messageParams: { consultantName },
    });

    await notificationService.sendNotification({
      userId: consultantId,
      title: 'New consultation assigned to you',
      message: `${consultation.clientName || 'Client'} has been assigned to you.`,
      eventType: 'consultation_assigned',
      caseId,
      titleKey: 'notifications.consultation_assigned.title',
      messageKey: 'notifications.consultation_assigned.message_consultant',
      messageParams: { clientName: consultation.clientName || 'Client' },
    });
  },

  async assignQualitySpecialist(caseId: string, qualityId: string, qualityName: string): Promise<void> {
    await this.updateConsultation(caseId, {
      qualitySpecialistId: qualityId,
      qualitySpecialistName: qualityName,
    });

    await notificationService.sendNotification({
      userId: qualityId,
      title: 'New quality review assignment',
      message: `You were assigned to review case ${caseId.substring(0, 8)}.`,
      eventType: 'quality_assigned',
      caseId,
      titleKey: 'notifications.quality_assigned.title',
      messageKey: 'notifications.quality_assigned.message',
      messageParams: { caseNumber: caseId.substring(0, 8) },
    });
  },

  async requestConsultantChange(caseId: string, clientId: string, consultantId: string, reason: string): Promise<void> {
    await addDoc(collection(db, 'changeRequests'), {
      caseId,
      clientId,
      consultantId,
      reason,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    await this.updateConsultation(caseId, { reassignmentRequestStatus: 'pending' });

    const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
    const adminSnapshot = await getDocs(adminQuery);
    await Promise.all(
      adminSnapshot.docs.map((adminDoc) =>
        notificationService.sendNotification({
          userId: adminDoc.id,
          title: 'Consultant change requested',
          message: `A client requested a consultant change for case ${caseId.substring(0, 8)}.`,
          eventType: 'consultant_change_requested',
          caseId,
          titleKey: 'notifications.consultant_change_requested.title',
          messageKey: 'notifications.consultant_change_requested.message',
          messageParams: { caseNumber: caseId.substring(0, 8) },
        }),
      ),
    );
  },

  async reassignConsultant(caseId: string, newConsultantId: string, newConsultantName: string, requestId?: string): Promise<void> {
    const consultation = await this.getConsultation(caseId);
    if (!consultation) return;

    const oldConsultantId = consultation.consultantId;

    await this.updateConsultation(caseId, {
      consultantId: newConsultantId,
      consultantName: newConsultantName,
      reassignmentRequestStatus: 'approved',
      status: 'reassigned',
    });

    if (requestId) {
      await updateDoc(doc(db, 'changeRequests', requestId), { status: 'approved' });
    }

    await notificationService.sendNotification({
      userId: consultation.clientId,
      title: 'Consultant reassigned',
      message: `Your consultant was changed to ${newConsultantName}.`,
      eventType: 'consultant_reassigned',
      caseId,
      previousConsultantId: oldConsultantId || null,
      titleKey: 'notifications.consultant_reassigned.title',
      messageKey: 'notifications.consultant_reassigned.message_client',
      messageParams: { consultantName: newConsultantName },
    });

    await notificationService.sendNotification({
      userId: newConsultantId,
      title: 'Consultation reassigned to you',
      message: 'A consultation was reassigned to you.',
      eventType: 'consultant_reassigned',
      caseId,
      previousConsultantId: oldConsultantId || null,
      titleKey: 'notifications.consultant_reassigned.title',
      messageKey: 'notifications.consultant_reassigned.message_new_consultant',
    });

    if (oldConsultantId) {
      await notificationService.sendNotification({
        userId: oldConsultantId,
        title: 'Consultation reassigned',
        message: `Case ${caseId.substring(0, 8)} was reassigned to another consultant.`,
        eventType: 'consultant_reassigned',
        caseId,
        previousConsultantId: oldConsultantId,
        titleKey: 'notifications.consultant_reassigned.title',
        messageKey: 'notifications.consultant_reassigned.message_previous_consultant',
        messageParams: { caseNumber: caseId.substring(0, 8) },
      });
    }
  },

  async getChangeRequests(caseId?: string): Promise<ChangeRequest[]> {
    const q = caseId
      ? query(collection(db, 'changeRequests'), where('caseId', '==', caseId), orderBy('createdAt', 'desc'))
      : query(collection(db, 'changeRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ChangeRequest));
  },

  async submitRating(id: string, rating: number, feedback: string): Promise<void> {
    await this.updateConsultation(id, { rating, feedback, status: 'completed' });
  },

  subscribeToConsultations(role: string, uid: string, callback: (cases: ConsultationCase[]) => void) {
    let q;
    if (role === 'admin') {
      q = query(collection(db, 'consultations'), orderBy('createdAt', 'desc'), limit(50));
    } else if (role === 'consultant') {
      q = query(collection(db, 'consultations'), where('consultantId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    } else if (role === 'quality') {
      q = query(collection(db, 'consultations'), where('qualitySpecialistId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    } else {
      q = query(collection(db, 'consultations'), where('clientId', '==', uid), orderBy('createdAt', 'desc'), limit(50));
    }

    return onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ConsultationCase));
      callback(cases);
    });
  },

  subscribeToConsultation(id: string, callback: (data: ConsultationCase | null) => void) {
    const docRef = doc(db, 'consultations', id);
    return onSnapshot(docRef, (snapshot) => {
      callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as ConsultationCase) : null);
    });
  },
};
