import { useAuth } from '@/src/context/AuthContext';
import { UserRole } from '@/src/types';

export function useRoleGuard(allowed: UserRole[]): { allowed: boolean; role: UserRole | null } {
  const { profile } = useAuth();
  const role = (profile?.role as UserRole | undefined) ?? null;
  return {
    allowed: role ? allowed.includes(role) : false,
    role,
  };
}
