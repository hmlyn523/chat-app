import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { sendFriendRequest } from '../lib/friendService'

export default function UserList({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sentRequests, setSentRequests] = useState<Record<string, string>>({})

  useEffect(() => {
    // ユーザー一覧取得
    supabase
      .from('users')
      .select('id, email')
      .then(({ data }) => {
        const filtered = data?.filter((u) => u.id !== currentUserId) || []
        setUsers(filtered)
      })

    // 自分が送った friend_requests を取得
    supabase
      .from('friend_requests')
      .select('receiver_id, status')
      .eq('sender_id', currentUserId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {}
          data.forEach((req) => {
            map[req.receiver_id] = req.status
          })
          setSentRequests(map)
        }
      })
  }, [currentUserId])

  const handleRequest = async (userId: string) => {
    const { error } = await sendFriendRequest(currentUserId, userId)
    if (!error) {
      alert('友だち申請を送りました')
      setSentRequests((prev) => ({ ...prev, [userId]: 'pending' }))
    }
  }

  return (
    <div>
      <h2>ユーザー一覧</h2>
      <ul>
        {users.map((u) => {
          const status = sentRequests[u.id]

          return (
            <li key={u.id}>
              {u.email}
              {status === 'pending' && <span className="ml-2 text-gray-500">申請中</span>}
              {status === 'accepted' && <span className="ml-2 text-green-600">友だち</span>}
              {status === 'rejected' && (
                <button
                  className="ml-2 bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => handleRequest(u.id)}
                >
                  再申請
                </button>
              )}
              {!status && (
                <button
                  className="ml-2 bg-blue-500 text-white px-2 py-1 rounded"
                  onClick={() => handleRequest(u.id)}
                >
                  友だち申請
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
