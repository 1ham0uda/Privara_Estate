export const colors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  text: '#111111',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  primary: '#000000',
  primaryText: '#FFFFFF',
  danger: '#DC2626',
  success: '#059669',
} as const;

export type AppColors = typeof colors;
