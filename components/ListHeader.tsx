import { supabase } from '../lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ListHeader() {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleBack = () => {
    router.back()
  }

  const showBackButton = pathname !== '/'

  // プロフィールページに遷移する関数
  const goToProfile = () => {
    router.push('/profile') // /profile ページへ遷移
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-10 p-4 bg-gray-100 flex justify-between shadow items-center">
      <div className="flex items-center gap-2">
        <button
          onClick={showBackButton ? handleBack : undefined}
          className={`text-2xl font-bold mr-2 leading-none flex items-center justify-center ${
            showBackButton ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          tabIndex={showBackButton ? 0 : -1}
          aria-hidden={showBackButton ? 'false' : 'true'}
        >
          ＜
        </button>
        <h1 className="text-2xl font-bold leading-none align-middle">ヒトコト</h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={goToProfile}
          className="text-sm text-blue-500"
        >
          プロフィール
        </button>
        <button
          onClick={handleLogout}
          className="text-sm text-blue-500"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
