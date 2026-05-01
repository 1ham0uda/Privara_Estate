'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { captureEvent, identifyUser, initPostHog } from '@/src/lib/analytics';
import { useAuth } from '@/src/context/AuthContext';

function PageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user && profile) {
      identifyUser(user.uid, {
        email: user.email,
        role: profile.role,
        name: profile.displayName,
      });
    }
  }, [user, profile]);

  useEffect(() => {
    captureEvent('$pageview', { $current_url: window.location.href });
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewInner />
    </Suspense>
  );
}
