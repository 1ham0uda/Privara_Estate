export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceAlt: '#FAFAFA',
  text: '#111111',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  primary: '#000000',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  success: '#059669',
  successBg: '#D1FAE5',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  info: '#2563EB',
  infoBg: '#DBEAFE',
  neutral: '#6B7280',
  neutralBg: '#F3F4F6',
} as const;

export const statusColors: Record<string, { bg: string; fg: string }> = {
  new: { bg: colors.infoBg, fg: colors.info },
  assigned: { bg: colors.warningBg, fg: colors.warning },
  active: { bg: colors.successBg, fg: colors.success },
  report_sent: { bg: colors.infoBg, fg: colors.info },
  completed: { bg: colors.neutralBg, fg: colors.neutral },
  cancelled: { bg: colors.dangerBg, fg: colors.danger },
  pending: { bg: colors.warningBg, fg: colors.warning },
  approved: { bg: colors.successBg, fg: colors.success },
  rejected: { bg: colors.dangerBg, fg: colors.danger },
  paid: { bg: colors.successBg, fg: colors.success },
  unpaid: { bg: colors.dangerBg, fg: colors.danger },
  open: { bg: colors.warningBg, fg: colors.warning },
  closed: { bg: colors.neutralBg, fg: colors.neutral },
};

export type AppColors = typeof colors;
