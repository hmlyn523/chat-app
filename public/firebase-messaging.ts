// lib/firebase-messaging.ts
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

let messaging: Messaging | null = null;

/**
 * 通知許可をリクエストして FCM トークンを取得
 */
export async function requestPermissionAndGetToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    // SSR環境では何もしない
    return null;
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

  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.error("Failed to get messaging", e);
    return null;
  }

  // 通知許可をリクエスト
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Notification permission not granted");
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
    });
    return token || null;
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
    return null;
  }
}

/**
 * フォアグラウンドでの通知受信リスナー
 */
export function onMessageListener() {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("Message received. ", payload);
    // ここでアプリUIに通知を表示したりする
  });
}
