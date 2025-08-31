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
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || '通知';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  };

  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      const msgChatId = payload.data?.chatId;
      const isChatOpen = clientList.some((client) => client.url.includes(`/chat/${msgChatId}`));

      if (!isChatOpen) {
        self.registration.showNotification(notificationTitle, notificationOptions);
      } else {
        console.log('チャット画面開いているので通知スキップ');
      }
    })()
  );
});

// 通知クリック時の遷移
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.click_action || '/';
  event.waitUntil(clients.openWindow(url));
});
