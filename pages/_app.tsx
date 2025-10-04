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
    if (typeof window === 'undefined') return; // SSR防止
    if (!user) return; // ログインしてないならスキップ
    if (hasRegisteredRef.current) return; // StrictMode対応
    hasRegisteredRef.current = true;

    async function setupFCM() {
      try {
        // Service Worker を登録
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('SW registered:', reg);

        // FCM 関連処理を動的 import
        const { requestPermissionAndGetToken, onMessageListener, getExistingToken } = await import(
          '@/lib/firebase-messaging'
        );

        // 通知許可とトークン取得
        let token: string | null = null;
        if (Notification.permission === 'granted') {
          token = await getExistingToken(reg);
        } else {
          token = await requestPermissionAndGetToken(reg);
        }
        if (!token) return;

        // デバイスID発行
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('device_id', deviceId);
        }

        // プラットフォーム判定
        let platform = 'web';
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) platform = 'ios';
        else if (/Android/i.test(navigator.userAgent)) platform = 'android';

        const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

        // Supabase に保存
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

        // フォアグラウンドメッセージリスナー
        onMessageListener((payload) => {
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

  return null;
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
      <FCMRegistration />
      {isChatRoom ? <ChatHeader /> : <ListHeader />}
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}
