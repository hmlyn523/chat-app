// pages/_app.tsx
import { useRef, useState, useEffect } from 'react';
import { AppProps } from 'next/app';
import { SessionContextProvider, useUser } from '@supabase/auth-helpers-react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Session } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import ChatHeader from '../components/ChatHeader';
import ListHeader from '../components/ListHeader';
import { supabase } from '../lib/supabaseClient';

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

    async function registerFCM() {
      try {
        // 動的importを使用してSSRを回避
        const { requestPermissionAndGetToken, onMessageListener } = await import(
          '../lib/firebase-messaging'
        );

        // 通知許可とトークン取得
        const token = await requestPermissionAndGetToken();
        if (!token) return;

        console.log('FCM token obtained:', token.substring(0, 20) + '...');

        // トークンをDBに保存
        await supabase.from('push_tokens').upsert({
          user_id: user?.id,
          fcm_token: token,
        });

        // フォアグラウンドメッセージリスナー設定
        onMessageListener((payload) => {
          if (payload.notification) {
            new Notification(payload.notification.title || '新しいメッセージ', {
              body: payload.notification.body || '',
              icon: '/icons/icon-192.png',
              data: payload.data || {},
            });
          }
        });
      } catch (error) {
        console.error('Error in FCM registration:', error);
      }
    }

    registerFCM();
  }, [user]); // userの変更を監視

  return null; // このコンポーネントは何もレンダリングしない
}

export default function App({ Component, pageProps }: AppProps<{ initialSession: Session }>) {
  const [supabaseClient] = useState(() => createPagesBrowserClient());
  const router = useRouter();
  const isChatRoom = router.pathname?.startsWith('/chat/');

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      {/* FCM登録コンポーネント */}
      <FCMRegistration />

      {/* ヘッダー */}
      {
        isChatRoom ? (
          <ChatHeader /> // チャット画面専用ヘッダー
        ) : (
          <ListHeader />
        ) // チャット一覧・それ以外の画面用ヘッダー
      }

      {/* メインコンテンツ */}
      <Component {...pageProps} />
    </SessionContextProvider>
  );
}
