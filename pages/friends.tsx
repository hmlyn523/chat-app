import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import UserList from '../components/UserList'
import FriendRequestList from '../components/FriendRequestList'

export default function FriendsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null)
    })
  }, [])

  if (!currentUserId) return <div className='mt-10'><p>ログイン情報を取得中...</p></div>

  return (
    <div className="mt-6 p-4 space-y-6">
      <UserList currentUserId={currentUserId} />
      <FriendRequestList currentUserId={currentUserId} />
    </div>
  )
}
