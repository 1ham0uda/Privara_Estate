export type UserRole = 'client' | 'consultant' | 'admin' | 'quality';
export type StaffRole = Exclude<UserRole, 'client'>;

// ─── Fee tiers ────────────────────────────────────────────────────────────────
export type FeeTier = 'standard' | 'pro';

// ─── Discount codes ───────────────────────────────────────────────────────────
export interface DiscountCode {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: any | null;
  active: boolean;
  createdAt: any;
}

// ─── Referral ─────────────────────────────────────────────────────────────────
export interface Referral {
  id: string;
  referrerId: string;
  referredUid: string;
  referralCode: string;
  createdAt: any;
  credited: boolean;
}

// ─── Notification preferences ─────────────────────────────────────────────────
export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  events: {
    consultation_assigned: boolean;
    report_uploaded: boolean;
    consultant_reassigned: boolean;
    support_ticket_replied: boolean;
    audit_report_submitted: boolean;
    meeting_reminder: boolean;
    rating_reminder: boolean;
  };
}

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
  notificationPreferences?: NotificationPreferences;
  fcmTokens?: string[];
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  whatsappOptIn?: boolean;
  whatsappNumber?: string;
  organizationId?: string;
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

// ─── Consultant availability ───────────────────────────────────────────────────
export type ConsultantAvailability = 'available' | 'busy' | 'away';

export interface ConsultantProfile {
  uid: string;
  name: string;
  avatarUrl?: string;
  bio: string;
  experienceYears: number;
  specialties: string[];
  areas?: string[];
  completedConsultations: number;
  rating: number;
  professionalSummary: string;
  status?: 'active' | 'deactivated';
  availability?: ConsultantAvailability;
  availabilityNote?: string;
  feeTier?: FeeTier;
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

// ─── Sub-score rating ──────────────────────────────────────────────────────────
export interface RatingDetails {
  responsiveness: number;
  expertise: number;
  helpfulness: number;
  nps: number;
  consultantReply?: string;
  consultantRepliedAt?: any;
}

// ─── Structured report ────────────────────────────────────────────────────────
export interface ReportSection {
  id: string;
  title: string;
  content: string;
  photoUrls?: string[];
}

export interface StructuredReport {
  sections: ReportSection[];
  comparableProperties?: ComparableProperty[];
  publishedAt?: any;
  isDraft: boolean;
}

export interface ComparableProperty {
  address: string;
  price: string;
  area: string;
  notes: string;
}

// ─── Scheduled meeting ────────────────────────────────────────────────────────
export type MeetingStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed';

export interface ScheduledMeeting {
  id: string;
  caseId: string;
  clientId: string;
  consultantId: string;
  clientName: string;
  consultantName: string;
  proposedBy: string;
  title: string;
  scheduledAt: any;
  durationMinutes: number;
  status: MeetingStatus;
  meetingLink?: string;
  notes?: string;
  createdAt: any;
  updatedAt: any;
  reminderSentAt?: any;
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
  structuredReport?: StructuredReport;
  meetingRecordingUrl?: string;
  callRecordings?: string[];
  reassignmentRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  consultantReassignmentRequest?: { reason: string; requestedAt: any };
  tags?: string[];
  internalNotes?: string;
  rating?: number;
  ratingDetails?: RatingDetails;
  feedback?: string;
  payment?: ConsultationPaymentInfo;
}

export type CallType = 'audio' | 'video';

export type CallStatus = 'ringing' | 'active' | 'declined' | 'ended' | 'missed';

export type CallRecordingStatus = 'not_started' | 'recording' | 'processing' | 'ready' | 'failed';

export interface CallSignalDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface CallSession {
  id: string;
  consultationId: string;
  clientId: string;
  consultantId: string;
  initiatedBy: string;
  initiatedByName: string;
  initiatedByRole: Extract<UserRole, 'client' | 'consultant'>;
  type: CallType;
  status: CallStatus;
  createdAt: any;
  updatedAt: any;
  acceptedAt?: any;
  endedAt?: any;
  endedBy?: string | null;
  callerJoinedAt?: any;
  calleeJoinedAt?: any;
  durationSec?: number | null;
  recordingStatus: CallRecordingStatus;
  recordingUrl?: string | null;
  offer?: CallSignalDescription | null;
  answer?: CallSignalDescription | null;
}

export interface CallIceCandidate {
  id: string;
  senderId: string;
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  createdAt: any;
}

// ─── Message (extended for file attachments) ──────────────────────────────────
export interface Message {
  id: string;
  caseId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  type: 'text' | 'image' | 'audio' | 'file' | 'meeting_request' | 'meeting_link' | 'call_log';
  createdAt: any;
}

export type NotificationEventType =
  | 'consultation_created'
  | 'consultation_assigned'
  | 'quality_assigned'
  | 'consultant_change_requested'
  | 'consultant_reassigned'
  | 'audit_report_submitted'
  | 'report_uploaded'
  | 'meeting_scheduled'
  | 'meeting_reminder'
  | 'rating_reminder'
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

// ─── Quality audit (extended with checklist + CAPA) ───────────────────────────
export interface AuditCriterion {
  id: string;
  label: string;
  score: number;
  comment?: string;
}

export type CapaStatus = 'open' | 'in_progress' | 'closed';

export interface QualityAuditReport {
  id: string;
  caseId: string;
  specialistId: string;
  specialistName: string;
  status: 'pending' | 'completed';
  classification: 'critical' | 'non-critical';
  meetingStatus: 'recorded' | 'not-recorded' | 'failed';
  notes: string;
  criteria?: AuditCriterion[];
  totalScore?: number;
  evidenceUrls?: string[];
  capaRequired?: boolean;
  capaDescription?: string;
  capaStatus?: CapaStatus;
  escalatedToAdminAt?: any;
  createdAt: any;
  updatedAt?: any;
}

export interface SystemSettings {
  consultationFee: number;
  standardFee?: number;
  proFee?: number;
  allowRegistrations: boolean;
  maintenanceMode: boolean;
}

// ─── Multi-tenant organization foundation ────────────────────────────────────
export type OrganizationPlan = 'starter' | 'business' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  plan: OrganizationPlan;
  ownerUid: string;
  memberUids: string[];
  logoUrl?: string;
  website?: string;
  industry?: string;
  createdAt: any;
  updatedAt?: any;
  settings?: {
    allowClientSelfSignup?: boolean;
    brandColor?: string;
    customDomain?: string;
  };
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

// ─── Paginated result helper ───────────────────────────────────────────────────
export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  lastDoc: any;
}
