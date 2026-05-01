'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the current value of a PostHog feature flag.
 * Returns `undefined` while flags are loading, `false` when PostHog is absent.
 *
 * Usage:
 *   const showNewCTA = useFeatureFlag('landing-cta-v2');
 *   // 'control' | 'variant-a' | true | false | undefined
 */
export function useFeatureFlag(flag: string): boolean | string | undefined {
  const [value, setValue] = useState<boolean | string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.posthog) return;

    setValue(window.posthog.getFeatureFlag(flag) as boolean | string | undefined);

    const unsubscribe = window.posthog.onFeatureFlags?.(() => {
      setValue(window.posthog!.getFeatureFlag(flag) as boolean | string | undefined);
    });

    return () => unsubscribe?.();
  }, [flag]);

  return value;
}
