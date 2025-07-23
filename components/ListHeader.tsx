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

  return (
    <header className="fixed top-0 left-0 right-0 z-10 p-4 bg-gray-100 flex justify-between shadow items-center">
      <div className="flex items-center gap-2">
        {/* 戻るボタン */}
        {showBackButton && (
          <button onClick={handleBack} className="text-sm text-gray-600 mr-2">
            ≪
          </button>
        )}
        <h1 className="font-bold text-lg truncate">ヒトコト</h1>
      </div>

      <button
        onClick={handleLogout}
        className="text-sm text-blue-500"
      >
        ログアウト
      </button>
    </header>
  )
}
