import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import {
  UserProfile, ConsultationCase, Message, ChangeRequest, ConsultantProfile,
  QualityAuditReport, UserRole, AppNotification, NotificationEventType,
  SystemSettings, ScheduledMeeting, RatingDetails, StructuredReport,
  ReportSection, ComparableProperty, NotificationPreferences,
  ConsultantAvailability, PaginatedResult, AuditCriterion,
  ConsultantSettlement, ConsultantPayoutSummary, FinancePeriodKey, FinanceRange,
} from '../types';

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

// Typed `never` so TypeScript knows every call site diverges — eliminates
// unreachable `return null/[]` dead code after each invocation.
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  // Log only the error code/message and operation context — no auth PII.
  const code = (error as { code?: string })?.code ?? 'unknown';
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db] Firestore error op=${operationType} path=${path ?? '(none)'} code=${code}: ${message}`);
  throw new Error(`Firestore ${operationType} failed on "${path ?? '(none)'}": [${code}] ${message}`);
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
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageRef = ref(storage, `reports/${id}/${crypto.randomUUID()}${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await this.updateConsultation(id, {
        reportUrl: downloadURL,
        status: 'report_sent'
      });

      return downloadURL;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async uploadMeetingRecording(id: string, file: File): Promise<string> {
    const path = `consultations/${id}/meeting`;
    try {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageRef = ref(storage, `meetings/${id}/${crypto.randomUUID()}${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await this.updateConsultation(id, {
        meetingRecordingUrl: downloadURL,
      });

      return downloadURL;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async submitRating(id: string, rating: number, feedback: string, ratingDetails?: RatingDetails): Promise<void> {
    const path = `consultations/${id}/rating`;
    try {
      await this.updateConsultation(id, {
        rating,
        feedback,
        status: 'completed',
        ...(ratingDetails ? { ratingDetails } : {}),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async replyToRating(id: string, reply: string): Promise<void> {
    const path = `consultations/${id}/ratingReply`;
    try {
      const existing = await this.getConsultation(id);
      await this.updateConsultation(id, {
        ratingDetails: {
          ...(existing?.ratingDetails ?? { responsiveness: 0, expertise: 0, helpfulness: 0, nps: 0 }),
          consultantReply: reply,
          consultantRepliedAt: serverTimestamp(),
        },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToConsultations(role: string, uid: string, callback: (cases: ConsultationCase[], hasMore: boolean) => void, limitCount = 50) {
    const path = 'consultations';
    const fetchLimit = limitCount + 1;
    let q;
    if (role === 'admin') {
      q = query(collection(db, 'consultations'), orderBy('createdAt', 'desc'), limit(fetchLimit));
    } else if (role === 'consultant') {
      q = query(collection(db, 'consultations'), where('consultantId', '==', uid), orderBy('createdAt', 'desc'), limit(fetchLimit));
    } else if (role === 'quality') {
      q = query(collection(db, 'consultations'), where('qualitySpecialistId', '==', uid), orderBy('createdAt', 'desc'), limit(fetchLimit));
    } else {
      q = query(collection(db, 'consultations'), where('clientId', '==', uid), orderBy('createdAt', 'desc'), limit(fetchLimit));
    }

    return onSnapshot(q, (snapshot) => {
      const hasMore = snapshot.docs.length > limitCount;
      const cases = snapshot.docs.slice(0, limitCount).map(doc => ({ id: doc.id, ...doc.data() } as ConsultationCase));
      callback(cases, hasMore);
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
    type: Message['type'] = 'text',
    fileAttachment?: { fileUrl: string; fileName: string; fileType: string; fileSize: number }
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
        fileUrl: fileAttachment?.fileUrl || null,
        fileName: fileAttachment?.fileName || null,
        fileType: fileAttachment?.fileType || null,
        fileSize: fileAttachment?.fileSize || null,
        type: type || 'text',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async uploadChatFile(caseId: string, file: File): Promise<string> {
    const path = `chat/${caseId}/files`;
    try {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageRef = ref(storage, `${path}/${crypto.randomUUID()}${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      return getDownloadURL(snapshot.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async uploadChatAudio(caseId: string, file: File): Promise<string> {
    const path = `messages/${caseId}/audio`;
    try {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageRef = ref(storage, `chat/${caseId}/${crypto.randomUUID()}${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async uploadChatImage(caseId: string, file: File): Promise<string> {
    const path = `messages/${caseId}/image`;
    try {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      const storageRef = ref(storage, `chat/${caseId}/${crypto.randomUUID()}${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  subscribeToMessages(caseId: string, callback: (messages: Message[]) => void) {
    const path = 'messages';
    const q = query(
      collection(db, 'messages'),
      where('caseId', '==', caseId),
      orderBy('createdAt', 'asc'),
      limit(100)
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
        createdAt: Timestamp.fromDate(new Date()),
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
  async getSettings(): Promise<SystemSettings> {
    const path = 'settings/system';
    try {
      const docRef = doc(db, 'settings', 'system');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as SystemSettings;
      }

      return { consultationFee: 500, allowRegistrations: true, maintenanceMode: false };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async updateSettings(updates: Partial<SystemSettings>): Promise<void> {
    const path = 'settings/system';
    try {
      const docRef = doc(db, 'settings', 'system');
      await setDoc(docRef, updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};

function toDateValue(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value?.toDate === 'function') return value.toDate();
  return new Date(value);
}

function toPeriodKey(date: Date): FinancePeriodKey {
  const month = date.getUTCMonth() + 1;
  return `${date.getUTCFullYear()}-${month.toString().padStart(2, '0')}` as FinancePeriodKey;
}

export const financeService = {
  getPeriodBoundaries(anchorDate = new Date()): { periodKey: FinancePeriodKey; start: Date; end: Date } {
    const year = anchorDate.getUTCFullYear();
    const month = anchorDate.getUTCMonth();
    const day = anchorDate.getUTCDate();
    const start = day >= 20
      ? new Date(Date.UTC(year, month, 20, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, 20, 0, 0, 0, 0));
    const end = day >= 20
      ? new Date(Date.UTC(year, month + 1, 19, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month, 19, 23, 59, 59, 999));
    return { periodKey: toPeriodKey(start), start, end };
  },

  async updateConsultantPricing(uid: string, customConsultationFee: number): Promise<void> {
    const path = `consultantProfiles/${uid}`;
    try {
      await updateDoc(doc(db, 'consultantProfiles', uid), { customConsultationFee });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async buildConsultantPayoutsForPeriod(periodStart: Date, periodEnd: Date): Promise<void> {
    const path = 'consultantPayouts';
    try {
      const settings = await settingsService.getSettings();
      const share = Number(settings.consultantRevenueSharePercent ?? 80);
      const periodKey = toPeriodKey(periodStart);

      const [consultationsSnap, consultantsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'consultations'),
          where('status', '==', 'completed'),
          where('updatedAt', '>=', Timestamp.fromDate(periodStart)),
          where('updatedAt', '<=', Timestamp.fromDate(periodEnd)),
        )),
        getDocs(collection(db, 'consultantProfiles')),
      ]);

      const consultantMap = new Map(consultantsSnap.docs.map((d) => [d.id, d.data()]));
      const grouped = new Map<string, ConsultantSettlement[]>();

      consultationsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const consultantId = data.consultantId;
        if (!consultantId) return;
        const consultant = consultantMap.get(consultantId) as any;
        if (!consultant) return;
        const fee = Number(consultant.customConsultationFee ?? settings.standardFee ?? settings.consultationFee ?? 500);
        const gross = Number((fee * (share / 100)).toFixed(2));
        const qualityScore = Number(data.rating ?? 0);
        const deductionPercent = qualityScore > 0 && qualityScore < 3 ? 20 : qualityScore >= 3 && qualityScore < 4 ? 10 : 0;
        const deductionAmount = Number((gross * (deductionPercent / 100)).toFixed(2));
        const net = Number((gross - deductionAmount).toFixed(2));
        const settlement: ConsultantSettlement = {
          consultationId: docSnap.id,
          caseNumber: docSnap.id.slice(-6).toUpperCase(),
          clientName: data.clientName ?? 'Client',
          completedAt: data.completedAt ?? data.updatedAt ?? Timestamp.now(),
          consultationFee: fee,
          consultantSharePercent: share,
          grossAmount: gross,
          qualityScore: qualityScore || undefined,
          deductionPercent,
          deductionAmount,
          netAmount: net,
          notes: deductionPercent > 0 ? 'Quality deduction applied' : '',
        };
        const current = grouped.get(consultantId) ?? [];
        current.push(settlement);
        grouped.set(consultantId, current);
      });

      const batch = writeBatch(db);
      grouped.forEach((items, consultantId) => {
        const consultantData = consultantMap.get(consultantId) as any;
        const grossAmount = Number(items.reduce((acc, item) => acc + item.grossAmount, 0).toFixed(2));
        const totalDeductions = Number(items.reduce((acc, item) => acc + item.deductionAmount, 0).toFixed(2));
        const netAmount = Number((grossAmount - totalDeductions).toFixed(2));
        const payoutRef = doc(db, 'consultantPayouts', `${periodKey}_${consultantId}`);
        const summary: ConsultantPayoutSummary = {
          consultantId,
          consultantName: consultantData?.name ?? 'Consultant',
          periodKey,
          periodStart: Timestamp.fromDate(periodStart),
          periodEnd: Timestamp.fromDate(periodEnd),
          consultationsCount: items.length,
          grossAmount,
          totalDeductions,
          netAmount,
          status: 'draft',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        batch.set(payoutRef, { ...summary, settlements: items }, { merge: true });
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async listPayouts(periodKey?: FinancePeriodKey): Promise<(ConsultantPayoutSummary & { id: string; settlements: ConsultantSettlement[] })[]> {
    const path = 'consultantPayouts';
    try {
      const q = periodKey
        ? query(collection(db, 'consultantPayouts'), where('periodKey', '==', periodKey))
        : query(collection(db, 'consultantPayouts'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as any));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async listConsultantPayouts(consultantId: string): Promise<(ConsultantPayoutSummary & { id: string; settlements: ConsultantSettlement[] })[]> {
    const path = 'consultantPayouts';
    try {
      const q = query(collection(db, 'consultantPayouts'), where('consultantId', '==', consultantId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as any))
        .sort((a, b) => toDateValue(b.periodStart).getTime() - toDateValue(a.periodStart).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async markPayoutAsPaid(payoutId: string, paidReference: string, paidByAdminId: string): Promise<void> {
    const path = `consultantPayouts/${payoutId}`;
    try {
      await updateDoc(doc(db, 'consultantPayouts', payoutId), {
        status: 'paid',
        paidReference,
        paidByAdminId,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  computeRangeTotals(
    payouts: Array<ConsultantPayoutSummary & { settlements?: ConsultantSettlement[] }>,
    range: FinanceRange,
    metric: 'gross' | 'net'
  ): number {
    const now = new Date();
    const threshold = new Date(now);
    if (range === 'daily') threshold.setUTCDate(now.getUTCDate() - 1);
    if (range === 'weekly') threshold.setUTCDate(now.getUTCDate() - 7);
    if (range === 'monthly') threshold.setUTCMonth(now.getUTCMonth() - 1);
    return Number(
      payouts
        .filter((p) => toDateValue(p.periodEnd) >= threshold)
        .reduce((acc, p) => acc + (metric === 'gross' ? p.grossAmount : p.netAmount), 0)
        .toFixed(2)
    );
  },
};

// ─── Consultant availability ───────────────────────────────────────────────────
export const availabilityService = {
  async updateAvailability(uid: string, availability: ConsultantAvailability, note?: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'consultantProfiles', uid), {
        availability,
        availabilityNote: note ?? '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `consultantProfiles/${uid}`);
    }
  },

  async requestConsultantReassignment(caseId: string, reason: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'consultations', caseId), {
        consultantReassignmentRequest: { reason, requestedAt: serverTimestamp() },
        reassignmentRequestStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `consultations/${caseId}`);
    }
  },
};

// ─── Scheduled meetings ────────────────────────────────────────────────────────
export const meetingService = {
  async proposeMeeting(meeting: Omit<ScheduledMeeting, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const ref = await addDoc(collection(db, 'meetings'), {
        ...meeting,
        status: 'scheduled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meetings');
    }
  },

  async updateMeeting(id: string, updates: Partial<ScheduledMeeting>): Promise<void> {
    try {
      await updateDoc(doc(db, 'meetings', id), { ...updates, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `meetings/${id}`);
    }
  },

  subscribeToMeetings(caseId: string, callback: (meetings: ScheduledMeeting[]) => void) {
    const q = query(
      collection(db, 'meetings'),
      where('caseId', '==', caseId),
      orderBy('scheduledAt', 'asc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduledMeeting)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'meetings'));
  },

  generateICS(meeting: ScheduledMeeting): string {
    const start = meeting.scheduledAt?.toDate ? meeting.scheduledAt.toDate() : new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + meeting.durationMinutes * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Real Real Estate//EN',
      'BEGIN:VEVENT',
      `UID:${meeting.id}@realrealestate`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${meeting.title}`,
      meeting.notes ? `DESCRIPTION:${meeting.notes}` : '',
      meeting.meetingLink ? `URL:${meeting.meetingLink}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  },
};

// ─── Structured report builder ────────────────────────────────────────────────
export const reportBuilderService = {
  async saveReport(caseId: string, report: StructuredReport): Promise<void> {
    try {
      await updateDoc(doc(db, 'consultations', caseId), {
        structuredReport: report,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `consultations/${caseId}`);
    }
  },

  async uploadSectionPhoto(caseId: string, file: File): Promise<string> {
    try {
      const storageRef = ref(storage, `reports/${caseId}/photos/${crypto.randomUUID()}`);
      const snap = await uploadBytes(storageRef, file);
      return getDownloadURL(snap.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `reports/${caseId}`);
    }
  },

  defaultSections(): ReportSection[] {
    return [
      { id: 'executive_summary', title: 'Executive Summary', content: '' },
      { id: 'market_context', title: 'Market Context', content: '' },
      { id: 'comparable_properties', title: 'Comparable Properties', content: '' },
      { id: 'recommendation', title: 'Recommendation', content: '' },
    ];
  },
};

// ─── Quality audit (extended) ─────────────────────────────────────────────────
export const auditService = {
  defaultCriteria(): AuditCriterion[] {
    return [
      { id: 'c1', label: 'Completeness of analysis', score: 0 },
      { id: 'c2', label: 'Accuracy of market data', score: 0 },
      { id: 'c3', label: 'Clarity of recommendations', score: 0 },
      { id: 'c4', label: 'Client communication quality', score: 0 },
      { id: 'c5', label: 'Timeliness of responses', score: 0 },
      { id: 'c6', label: 'Report structure and formatting', score: 0 },
      { id: 'c7', label: 'Use of supporting evidence', score: 0 },
      { id: 'c8', label: 'Professionalism', score: 0 },
      { id: 'c9', label: 'Compliance with platform standards', score: 0 },
      { id: 'c10', label: 'Overall client satisfaction alignment', score: 0 },
    ];
  },

  async uploadEvidence(caseId: string, file: File): Promise<string> {
    try {
      const storageRef = ref(storage, `audit-evidence/${caseId}/${crypto.randomUUID()}-${file.name}`);
      const snap = await uploadBytes(storageRef, file);
      return getDownloadURL(snap.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `audit-evidence/${caseId}`);
    }
  },
};

// ─── Notification preferences ─────────────────────────────────────────────────
export const preferencesService = {
  defaultPreferences(): NotificationPreferences {
    return {
      emailEnabled: true,
      inAppEnabled: true,
      events: {
        consultation_assigned: true,
        report_uploaded: true,
        consultant_reassigned: true,
        support_ticket_replied: true,
        audit_report_submitted: true,
        meeting_reminder: true,
        rating_reminder: true,
      },
    };
  },

  async updatePreferences(uid: string, prefs: NotificationPreferences): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), { notificationPreferences: prefs });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async registerFcmToken(uid: string, token: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;
      const existing: string[] = snap.data()?.fcmTokens ?? [];
      if (!existing.includes(token)) {
        await updateDoc(userRef, { fcmTokens: [...existing, token] });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },
};

// ─── Paginated admin queries ───────────────────────────────────────────────────
export const paginationService = {
  async getConsultants(
    pageSize = 20,
    cursor?: QueryDocumentSnapshot
  ): Promise<PaginatedResult<ConsultantProfile>> {
    try {
      let q = query(
        collection(db, 'consultantProfiles'),
        orderBy('name', 'asc'),
        limit(pageSize + 1)
      );
      if (cursor) q = query(q, startAfter(cursor));
      const snap = await getDocs(q);
      const hasMore = snap.docs.length > pageSize;
      const items = snap.docs.slice(0, pageSize).map((d) => ({ uid: d.id, ...d.data() } as ConsultantProfile));
      return { items, hasMore, lastDoc: snap.docs[pageSize - 1] ?? null };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'consultantProfiles');
    }
  },

  async getClients(
    pageSize = 20,
    cursor?: QueryDocumentSnapshot
  ): Promise<PaginatedResult<UserProfile>> {
    try {
      let q = query(
        collection(db, 'users'),
        where('role', '==', 'client'),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1)
      );
      if (cursor) q = query(q, startAfter(cursor));
      const snap = await getDocs(q);
      const hasMore = snap.docs.length > pageSize;
      const items = snap.docs.slice(0, pageSize).map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      return { items, hasMore, lastDoc: snap.docs[pageSize - 1] ?? null };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  },

  async getStaff(
    pageSize = 50,
    cursor?: QueryDocumentSnapshot
  ): Promise<PaginatedResult<UserProfile>> {
    try {
      let q = query(
        collection(db, 'users'),
        where('role', 'in', ['admin', 'consultant', 'quality']),
        orderBy('createdAt', 'desc'),
        limit(pageSize + 1)
      );
      if (cursor) q = query(q, startAfter(cursor));
      const snap = await getDocs(q);
      const hasMore = snap.docs.length > pageSize;
      const items = snap.docs.slice(0, pageSize).map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      return { items, hasMore, lastDoc: snap.docs[pageSize - 1] ?? null };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  },

  async getConsultantsByFilter(
    specialty?: string,
    minRating?: number,
    area?: string,
    pageSize = 12,
    cursor?: QueryDocumentSnapshot
  ): Promise<PaginatedResult<ConsultantProfile>> {
    try {
      let q = query(
        collection(db, 'consultantProfiles'),
        where('status', '==', 'active'),
        orderBy('rating', 'desc'),
        limit(pageSize + 1)
      );
      if (cursor) q = query(q, startAfter(cursor));
      const snap = await getDocs(q);
      let docs = snap.docs;
      if (specialty) docs = docs.filter((d) => (d.data().specialties ?? []).includes(specialty));
      if (area) docs = docs.filter((d) => (d.data().areas ?? []).some((a: string) => a.toLowerCase().includes(area.toLowerCase())));
      if (minRating) docs = docs.filter((d) => (d.data().rating ?? 0) >= minRating);
      const hasMore = snap.docs.length > pageSize && docs.length >= pageSize;
      const items = docs.slice(0, pageSize).map((d) => ({ uid: d.id, ...d.data() } as ConsultantProfile));
      return { items, hasMore, lastDoc: snap.docs[pageSize - 1] ?? null };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'consultantProfiles');
    }
  },
};

export type GlobalSearchResultType = 'case' | 'client' | 'staff';
export interface GlobalSearchResult {
  type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

// ─── Global Cmd-K search ──────────────────────────────────────────────────────
export const globalSearchService = {
  async search(q: string): Promise<GlobalSearchResult[]> {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    const results: GlobalSearchResult[] = [];

    try {
      // Search users (clients + staff) by displayName prefix
      const usersSnap = await getDocs(
        query(
          collection(db, 'users'),
          orderBy('displayName'),
          where('displayName', '>=', q),
          where('displayName', '<=', q + ''),
          limit(10)
        )
      );
      for (const d of usersSnap.docs) {
        const u = d.data() as UserProfile;
        const type: GlobalSearchResultType = u.role === 'client' ? 'client' : 'staff';
        const href = u.role === 'client'
          ? `/admin/clients?uid=${d.id}`
          : `/admin/staff?uid=${d.id}`;
        results.push({ type, id: d.id, title: u.displayName, subtitle: u.email, href });
      }

      // Search consultations by clientName or caseId prefix (case-insensitive fallback)
      const casesSnap = await getDocs(
        query(
          collection(db, 'consultations'),
          orderBy('clientName'),
          where('clientName', '>=', q),
          where('clientName', '<=', q + ''),
          limit(8)
        )
      );
      for (const d of casesSnap.docs) {
        const c = d.data();
        results.push({
          type: 'case',
          id: d.id,
          title: `Case #${d.id.slice(-6).toUpperCase()}`,
          subtitle: `${c.clientName ?? ''} — ${c.status ?? ''}`,
          href: `/admin/cases/${d.id}`,
        });
      }

      // Also search cases by consultantName
      const casesByConsultantSnap = await getDocs(
        query(
          collection(db, 'consultations'),
          orderBy('consultantName'),
          where('consultantName', '>=', q),
          where('consultantName', '<=', q + ''),
          limit(5)
        )
      );
      for (const d of casesByConsultantSnap.docs) {
        if (results.some((r) => r.id === d.id)) continue;
        const c = d.data();
        results.push({
          type: 'case',
          id: d.id,
          title: `Case #${d.id.slice(-6).toUpperCase()}`,
          subtitle: `${c.clientName ?? ''} — ${c.status ?? ''}`,
          href: `/admin/cases/${d.id}`,
        });
      }

      // Client-side filter on already-loaded results for substrings
      return results.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.subtitle.toLowerCase().includes(term)
      );
    } catch {
      return [];
    }
  },
};
