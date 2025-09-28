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

// 現在アクティブなチャットID
let activeChatId = null;

// フロントから送られた「現在のチャットID」を受け取る
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVE_CHAT') {
    activeChatId = event.data.chatId;
    console.log('[SW] Active chat updated:', activeChatId);
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

messaging.onBackgroundMessage(async (payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || '通知';
  const body = payload.notification?.body || payload.data?.body || '';
  const chatId = payload.data?.chatId;

  // 同じチャットの場合は通知しない
  if (chatId && chatId === activeChatId) {
    console.log('[SW] 同じチャットなので通知をスキップ:', chatId);
    return;
  }

  self.registration.showNotification(notificationTitle, {
    body,
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;
  const url = chatId ? `/chat/${chatId}` : '/';
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
