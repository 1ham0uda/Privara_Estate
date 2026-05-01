'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/lib/db';
import { UserProfile } from '@/src/types';
import { requestAndRegisterFcmToken } from '@/src/lib/fcm';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Reloads the Firebase user, then resolves true if email is now verified. */
  refreshEmailVerification: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshEmailVerification: async () => false,
});

// --- Session cookie helpers (best-effort, non-blocking) ---
// The cookie acts as a UX-layer presence marker so middleware can redirect
// unauthenticated visitors before React hydrates.  Actual security is
// enforced by Firestore rules; do not rely on this cookie for data access.

async function setSessionCookie(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, emailVerified: user.emailVerified }),
    });
  } catch {
    // Non-critical — auth still works without the cookie
  }
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // Non-critical
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUser(null);
      setProfile(null);
      return;
    }

    setLoading(true);
    try {
      const userProfile = await userService.getUserProfile(currentUser.uid);
      setUser(currentUser);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error refreshing auth profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      try {
        setUser(firebaseUser);

        if (firebaseUser) {
          // Set session cookie so middleware can redirect before React boots.
          // The cookie also encodes emailVerified so middleware can gate /verify-email.
          void setSessionCookie(firebaseUser);

          if (firebaseUser.emailVerified) {
            const userProfile = await userService.getUserProfile(firebaseUser.uid);
            setProfile(userProfile);
            void requestAndRegisterFcmToken(firebaseUser.uid);
          } else {
            // User signed in but hasn't verified their email yet.
            // Keep user set so verify-email page can call sendEmailVerification,
            // but withhold profile so role-based routing stays locked.
            setProfile(null);
          }
        } else {
          void clearSessionCookie();
          setProfile(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await clearSessionCookie();
    await auth.signOut();
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    try {
      await currentUser.reload();
      const reloadedUser = auth.currentUser!;

      if (reloadedUser.emailVerified) {
        // Await here so the verified cookie is set before the caller navigates
        await setSessionCookie(reloadedUser);
        const userProfile = await userService.getUserProfile(reloadedUser.uid);
        setUser(reloadedUser);
        setProfile(userProfile);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error refreshing email verification:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, refreshEmailVerification }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
