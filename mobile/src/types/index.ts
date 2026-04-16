export type UserRole = 'client' | 'consultant' | 'admin' | 'quality';
export type StaffRole = Exclude<UserRole, 'client'>;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: any;
  avatarUrl?: string;
  phoneNumber?: string;
  location?: string;
  specialties?: string[];
  experienceYears?: number;
  rating?: number;
  bio?: string;
  status?: 'active' | 'deactivated';
  totalConsultations: number;
  activeConsultations: number;
  completedConsultations: number;
}

export interface ConsultantProfile {
  uid: string;
  name: string;
  avatarUrl?: string;
  bio: string;
  experienceYears: number;
  specialties: string[];
  completedConsultations: number;
  rating: number;
  professionalSummary: string;
  status?: 'active' | 'deactivated';
}

export type ConsultationStatus =
  | 'new'
  | 'assigned'
  | 'active'
  | 'waiting_for_client'
  | 'waiting_for_consultant'
  | 'report_sent'
  | 'completed'
  | 'reassigned';

export type ConsultationStage =
  | 'intake'
  | 'need_analysis'
  | 'shortlisting'
  | 'comparison'
  | 'meeting'
  | 'final_recommendation'
  | 'closure';

export interface IntakeData {
  goal: 'living' | 'investment' | 'resale';
  preferredArea: string;
  budgetRange: string;
  propertyType: string;
  preferredDeliveryTime: string;
  notes: string;
  projectsInMind?: string;
  selectedConsultantUid?: string;
  selectedConsultantName?: string;
}

export interface ConsultationPaymentInfo {
  provider?: 'geidea';
  status?: 'initiated' | 'session_created' | 'session_failed' | 'paid' | 'failed' | 'callback_mismatch';
  amount?: number;
  currency?: string;
  geideaSessionId?: string;
  geideaOrderId?: string | null;
  reference?: string | null;
  responseCode?: string | null;
  responseMessage?: string | null;
  detailedResponseCode?: string | null;
  detailedResponseMessage?: string | null;
  attemptCount?: number;
  initiatedAt?: any;
  lastInitiatedAt?: any;
  paidAt?: any;
  failedAt?: any;
  lastCallbackAt?: any;
  lastError?: string | null;
  mismatchReason?: string | null;
  callbackSummary?: Record<string, unknown>;
}

export interface ConsultationCase {
  id: string;
  clientId: string;
  clientName?: string;
  clientAvatarUrl?: string;
  consultantId?: string;
  consultantName?: string;
  qualitySpecialistId?: string;
  qualitySpecialistName?: string;
  paymentStatus: 'pending' | 'paid';
  status: ConsultationStatus;
  stage: ConsultationStage;
  intake: IntakeData;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
  reportUrl?: string;
  meetingRecordingUrl?: string;
  callRecordings?: string[];
  reassignmentRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  tags?: string[];
  internalNotes?: string;
  rating?: number;
  feedback?: string;
  payment?: ConsultationPaymentInfo;
}

export interface Message {
  id: string;
  caseId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  type: 'text' | 'image' | 'audio' | 'meeting_request' | 'meeting_link' | 'call_log';
  createdAt: any;
}

export interface SupportReply {
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: any;
}

export interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  text: string;
  status: 'open' | 'closed' | 'resolved';
  createdAt: any;
  updatedAt?: any;
  closedAt?: any;
  closedById?: string;
  closedByName?: string;
  replies?: SupportReply[];
}

export interface ChangeRequest {
  id: string;
  caseId: string;
  clientId: string;
  consultantId: string;
  reason: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export type NotificationEventType =
  | 'consultation_created'
  | 'consultation_assigned'
  | 'quality_assigned'
  | 'consultant_change_requested'
  | 'consultant_reassigned'
  | 'audit_report_submitted'
  | 'support_ticket_created'
  | 'support_ticket_replied'
  | 'support_ticket_closed';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: any;
  actorId?: string;
  eventType?: NotificationEventType;
  caseId?: string;
  ticketId?: string;
  previousConsultantId?: string | null;
  titleKey?: string;
  messageKey?: string;
  messageParams?: Record<string, string>;
}

export interface QualityAuditReport {
  id: string;
  caseId: string;
  specialistId: string;
  specialistName: string;
  status: 'pending' | 'completed';
  classification: 'critical' | 'non-critical';
  meetingStatus: 'recorded' | 'not-recorded' | 'failed';
  notes: string;
  createdAt: any;
}

export interface SystemSettings {
  consultationFee: number;
}
