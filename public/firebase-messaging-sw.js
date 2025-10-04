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

addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVE_CHAT') {
    console.log(`Message received: ${event.data.chatId}`);
    activeChatId = event.data.chatId;
  }
});

// SW側（firebase-messaging-sw.js 内）
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'ACTIVE_CHAT') {
    const chatId = event.data?.chatId;
    activeChatId = chatId;
    console.log('Received from client:', chatId);
    // ここでIndexedDBに保存など、処理を実行
    // 例: activeChatId = chatId;  // ローカル変数更新
  } else if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting(); // SW更新時のハンドリング
  }
});

// FCM(Firebase Cloud Messaging)からバックグラウンドで通知が届いたときの処理
messaging.onBackgroundMessage(async (payload) => {
  const { title, body, chat_id } = payload.data || {};
  const notificationTitle = payload.data?.title || '通知';

  notificationTitle = activeChatId;
  body = chat_id;

  if (chat_id === activeChatId) {
    return;
  }

  // もし対象のチャットが開かれていなければ、通知を表示する
  const notificationOptions = {
    body: body,
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  };

  // ブラウザに通知を表示
  self.registration.showNotification(notificationTitle, notificationOptions);
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
