// lib/firebase-messaging.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

let messaging: Messaging | null = null;

/**
 * 通知許可をリクエストして FCM トークンを取得
 */
export async function requestPermissionAndGetToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    // SSR環境では何もしない
    return null;
  }

  // ✅ Service Worker を登録
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  });
  console.log('Service Worker registered:', registration);

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.error('Failed to get messaging', e);
    return null;
  }

  // 通知許可をリクエスト
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: registration, // ✅ ここが重要
    });
    return token || null;
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return null;
  }
}

/**
 * フォアグラウンドでの通知受信リスナー
 */
export function onMessageListener(callback: (payload: any) => void) {
  if (typeof window === 'undefined' || !messaging) return;
  onMessage(messaging, callback);
}

/**
 * すでに発行済みのトークンを取得（permission が granted の場合のみ）
 */
export async function getExistingToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    // Service Worker が登録済みであることを確認
    let registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      // 登録されていなければ登録
      console.warn('No service worker registration found. Registering now...');
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('Service Worker registered:', registration);
    }

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    };

    const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
    const messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
      serviceWorkerRegistration: registration, // ✅ これが必須！
    });

    return token || null;
  } catch (err) {
    console.error('An error occurred while retrieving token.', err);
    return null;
  }
}
