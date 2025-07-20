import { supabase } from '../lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()

  const isChatRoom = pathname.startsWith('/chat/')
  
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth') // ログイン画面へ
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-10 p-4 bg-gray-100 flex justify-between shadow items-center">
      <div className="flex items-center gap-2">
        {isChatRoom && (
          <button onClick={() => router.push('/')} className="text-blue-500 text-lg font-bold">
            &lt;
          </button>
        )}
        <h1 className="font-bold text-lg">
          My Chat App
        </h1>
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
