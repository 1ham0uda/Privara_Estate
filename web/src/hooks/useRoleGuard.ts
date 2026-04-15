'use client';

import { useAuth } from '@/src/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/src/types';

export function useRoleGuard(allowedRoles: UserRole[]) {
  const { profile, loading, signOut, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const allowedRolesString = JSON.stringify(allowedRoles);
  useEffect(() => {
    if (!loading) {
      if (!profile) {
        // Signed in but unverified → verification gate
        if (user && !user.emailVerified) {
          router.push('/verify-email');
        } else {
          router.push(`/login?redirect=${pathname}`);
        }
      } else if (profile.status === 'deactivated') {
        signOut().finally(() => router.push('/login'));
      } else if (!allowedRoles.includes(profile.role)) {
        // Redirect to their own dashboard if they are in the wrong place
        router.push(`/${profile.role}/dashboard`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading, router, pathname, allowedRolesString, signOut]);

  return { profile, loading };
}
