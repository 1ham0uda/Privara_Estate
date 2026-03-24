'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { userService } from '@/src/lib/db';
import { UserProfile } from '@/src/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

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
      console.log('Auth state changed:', firebaseUser?.uid);
      setLoading(true);

      try {
        setUser(firebaseUser);

        if (firebaseUser) {
          console.log('Fetching profile for:', firebaseUser.uid);
          const userProfile = await userService.getUserProfile(firebaseUser.uid);
          console.log('Profile fetched:', userProfile?.role);
          setProfile(userProfile);
        } else {
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
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
