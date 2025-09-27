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

// // バックグラウンド通知受信
// messaging.onBackgroundMessage(async (payload) => {
//   const { title, body, chat_id } = payload.data || {};
//   const notificationTitle = payload.data?.title || '通知';

//   // // 現在開いているタブ一覧を取得
//   // const clientList = await clients.matchAll({
//   //   type: 'window',
//   //   includeUncontrolled: true,
//   // });

//   // const targetChatId = chat_id;
//   // const targetPathSegment = `/chat/${targetChatId}`;

//   // // デバッグ用ログを追加
//   // console.log('--- Notification Debug Start ---');
//   // console.log('Target Chat ID:', targetChatId);
//   // console.log('Target Path Segment:', targetPathSegment);

//   // // 開いているタブ一覧のURLと、ターゲットパスの確認
//   // const isChatOpen = targetChatId
//   //   ? clientList.some((client) => {
//   //       console.log('Client URL:', client.url); // ★開いているタブのURLを正確に出力
//   //       const isMatch = client.url.includes(targetPathSegment);
//   //       console.log('Does URL include target path?', isMatch);
//   //       return isMatch;
//   //     })
//   //   : false;

//   // if (isChatOpen) {
//   //   console.log('同じチャットが開かれているので通知しません:', targetChatId);
//   //   return;
//   // }

//   const clientList = await clients.matchAll({
//     type: 'window',
//     includeUncontrolled: true,
//   });

//   // 💡 ここを修正して、全てのクライアントURLを確認します
//   console.log('--- All Clients Found ---');
//   let isChatOpen = false;

//   for (const client of clientList) {
//     console.log(`Client URL [${client.id}]:`, client.url); // 全てのURLを出力

//     if (targetChatId && client.url.includes(`/chat/${targetChatId}`)) {
//       isChatOpen = true;
//     }
//   }
//   console.log('--- All Clients Found End ---');

//   if (isChatOpen) {
//     console.log('SUCCESS: Notification suppressed.');
//     return;
//   }

//   const notificationOptions = {
//     title: title,
//     body: body,
//     icon: '/icons/icon-192.png',
//     data: payload.data || {},
//   };

//   self.registration.showNotification(notificationTitle, notificationOptions);
// });

messaging.onBackgroundMessage(async (payload) => {
  const { title, body, chat_id } = payload.data || {};
  const notificationTitle = payload.data?.title || '通知';

  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  let isChatOpen = false;

  for (const client of clientList) {
    console.log(`Client URL [${client.id}]:`, client.url);

    if (chat_id && client.url.includes(`/chat/${chat_id}`)) {
      isChatOpen = true;
      break;
    }
  }

  if (isChatOpen) {
    return;
  }

  const notificationOptions = {
    body: body,
    icon: '/icons/icon-192.png',
    data: payload.data || {},
  };

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
