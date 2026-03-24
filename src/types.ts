export type UserRole = 'client' | 'consultant' | 'admin' | 'quality';

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
  rating?: number;
  bio?: string;
  status?: 'active' | 'deactivated';
  totalConsultations: number;
  activeConsultations: number;
  completedConsultations: number;
}

export interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  text: string;
  status: 'open' | 'closed';
  createdAt: any;
  replies?: {
    senderId: string;
    senderName: string;
    text: string;
    createdAt: any;
  }[];
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
  rating?: number;
  feedback?: string;
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
