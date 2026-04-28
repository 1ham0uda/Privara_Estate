import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { auth } from '@/src/lib/firebase';

export interface Credentials {
  email: string;
  password: string;
}

export interface SignupInput extends Credentials {
  displayName?: string;
}

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AuthError';
  }
}

function mapFirebaseError(err: unknown): AuthError {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : 'auth/unknown';

  const messages: Record<string, string> = {
    'auth/invalid-email': 'That email address is not valid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
  };

  return new AuthError(code, messages[code] ?? 'Something went wrong. Please try again.');
}

export const authService = {
  async login({ email, password }: Credentials): Promise<User> {
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password);
      return res.user;
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  async signup({ email, password, displayName }: SignupInput): Promise<User> {
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName) {
        await updateProfile(res.user, { displayName });
      }
      return res.user;
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  async logout(): Promise<void> {
    try {
      await fbSignOut(auth);
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw mapFirebaseError(err);
    }
  },

  subscribe(cb: (user: User | null) => void): Unsubscribe {
    return onAuthStateChanged(auth, cb);
  },

  get currentUser(): User | null {
    return auth.currentUser;
  },
};
