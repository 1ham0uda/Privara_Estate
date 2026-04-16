import { getApp, getApps, initializeApp } from 'firebase/app';
// NOTE: use the `firebase/auth` native-module build that ships with Expo.
// initializeAuth + getReactNativePersistence gives us AsyncStorage-backed
// session persistence on iOS and Android.
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error — `getReactNativePersistence` is exported from
  // firebase/auth but is not yet included in its public TS types.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length > 0) {
  throw new Error(
    `Missing Firebase env vars: ${missing.join(', ')}. ` +
      'Add them to mobile/.env (see mobile/.env.example).',
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth throws if already initialised (fast refresh, etc.)
  auth = getAuth(app);
}

const db: Firestore = getFirestore(app);

export { app, auth, db };
