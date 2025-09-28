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

// FCMからバックグラウンド通知を受け取る
messaging.onBackgroundMessage(async (payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || '通知';
  const data = payload.data || {};

  const body = payload.notification?.body || payload.data?.body || '';
  const chat_id = data.chat_id;

  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  let isChatOpen = false;
  for (const client of clientList) {
    if (chat_id && client.url.includes(`/chat/${chat_id}`)) {
      isChatOpen = true;
      break;
    }
  }

  if (isChatOpen || chat_id === activeChatId) {
    console.log('同じチャットが開かれているので通知しません:', chat_id);
    return;
  }

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

// メッセージイベントを監視
self.addEventListener('message', (event) => {
  // フロント側(タブのJavaScript)から送られるメッセージを待ち受ける
  // → これで「現在ユーザーが見ているチャット画面のID」を知れる
  if (event.data?.type === 'ACTIVE_CHAT') {
    activeChatId = event.data.chatId;
    console.log('アクティブなチャットID更新:', activeChatId);
  }
  // → フロントから { type: 'SKIP_WAITING' } が送られてきたら
  //   skipWaiting() を実行して古いSWを待たずに即座に新しいSWに切り替える
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// activate イベント発火時に実行
// → claim() により既存のすべてのページを新しいSWの管理下に置く
//   （ユーザーがページをリロードしなくても新しいSWを適用できる）
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
