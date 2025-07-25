// pages/_app.tsx
import { useState } from 'react'
import { AppProps } from 'next/app'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
// import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/auth-helpers-nextjs'
import '../styles/globals.css'
import ChatHeader from '../components/ChatHeader'
import ListHeader from '../components/ListHeader'
import { usePathname } from 'next/navigation';

export default function App({
    Component,
    pageProps,
}: AppProps<{ initialSession: Session }>) {
    const [supabaseClient] = useState(() => createPagesBrowserClient())
    const pathname = usePathname()
    const isChatRoom = pathname?.startsWith('/chat/')

    return (
    <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
    >
      {isChatRoom
        ? <ChatHeader />     // チャット画面専用ヘッダー
        : <ListHeader />     // チャット一覧・それ以外の画面用ヘッダー
      }
        <Component {...pageProps} />
    </SessionContextProvider>
    )
}
