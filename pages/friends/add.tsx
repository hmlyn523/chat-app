// app/friends/add/page.tsx（または pages/friends/add.tsx）

'use client'

import { useEffect, useState } from 'react'
import { fetchOtherUsers } from '@/lib/api/users'
import { requestFriend } from '@/lib/api/friend_requests'
import { useSession } from '@supabase/auth-helpers-react'

export default function AddFriendPage() {
  const session = useSession()
  const currentUserId = session?.user.id
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    if (!currentUserId) return
    fetchOtherUsers(currentUserId).then(setUsers)
  }, [currentUserId])

  const handleRequest = async (receiverId: string) => {
    if (!currentUserId) return
    await requestFriend(currentUserId, receiverId)
    alert('申請を送りました！')
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
