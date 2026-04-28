import { auth } from '@/src/lib/firebase';
import { StaffRole } from '@/src/types';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export interface CreateStaffPayload {
  email: string;
  password: string;
  displayName: string;
  role: StaffRole;
  specialties?: string;
  bio?: string;
  phoneNumber?: string;
  experienceYears?: number | null;
}

export const adminService = {
  async createStaff(payload: CreateStaffPayload): Promise<{ uid: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    if (!API_BASE) throw new Error('API base URL is not configured');

    // Force-refresh to avoid sending an expired token (tokens expire after 1h)
    const idToken = await user.getIdToken(true);
    const res = await fetch(`${API_BASE}/api/admin/create-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      // Retry once with a fresh token
      const freshToken = await user.getIdToken(true);
      const retry = await fetch(`${API_BASE}/api/admin/create-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(payload),
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw new Error(retryData?.error || 'Failed to create staff');
      return retryData;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Failed to create staff');
    return data;
  },
};
