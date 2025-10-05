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

// FCM(Firebase Cloud Messaging)からバックグラウンドで通知が届いたときの処理
// 以下の時に呼ばれる
// ・タブが非アクティブ
// ・ブラウザが最小化している
messaging.onBackgroundMessage(async (payload) => {
  console.log('onBackgroundMessage', payload);
});

// 通知クリック時の遷移
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.chat_id || '/';
  event.waitUntil(clients.openWindow(url));
});

// Service Worker の更新を即座に反映させるためのリスナー
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 新しいService Workerがインストールされたときに、すぐにアクティブ化する
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
