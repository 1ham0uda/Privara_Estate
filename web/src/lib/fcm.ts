'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app } from './firebase';
import { preferencesService } from './db';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Inject Firebase config into the service worker scope before registering.
async function injectSwConfig(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
  if (reg?.active) return; // already registered; config injected on first run

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(config))}`,
    { scope: '/' },
  );
}

export async function requestAndRegisterFcmToken(uid: string): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (!await isSupported()) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    await injectSwConfig();
    const sw = await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    if (token) {
      await preferencesService.registerFcmToken(uid, token);
    }
  } catch (err) {
    // FCM registration is best-effort — do not throw
    console.warn('[fcm] token registration failed:', err);
  }
}
