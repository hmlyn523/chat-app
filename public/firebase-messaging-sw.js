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

// バックグラウンド通知受信
messaging.onBackgroundMessage(async (payload) => {
  const { title, body, click_action } = payload.data || {};
  const notificationTitle = payload.notification?.title || '通知';

  // 現在開いているタブ一覧を取得
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  // 例えば click_action が `/chat/123` なら
  const targetChatUrl = click_action ? `/chat/${click_action}` : null;

  // 開いているタブの URL に同じチャットIDが含まれていたら通知しない
  const isChatOpen = targetChatUrl
    ? clientList.some((client) => client.url.includes(targetChatUrl))
    : false;

  if (isChatOpen) {
    console.log('同じチャットが開かれているので通知しません:', targetChatUrl);
    return;
  }

  const notificationOptions = {
    title: title,
    body: body,
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 通知クリック時の遷移
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.click_action || '/';
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
