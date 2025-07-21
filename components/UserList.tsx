import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { sendFriendRequest } from '../lib/friendService'

export default function UserList({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    supabase.from('users').select('id, email').then(({ data }) => {
      setUsers(data?.filter((u) => u.id !== currentUserId) || [])
    })
  }, [currentUserId])

  const handleRequest = async (userId: string) => {
    const { error } = await sendFriendRequest(currentUserId, userId)
    if (!error) alert('友だち申請を送りました')
  }

  return (
    <div>
      <h2>ユーザー一覧</h2>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            {u.email}
            <button className="ml-2 bg-blue-500 text-white px-2 py-1 rounded"
              onClick={() => handleRequest(u.id)}>友だち申請</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
