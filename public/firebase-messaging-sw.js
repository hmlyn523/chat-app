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

self.addEventListener('message', async (event) => {
  const type = event.data?.type;

  switch (type) {
    case 'ACTIVE_CHAT': {
      const chatId = event.data?.chatId;
      activeChatId = chatId;
      console.log('Received from client:', activeChatId);
      // ここで IndexedDB への保存など必要な処理を追加
      break;
    }
    case 'SKIP_WAITING': {
      self.skipWaiting();
      break;
    }
  }
});

// FCM(Firebase Cloud Messaging)からバックグラウンドで通知が届いたときの処理
// 以下の時に呼ばれる
// ・タブが非アクティブ
// ・ブラウザが最小化している
messaging.onBackgroundMessage(async (payload) => {
  const { title, body, chat_id } = payload.data || {};
  const notificationTitle = payload.data?.title || '通知';

  // notificationTitle = activeChatId;
  // body = chat_id;

  console.log('Received background message ', payload);
  console.log('Active chat ID:', activeChatId);
  console.log('Message chat ID:', chat_id);

  if (chat_id === activeChatId) {
    console.log('Chat is active, no notification shown.');
    return;
  }

  // もし対象のチャットが開かれていなければ、通知を表示する
  var body_ = 'firebase-messaging-sw.jsのFCM受信';
  const notificationOptions = {
    body: body_,
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  };

  console.log('Showing notification:', notificationTitle, notificationOptions);
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
