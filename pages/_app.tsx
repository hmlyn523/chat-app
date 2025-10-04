// pages/_app.tsx
import { useRef, useState, useEffect } from 'react';
import { AppProps } from 'next/app';
import { SessionContextProvider, useUser } from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Session } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import 'styles/globals.css';
import ChatHeader from 'components/ChatHeader';
import ListHeader from 'components/ListHeader';
import { supabase } from 'lib/supabaseClient';
import { listenForSWUpdate } from 'lib/serviceWorkerUpdater';

// FCM登録を行うコンポーネント
function FCMRegistration() {
  const user = useUser();
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    // SSRでは実行しない
    if (typeof window === 'undefined') return;

    // ユーザーが未ログインの場合はスキップ
    if (!user) return;

    // すでに登録済みならスキップ（Strict Mode対応）
    if (hasRegisteredRef.current) return;
    hasRegisteredRef.current = true;

    async function setupFCM() {
      try {
        // 1️⃣ Service Worker を登録
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('SW registered:', reg);

        // 2️⃣ FCM 関連の処理を動的 import
        const { requestPermissionAndGetToken, onMessageListener, getExistingToken } = await import(
          'public/firebase-messaging'
        );

        // 通知許可とトークン取得
        let token: string | null = null;
        if (Notification.permission === 'granted') {
          token = await getExistingToken();
        } else {
          token = await requestPermissionAndGetToken();
        }
        if (!token) return;

        // デバイスID発行
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('device_id', deviceId);
        }

        let platform = 'web';
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) platform = 'ios';
        else if (/Android/i.test(navigator.userAgent)) platform = 'android';

        const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

        // トークンをDBに保存
        await supabase.from('push_tokens').upsert(
          {
            user_id: user?.id,
            device_id: deviceId,
            fcm_token: token,
            platform,
            app_version: appVersion,
            is_active: true,
            created_at: new Date(),
            last_used_at: new Date(),
          },
          {
            onConflict: 'user_id,device_id',
          }
        );

        // フォアグラウンドメッセージリスナー設定
        onMessageListener((payload) => {
          // ✅ 現在のパスがチャット画面かどうか確認
          const msgChatId = payload.data?.chatRoomId;
          const isCurrentChat = window.location.pathname === `/chat/${msgChatId}`;

          if (isCurrentChat) {
            console.log('現在のチャット画面なので通知スキップ:', payload);
            return;
          }

          if (payload.notification) {
            new Notification(payload.notification.title || '新しいメッセージ', {
              body: payload.notification.body || '',
              icon: '/icons/icon-192.png',
              data: payload.data || {},
            });
          }
        });
      } catch (error) {
        console.error('Error in FCM setup:', error);
      }
    }

    setupFCM();
  }, [user]);

  return null; // このコンポーネントは何もレンダリングしない
}

export default function App({ Component, pageProps }: AppProps<{ initialSession: Session }>) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());
  const router = useRouter();
  const isChatRoom = router.pathname?.startsWith('/chat/');

  useEffect(() => {
    listenForSWUpdate(() => {
      window.location.reload();
    });
  }, []);

  useEffect(() => {
    // Service Worker が切り替わったら更新を適用
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker updated');
        alert('アプリが更新されました。ページを再読み込みします。');
        window.location.reload();
      });
    }
  }, []);

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      {/* FCM登録コンポーネント */}
      <FCMRegistration />

      {/* ヘッダー */}
      {isChatRoom ? <ChatHeader /> : <ListHeader />}

      {/* メインコンテンツ */}
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}
