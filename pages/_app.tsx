// pages/_app.tsx
import { useState, useEffect } from 'react'
import { AppProps } from 'next/app'
import { SessionContextProvider, useUser } from '@supabase/auth-helpers-react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/router'
import '../styles/globals.css'
import ChatHeader from '../components/ChatHeader'
import ListHeader from '../components/ListHeader'
import { supabase } from '../lib/supabaseClient'

// FCM登録を行うコンポーネント
function FCMRegistration() {
  const user = useUser()
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    let isMounted = true; // アンマウント検知用
    let alreadyRegistered = false; // 二重登録防止用
    
    async function registerFCM() {
      if (alreadyRegistered) return;
      alreadyRegistered = true;

      try {
        // ユーザーがログインしていない場合はスキップ
        if (!user) {
          console.log('User not logged in, skipping FCM registration')
          return
        }

        console.log('Starting FCM registration for user:', user.id)

        // 動的importを使用してSSRを回避
        const { requestPermissionAndGetToken } = await import("../lib/firebase-messaging")

        const token = await requestPermissionAndGetToken()
        if (!token) {
          console.log('Failed to get FCM token')
          return
        }

        if (!isMounted) return; // アンマウントされていたら中断

        console.log('FCM token obtained:', token.substring(0, 20) + '...')

        // トークンをDBに保存
        const { error } = await supabase.from("push_tokens").upsert({
          user_id: user.id,
          fcm_token: token,
        })

        if (error) {
          console.error('Failed to save FCM token:', error)
          alert('プッシュ通知トークンの保存に失敗しました。エラー: ' + error.message);
        } else {
          console.log('FCM token saved successfully for user:', user.id)
          alert('プッシュ通知トークンの保存に成功しました。');
        }

        // フォアグラウンド通知のリスナーも設定
        const { onMessageListener } = await import("../lib/firebase-messaging")
        onMessageListener((payload) => {
          if (!isMounted) return;
          console.log('Foreground message received:', payload)
          
          // フォアグラウンドでの通知表示（オプション）
          if (payload.notification && 'Notification' in window) {
            new Notification(payload.notification.title || '新しいメッセージ', {
              body: payload.notification.body || '',
              icon: '/icons/icon-192.png',
              data: payload.data || {},
            })
          }
        })
      } catch (error) {
        console.error('Error in FCM registration:', error)
        alert('予期しないエラーが発生しました。');
      }
    }

    registerFCM()
  }, [user]) // userの変更を監視

  return null // このコンポーネントは何もレンダリングしない
}

export default function App({
    Component,
    pageProps,
}: AppProps<{ initialSession: Session }>) {
    const [supabaseClient] = useState(() => createPagesBrowserClient())
    const router = useRouter()
    const isChatRoom = router.pathname?.startsWith('/chat/')

    return (
        <SessionContextProvider
            supabaseClient={supabaseClient}
            initialSession={pageProps.initialSession}
        >
            {/* FCM登録コンポーネント */}
            <FCMRegistration />
            
            {/* ヘッダー */}
            {isChatRoom
                ? <ChatHeader />     // チャット画面専用ヘッダー
                : <ListHeader />     // チャット一覧・それ以外の画面用ヘッダー
            }
            
            {/* メインコンテンツ */}
            <Component {...pageProps} />
        </SessionContextProvider>
    )
}