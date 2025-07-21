// pages/auth/callback.tsx

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
      if (error) {
        console.error('ログイン失敗:', error.message)
        router.replace('/login')
      } else {
        router.replace('/') // ← 認証成功後に遷移したいページに変更
      }
    }

    handleOAuthCallback()
  }, [])

  return <p>ログイン処理中...</p>
}
