import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { QualityAuditReport, UserProfile } from '@/src/types';
import { notificationService } from './notificationService';

export const qualityService = {
  async submitAuditReport(report: Omit<QualityAuditReport, 'id' | 'createdAt'>): Promise<string> {
    const newDoc = await addDoc(collection(db, 'auditReports'), {
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
          eventType: 'audit_report_submitted',
          caseId: report.caseId,
          titleKey: 'notifications.audit_report_submitted.title',
          messageKey: 'notifications.audit_report_submitted.message',
          messageParams: { caseNumber: report.caseId.substring(0, 8) },
        }),
      ),
    );

    return newDoc.id;
  },

  async getAuditReports(caseId: string): Promise<QualityAuditReport[]> {
    const q = query(collection(db, 'auditReports'), where('caseId', '==', caseId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as QualityAuditReport));
  },

  async getAllAuditReports(): Promise<QualityAuditReport[]> {
    const q = query(collection(db, 'auditReports'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as QualityAuditReport));
  },

  async getAllQualitySpecialists(): Promise<UserProfile[]> {
    const q = query(collection(db, 'users'), where('role', '==', 'quality'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
  },

  subscribeToAuditReports(onUpdate: (data: QualityAuditReport[]) => void): () => void {
    const q = query(collection(db, 'auditReports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as QualityAuditReport));
      onUpdate(reports);
    });
  },
};
