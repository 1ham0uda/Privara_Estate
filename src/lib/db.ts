import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { UserProfile, ConsultationCase, Message, ChangeRequest, ConsultantProfile, QualityAuditReport, UserRole, AppNotification, NotificationEventType } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

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

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const userService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() } as UserProfile;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, 'users', profile.uid), {
        ...profile,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getAllUsersByRole(role: UserRole): Promise<UserProfile[]> {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), where('role', '==', role), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },
};

export const consultationService = {
  async createConsultation(clientId: string, clientName: string, clientAvatarUrl: string | undefined, intake: any): Promise<string> {
    const path = 'consultations';
    try {
      const consultationRef = collection(db, 'consultations');
      const hasSelectedConsultant = Boolean(intake?.selectedConsultantUid && intake?.selectedConsultantName);
      const normalizedIntake = {
        ...intake,
        ...(hasSelectedConsultant
          ? {
              selectedConsultantUid: intake.selectedConsultantUid,
              selectedConsultantName: intake.selectedConsultantName,
            }
          : {
              selectedConsultantUid: null,
              selectedConsultantName: null,
            }),
      };

      const newDoc = await addDoc(consultationRef, {
        clientId: clientId || '',
        clientName: clientName || 'Unknown',
        clientAvatarUrl: clientAvatarUrl || null,
        ...(hasSelectedConsultant
          ? {
              consultantId: intake.selectedConsultantUid,
              consultantName: intake.selectedConsultantName,
            }
          : {}),
        paymentStatus: 'pending',
        status: hasSelectedConsultant ? 'assigned' : 'new',
        stage: 'intake',
        intake: normalizedIntake,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reassignmentRequestStatus: 'none',
      });

      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      await Promise.all(
        adminSnapshot.docs.map((adminDoc) =>
          notificationService.sendNotification({
            userId: adminDoc.id,
            title: 'New consultation request',
            message: hasSelectedConsultant
              ? `${clientName || 'Client'} submitted a consultation request and selected ${intake.selectedConsultantName}.`
              : `${clientName || 'Client'} submitted a consultation request without selecting a consultant.`,
            link: `/admin/cases/${newDoc.id}`,
            eventType: 'consultation_created',
            caseId: newDoc.id,
            titleKey: 'notifications.consultation_created.title',
            messageKey: hasSelectedConsultant
              ? 'notifications.consultation_created.message_with_consultant'
              : 'notifications.consultation_created.message_without_consultant',
            messageParams: {
              clientName: clientName || 'Client',
              consultantName: intake.selectedConsultantName || '',
            },
          })
        )
      );

      if (hasSelectedConsultant) {
        await notificationService.sendNotification({
          userId: intake.selectedConsultantUid,
          title: 'New consultation assigned to you',
          message: `${clientName || 'Client'} submitted a consultation request and selected you.`,
          link: `/consultant/cases/${newDoc.id}`,
          eventType: 'consultation_created',
          caseId: newDoc.id,
          titleKey: 'notifications.consultation_assigned.title',
          messageKey: 'notifications.consultation_assigned.message_consultant',
          messageParams: { clientName: clientName || 'Client' },
        });
      }

      return newDoc.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async assignConsultant(caseId: string, consultantId: string, consultantName: string): Promise<void> {
    const path = `consultations/${caseId}`;
    try {
      const consultation = await this.getConsultation(caseId);
      if (!consultation) return;

      await this.updateConsultation(caseId, {
        consultantId,
        consultantName,
        status: 'assigned',
        updatedAt: serverTimestamp(),
      });

      await notificationService.sendNotification({
        userId: consultation.clientId,
        title: 'Consultant assigned',
        message: `${consultantName} has been assigned to your consultation.`,
        link: `/client/cases/${caseId}`,
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
        link: `/consultant/cases/${caseId}`,
        eventType: 'consultation_assigned',
        caseId,
        titleKey: 'notifications.consultation_assigned.title',
        messageKey: 'notifications.consultation_assigned.message_consultant',
        messageParams: { clientName: consultation.clientName || 'Client' },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async assignQualitySpecialist(caseId: string, qualityId: string, qualityName: string): Promise<void> {
    const path = `consultations/${caseId}`;
    try {
      await this.updateConsultation(caseId, {
        qualitySpecialistId: qualityId,
        qualitySpecialistName: qualityName,
        updatedAt: serverTimestamp(),
      });

      await notificationService.sendNotification({
        userId: qualityId,
        title: 'New quality review assignment',
        message: `You were assigned to review case ${caseId.substring(0, 8)}.`,
        link: `/quality/cases/${caseId}`,
        eventType: 'quality_assigned',
        caseId,
        titleKey: 'notifications.quality_assigned.title',
        messageKey: 'notifications.quality_assigned.message',
        messageParams: { caseNumber: caseId.substring(0, 8) },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async requestConsultantChange(caseId: string, clientId: string, consultantId: string, reason: string): Promise<void> {
    const path = 'changeRequests';
    try {
      const requestRef = collection(db, 'changeRequests');
      await addDoc(requestRef, {
        caseId: caseId || '',
        clientId: clientId || '',
        consultantId: consultantId || '',
        reason: reason || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      await this.updateConsultation(caseId, {
        reassignmentRequestStatus: 'pending'
      });

      // Notify Admin
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      await Promise.all(
        adminSnapshot.docs.map((adminDoc) =>
          notificationService.sendNotification({
            userId: adminDoc.id,
            title: 'Consultant change requested',
            message: `A client requested a consultant change for case ${caseId.substring(0, 8)}.`,
            link: `/admin/cases/${caseId}`,
            eventType: 'consultant_change_requested',
            caseId,
            titleKey: 'notifications.consultant_change_requested.title',
            messageKey: 'notifications.consultant_change_requested.message',
            messageParams: { caseNumber: caseId.substring(0, 8) },
          })
        )
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async reassignConsultant(caseId: string, newConsultantId: string, newConsultantName: string, requestId?: string): Promise<void> {
    const path = `consultations/${caseId}`;
    try {
      const consultation = await this.getConsultation(caseId);
      if (!consultation) return;

      const oldConsultantId = consultation.consultantId;
      const oldConsultantName = consultation.consultantName;

      await this.updateConsultation(caseId, {
        consultantId: newConsultantId,
        consultantName: newConsultantName,
        reassignmentRequestStatus: 'approved',
        status: 'reassigned',
        updatedAt: serverTimestamp(),
      });

      if (requestId) {
        const requestRef = doc(db, 'changeRequests', requestId);
        await updateDoc(requestRef, { status: 'approved' });
      }

      await notificationService.sendNotification({
        userId: consultation.clientId,
        title: 'Consultant reassigned',
        message: `Your consultant was changed to ${newConsultantName}.`,
        link: `/client/cases/${caseId}`,
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
        message: `A consultation was reassigned to you.`,
        link: `/consultant/cases/${caseId}`,
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
          link: `/consultant/dashboard`,
          eventType: 'consultant_reassigned',
          caseId,
          previousConsultantId: oldConsultantId,
          titleKey: 'notifications.consultant_reassigned.title',
          messageKey: 'notifications.consultant_reassigned.message_previous_consultant',
          messageParams: { caseNumber: caseId.substring(0, 8) },
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async getChangeRequests(caseId?: string): Promise<ChangeRequest[]> {
    const path = 'changeRequests';
    try {
      let q;
      if (caseId) {
        q = query(collection(db, 'changeRequests'), where('caseId', '==', caseId), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'changeRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data() as Omit<ChangeRequest, 'id'>;
        return {
          id: doc.id,
          ...data,
        };
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getConsultation(id: string): Promise<ConsultationCase | null> {
    const path = `consultations/${id}`;
    try {
      const docRef = doc(db, 'consultations', id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as ConsultationCase) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async updateConsultation(id: string, updates: Partial<ConsultationCase>): Promise<void> {
    const path = `consultations/${id}`;
    try {
      const docRef = doc(db, 'consultations', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async uploadReport(id: string, file: File): Promise<string> {
    const path = `consultations/${id}/report`;
    try {
      const storageRef = ref(storage, `reports/${id}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await this.updateConsultation(id, {
        reportUrl: downloadURL,
        status: 'report_sent'
      });

      return downloadURL;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  },

  async uploadMeetingRecording(id: string, file: File): Promise<string> {
    const path = `consultations/${id}/meeting`;
    try {
      const storageRef = ref(storage, `meetings/${id}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await this.updateConsultation(id, {
        meetingRecordingUrl: downloadURL,
      });

      return downloadURL;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  },

  async submitRating(id: string, rating: number, feedback: string): Promise<void> {
    const path = `consultations/${id}/rating`;
    try {
      await this.updateConsultation(id, {
        rating,
        feedback,
        status: 'completed'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToConsultations(role: string, uid: string, callback: (cases: ConsultationCase[]) => void) {
    const path = 'consultations';
    let q;
    if (role === 'admin') {
      q = query(collection(db, 'consultations'), orderBy('createdAt', 'desc'));
    } else if (role === 'consultant') {
      q = query(collection(db, 'consultations'), where('consultantId', '==', uid), orderBy('createdAt', 'desc'));
    } else if (role === 'quality') {
      q = query(collection(db, 'consultations'), where('qualitySpecialistId', '==', uid), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'consultations'), where('clientId', '==', uid), orderBy('createdAt', 'desc'));
    }

    return onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConsultationCase));
      callback(cases);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToConsultation(id: string, callback: (data: ConsultationCase | null) => void) {
    const path = `consultations/${id}`;
    const docRef = doc(db, 'consultations', id);
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as ConsultationCase);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },
};

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
    type: Message['type'] = 'text'
  ): Promise<void> {
    const path = 'messages';
    try {
      await addDoc(collection(db, 'messages'), {
        caseId: caseId || '',
        senderId: senderId || '',
        senderName: senderName || 'Unknown',
        senderRole: senderRole || 'client',
        text: text || '',
        clientId: clientId || '',
        consultantId: consultantId || null,
        imageUrl: imageUrl || null,
        audioUrl: audioUrl || null,
        type: type || 'text',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async uploadChatAudio(caseId: string, file: File): Promise<string> {
    const path = `messages/${caseId}/audio`;
    try {
      const storageRef = ref(storage, `chat/${caseId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  },

  async uploadChatImage(caseId: string, file: File): Promise<string> {
    const path = `messages/${caseId}/image`;
    try {
      const storageRef = ref(storage, `chat/${caseId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  },

  subscribeToMessages(caseId: string, callback: (messages: Message[]) => void) {
    const path = 'messages';
    const q = query(
      collection(db, 'messages'),
      where('caseId', '==', caseId),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },
};

export const notificationService = {
  async sendNotification(payload: NotificationPayload): Promise<void> {
    const path = 'notifications';
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: payload.userId || '',
        title: payload.title || '',
        message: payload.message || '',
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
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  subscribeToNotifications(userId: string, callback: (notifications: AppNotification[]) => void) {
    const path = 'notifications';
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      callback(notifications);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async markAsRead(id: string): Promise<void> {
    const path = `notifications/${id}`;
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};

export const qualityService = {
  async submitAuditReport(report: Omit<QualityAuditReport, 'id' | 'createdAt'>): Promise<string> {
    const path = 'auditReports';
    try {
      const reportRef = collection(db, 'auditReports');
      const newDoc = await addDoc(reportRef, {
        ...report,
        createdAt: serverTimestamp(),
      });

      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      await Promise.all(
        adminSnapshot.docs.map((adminDoc) =>
          notificationService.sendNotification({
            userId: adminDoc.id,
            title: 'New quality audit report',
            message: `A new quality report was submitted for case ${report.caseId.substring(0, 8)}.`,
            link: `/admin/cases/${report.caseId}`,
            eventType: 'audit_report_submitted',
            caseId: report.caseId,
            titleKey: 'notifications.audit_report_submitted.title',
            messageKey: 'notifications.audit_report_submitted.message',
            messageParams: { caseNumber: report.caseId.substring(0, 8) },
          })
        )
      );

      return newDoc.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async getAuditReports(caseId: string): Promise<QualityAuditReport[]> {
    const path = 'auditReports';
    try {
      const q = query(collection(db, 'auditReports'), where('caseId', '==', caseId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QualityAuditReport));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getAllAuditReports(): Promise<QualityAuditReport[]> {
    const path = 'auditReports';
    try {
      const q = query(collection(db, 'auditReports'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QualityAuditReport));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getAllQualitySpecialists(): Promise<UserProfile[]> {
    const path = 'users';
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'quality'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  subscribeToAuditReports(onUpdate: (data: QualityAuditReport[]) => void): () => void {
    const q = query(collection(db, 'auditReports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QualityAuditReport));
      onUpdate(reports);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditReports');
    });
  }
};

export const consultantService = {
  async getConsultantProfile(uid: string): Promise<ConsultantProfile | null> {
    const path = `consultantProfiles/${uid}`;
    try {
      const docRef = doc(db, 'consultantProfiles', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? ({ uid: docSnap.id, ...docSnap.data() } as ConsultantProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async getAllConsultants(): Promise<ConsultantProfile[]> {
    const path = 'consultantProfiles';
    try {
      const q = query(collection(db, 'consultantProfiles'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ConsultantProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async createConsultantProfile(profile: ConsultantProfile): Promise<void> {
    const path = `consultantProfiles/${profile.uid}`;
    try {
      await setDoc(doc(db, 'consultantProfiles', profile.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateConsultantProfile(uid: string, updates: Partial<ConsultantProfile>): Promise<void> {
    const path = `consultantProfiles/${uid}`;
    try {
      const docRef = doc(db, 'consultantProfiles', uid);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};

export const supportService = {
  async sendSupportMessage(userId: string, userName: string, userEmail: string, userRole: UserRole, text: string): Promise<string> {
    const path = 'supportMessages';
    const trimmedText = text.trim();

    if (!trimmedText) {
      throw new Error('Support message text is required');
    }

    try {
      const newDoc = await addDoc(collection(db, 'supportMessages'), {
        userId,
        userName,
        userEmail,
        userRole,
        text: trimmedText,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        replies: []
      });

      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      await Promise.all(
        adminSnapshot.docs.map((adminDoc) =>
          notificationService.sendNotification({
            userId: adminDoc.id,
            title: 'New support ticket',
            message: `${userName} sent a new support request.`,
            link: `/admin/support?ticketId=${newDoc.id}`,
            eventType: 'support_ticket_created',
            ticketId: newDoc.id,
            titleKey: 'notifications.support_ticket_created.title',
            messageKey: 'notifications.support_ticket_created.message',
            messageParams: { userName },
          })
        )
      );

      return newDoc.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  async replyToSupportMessage(messageId: string, senderId: string, senderName: string, senderRole: UserRole, text: string): Promise<void> {
    const path = `supportMessages/${messageId}`;
    const trimmedText = text.trim();

    if (!trimmedText) {
      throw new Error('Support reply text is required');
    }

    try {
      const docRef = doc(db, 'supportMessages', messageId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Support ticket not found');
      }

      const data = docSnap.data();
      if (data.status === 'closed') {
        throw new Error('This support ticket is already closed');
      }

      const replies = Array.isArray(data.replies) ? [...data.replies] : [];
      replies.push({
        senderId,
        senderName,
        senderRole,
        text: trimmedText,
        createdAt: new Date(),
      });

      await updateDoc(docRef, {
        replies,
        updatedAt: serverTimestamp(),
      });

      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = senderRole === 'admin' ? null : await getDocs(adminQuery);
      const supportPath = data.userRole === 'client'
        ? `/client/support?ticketId=${messageId}`
        : data.userRole === 'consultant'
          ? `/consultant/support?ticketId=${messageId}`
          : data.userRole === 'quality'
            ? `/quality/support?ticketId=${messageId}`
            : `/admin/support?ticketId=${messageId}`;

      if (senderRole === 'admin') {
        await notificationService.sendNotification({
          userId: data.userId,
          title: 'Support replied to your ticket',
          message: 'The support team replied to your ticket.',
          link: supportPath,
          eventType: 'support_ticket_replied',
          ticketId: messageId,
          titleKey: 'notifications.support_ticket_replied.title',
          messageKey: 'notifications.support_ticket_replied.message_user',
        });
      } else if (adminSnapshot) {
        await Promise.all(
          adminSnapshot.docs.map((adminDoc) =>
            notificationService.sendNotification({
              userId: adminDoc.id,
              title: 'New support reply',
              message: `${senderName} replied to a support ticket.`,
              link: `/admin/support?ticketId=${messageId}`,
              eventType: 'support_ticket_replied',
              ticketId: messageId,
              titleKey: 'notifications.support_ticket_replied.title',
              messageKey: 'notifications.support_ticket_replied.message_admin',
              messageParams: { userName: senderName },
            })
          )
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async closeSupportMessage(messageId: string, closedById?: string, closedByName?: string): Promise<void> {
    const path = `supportMessages/${messageId}`;
    try {
      const docRef = doc(db, 'supportMessages', messageId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Support ticket not found');
      }

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
        link: data.userRole === 'client'
          ? `/client/support?ticketId=${messageId}`
          : data.userRole === 'consultant'
            ? `/consultant/support?ticketId=${messageId}`
            : `/quality/support?ticketId=${messageId}`,
        eventType: 'support_ticket_closed',
        ticketId: messageId,
        titleKey: 'notifications.support_ticket_closed.title',
        messageKey: 'notifications.support_ticket_closed.message',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToSupportMessages(userId?: string, callback?: (messages: any[]) => void, onError?: (error: Error) => void) {
    const path = 'supportMessages';
    const q = userId
      ? query(collection(db, 'supportMessages'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
      : query(collection(db, 'supportMessages'), orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (callback) callback(messages);
    }, (error) => {
      if (onError) {
        onError(error as Error);
        return;
      }
      handleFirestoreError(error, OperationType.LIST, path);
    });
  }
};

export const settingsService = {
  async getSettings(): Promise<any> {
    const path = 'settings/system';
    try {
      const docRef = doc(db, 'settings', 'system');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }

      return { consultationFee: 500 };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return { consultationFee: 500 };
    }
  },

  async updateSettings(updates: any): Promise<void> {
    const path = 'settings/system';
    try {
      const docRef = doc(db, 'settings', 'system');
      await setDoc(docRef, updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
