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
messaging.onBackgroundMessage(async (payload) => {
  // 現在開いているタブを取得
  const clientList_2 = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const isChatOpen_2 = clientList.some((client) => client.url.includes(`/chat/${chatId}`));

  // 通知の内容を取り出す
  const { title, body, chat_id } = payload.data || {};
  const notificationTitle = isChatOpen_2
    ? 'チャット画面を開いています'
    : payload.data?.title || '通知';

  // 直近で postMessage から送られた「現在開いているチャットID」を保持する変数
  let activeChatId = null;

  // フロント側(タブのJavaScript)から送られるメッセージを待ち受ける
  // → これで「現在ユーザーが見ているチャット画面のID」を知れる
  self.addEventListener('message', (event) => {
    if (event.data?.type === 'ACTIVE_CHAT') {
      activeChatId = event.data.chatId;
    }
  });

  // 開かれている全てのブラウザタブ/ウィンドウを取得
  // includeUncontrolled: true → Service Worker の管理外でも取得する
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  let isChatOpen = false;

  // 開いているタブのURLを調べて、「通知対象のチャット画面」が存在するか確認する
  for (const client of clientList) {
    console.log(`Client URL [${client.id}]:`, client.url);

    // URLに「/chat/◯◯」という形でチャットIDが含まれていれば、
    // そのチャットはすでに開かれていると判断できる
    if (chat_id && client.url.includes(`/chat/${chat_id}`)) {
      isChatOpen = true; // 該当のチャットがすでに開かれている
      break;
    }
  }

  // ここまでで2つの判定方法がある:
  // 1. clients.matchAll でURLを調べる方法
  // 2. postMessage で送られた activeChatId を利用する方法
  //
  // どちらかで「すでに同じチャットが開かれている」と判断できたら通知しない
  if (isChatOpen || chat_id === activeChatId) {
    console.log('同じチャットが開かれているので通知しません:', chat_id);
    return;
  }

  // もし対象のチャットが開かれていなければ、通知を表示する
  const notificationOptions = {
    body: activeChatId, // 通知本文
    icon: '/icons/icon-192.png', // 通知に表示するアイコン
    data: payload.data || {}, // 通知クリック時に利用する追加データ
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
