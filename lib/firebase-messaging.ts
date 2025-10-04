// lib/firebase-messaging.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

let messaging: Messaging | null = null;

// Firebase 初期化
function initFirebase() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  return getMessaging(app);
}

/**
 * 通知許可をリクエストして FCM トークンを取得
 */
export async function requestPermissionAndGetToken(
  registration: ServiceWorkerRegistration
): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    messaging = initFirebase();
  } catch (e) {
    console.error('Failed to get messaging', e);
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.error('An error occurred while retrieving token.', err);
    return null;
  }
}

/**
 * フォアグラウンドでの通知受信リスナー
 */
export function onMessageListener(callback: (payload: any) => void) {
  if (typeof window === 'undefined') return;
  if (!messaging) messaging = initFirebase();
  onMessage(messaging!, callback);
}

/**
 * すでに発行済みのトークンを取得
 */
export async function getExistingToken(
  registration: ServiceWorkerRegistration
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (Notification.permission !== 'granted') return null;

  try {
    messaging = initFirebase();
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (err) {
    console.error('An error occurred while retrieving token.', err);
    return null;
  }
}
