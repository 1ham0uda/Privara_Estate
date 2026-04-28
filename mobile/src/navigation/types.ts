export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  VerifyEmail: undefined;
};

export type ClientTabsParamList = {
  ClientDashboard: undefined;
  ClientSupport: undefined;
  ClientProfile: undefined;
};

export type ConsultantTabsParamList = {
  ConsultantDashboard: undefined;
  ConsultantSupport: undefined;
  ConsultantProfile: undefined;
};

export type AdminTabsParamList = {
  AdminDashboard: undefined;
  AdminClients: undefined;
  AdminStaff: undefined;
  AdminSupport: undefined;
  AdminProfile: undefined;
};

export type QualityTabsParamList = {
  QualityDashboard: undefined;
  QualitySupport: undefined;
  QualityProfile: undefined;
};

export type ClientStackParamList = {
  ClientTabs: undefined;
  NewConsultation: undefined;
  CaseDetail: { caseId: string };
  CaseChat: { caseId: string };
  Payment: { intake: import('@/src/types').IntakeData };
  ConsultantDetail: { consultantId: string };
  Notifications: undefined;
};

export type ConsultantStackParamList = {
  ConsultantTabs: undefined;
  CaseDetail: { caseId: string };
  CaseChat: { caseId: string };
  Notifications: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  CaseDetail: { caseId: string };
  CaseChat: { caseId: string };
  AddStaff: undefined;
  Notifications: undefined;
};

export type QualityStackParamList = {
  QualityTabs: undefined;
  CaseDetail: { caseId: string };
  Notifications: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  VerifyEmail: undefined;
  ClientRoot: undefined;
  ConsultantRoot: undefined;
  AdminRoot: undefined;
  QualityRoot: undefined;
  Loading: undefined;
};
