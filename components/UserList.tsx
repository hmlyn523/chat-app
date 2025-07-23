import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { sendFriendRequest } from '../lib/friendService'

export default function UserList({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sentRequests, setSentRequests] = useState<Record<string, string>>({})

  useEffect(() => {
    const fetchData = async () => {
      // ユーザー一覧取得
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email')

      const filteredUsers = usersData?.filter((u) => u.id !== currentUserId) || []
      setUsers(filteredUsers)

      // 自分が関係している全 friend_requests を取得（sender または receiver）
      const { data: requestsData } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)

      if (requestsData) {
        const map: Record<string, string> = {}

        requestsData.forEach((req) => {
          const otherUserId =
            req.sender_id === currentUserId ? req.receiver_id : req.sender_id
          map[otherUserId] = req.status
        })

        setSentRequests(map)
      }
    }

    fetchData()
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
