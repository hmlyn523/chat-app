// pages/_app.tsx
import { useState } from 'react'
import { AppProps } from 'next/app'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
// import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { Session } from '@supabase/auth-helpers-nextjs'
import '../styles/globals.css'
import Header from '../components/Header'

export default function App({
    Component,
    pageProps,
}: AppProps<{ initialSession: Session }>) {
    const [supabaseClient] = useState(() => createPagesBrowserClient())

    return (
    <SessionContextProvider
        supabaseClient={supabaseClient}
        initialSession={pageProps.initialSession}
    >
        <Header />
        <Component {...pageProps} />
    </SessionContextProvider>
    )
}
