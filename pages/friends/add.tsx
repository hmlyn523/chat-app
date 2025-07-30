// app/friends/add/page.tsx（または pages/friends/add.tsx）

'use client'

import { useEffect, useState } from 'react'
import { fetchOtherUsers } from '@/lib/api/users'
import { requestFriend } from '@/lib/api/friend_requests'
import { useSession } from '@supabase/auth-helpers-react'

export default function AddFriendPage() {
  const session = useSession()
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    if (!session?.user?.id) return

    fetchOtherUsers(session.user.id)
      .then(setUsers)
      .catch((error) => {
        console.error('ユーザー取得失敗:', error)
        alert('Failed to retrieve user.')
      })
  }, [session?.user?.id])

  const handleRequest = async (receiverId: string) => {
    if (!session?.user?.id) return
    try {
      await requestFriend(session.user.id, receiverId)
      alert('I sent in my application.')
    } catch (error) {
      console.error('申請エラー:', error)
      alert('Application failed.')
    }
  }

  if (!session?.user) {
    return <p>ログイン情報がありません。ログインしてください。</p>
  }

  return (
    <div className='mt-20 p-4'>
      <h1>ユーザー一覧（友だち申請）</h1>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.nickname}
            <button onClick={() => handleRequest(user.id)}>申請</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
