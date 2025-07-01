import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function Header() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth') // ログイン画面へ
  }

  return (
    <header className="p-4 bg-gray-100 flex justify-between">
      <h1>My Chat App</h1>
      <button onClick={handleLogout} className="text-sm text-blue-500">
        ログアウト
      </button>
    </header>
  )
}
