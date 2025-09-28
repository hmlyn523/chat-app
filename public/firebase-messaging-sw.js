// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Firebase プロジェクト設定（直接値を記入）
firebase.initializeApp({
  apiKey: 'AIzaSyDTjOeukQktTxnDPwfYSMs3XKuffhJmam0',
  authDomain: 'chat-app-aa72c.firebaseapp.com',
  projectId: 'chat-app-aa72c',
  storageBucket: 'chat-app-aa72c.firebasestorage.app',
  messagingSenderId: '37904078789',
  appId: '1:37904078789:web:d85259a03cf1fdcbb01dac',
});

const messaging = firebase.messaging();

// 直近で postMessage から送られた「現在開いているチャットID」を保持する変数
let activeChatId = null;

// フロントからのメッセージを待ち受ける
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVE_CHAT') {
    activeChatId = event.data.chatId;
    console.log('[SW] アクティブなチャットID更新:', activeChatId);
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// FCMからバックグラウンド通知を受け取る
messaging.onBackgroundMessage(async (payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || '通知';
  const body = payload.notification?.body || payload.data?.body || '';
  const chat_id = payload.data?.chat_id;

  console.log('[SW] 受信ペイロード:', payload);
  console.log('[SW] 現在の activeChatId:', activeChatId);

  // 開いているタブ一覧を取得
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  let isChatOpen = false;
  for (const client of clientList) {
    try {
      const pathname = new URL(client.url).pathname;
      console.log('[SW] Client URL:', pathname);

      if (chat_id && pathname === `/chat/${chat_id}`) {
        isChatOpen = true;
        break;
      }
    } catch (e) {
      console.warn('[SW] URL解析失敗:', client.url);
    }
  }

  // 同じチャットが開かれている場合は通知を出さない
  if (isChatOpen || chat_id === activeChatId) {
    console.log('[SW] 同じチャットが開かれているので通知しません:', chat_id);
    return;
  }

  // 通知を表示
  self.registration.showNotification(notificationTitle, {
    body,
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  });
});

// 通知クリック時の遷移
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chat_id = event.notification.data?.chat_id;
  const url = chat_id ? `/chat/${chat_id}` : '/';
  event.waitUntil(clients.openWindow(url));
});

// activate イベント発火時
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
