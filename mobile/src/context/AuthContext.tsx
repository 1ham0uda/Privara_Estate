import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/services/userService';
import { authService } from '@/src/services/authService';
import { UserProfile } from '@/src/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          const userProfile = await userService.getUserProfile(firebaseUser.uid);
          setProfile(userProfile);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setProfile(null);
      return;
    }
    try {
      const userProfile = await userService.getUserProfile(currentUser.uid);
      setUser(currentUser);
      setProfile(userProfile);
    } catch {
      setProfile(null);
    }
  };

  const refreshEmailVerification = async (): Promise<boolean> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    try {
      await currentUser.reload();
      const reloaded = auth.currentUser!;
      if (reloaded.emailVerified) {
        const userProfile = await userService.getUserProfile(reloaded.uid);
        setUser(reloaded);
        setProfile(userProfile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const sendVerificationEmail = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No user signed in');
    await sendEmailVerification(currentUser);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initializing,
      signIn: async (email, password) => {
        await authService.login({ email, password });
      },
      signUp: async (email, password, displayName) => {
        await authService.signup({ email, password, displayName });
      },
      signOut: async () => {
        await authService.logout();
        setProfile(null);
      },
      refreshProfile,
      refreshEmailVerification,
      sendVerificationEmail,
    }),
    [user, profile, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
