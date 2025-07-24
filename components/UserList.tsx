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
        .select('id, email, user_profiles(nickname)')

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
      <h2 className="text-xl font-semibold mb-2">ユーザー一覧</h2>
      <ul className="space-y-2">
        {users.map((u) => {
          const status = sentRequests[u.id]
          const name = u.user_profiles?.nickname || u.email

          return (
            <li
              key={u.id}
              className={`flex items-center justify-between border p-3 rounded shadow-sm max-w-xs mx-auto
              ${
                status === 'accepted'
                  ? 'bg-green-100'
                  : status === 'pending'
                  ? 'bg-yellow-50'
                  : 'bg-white'
              }`}
            >
              <span className="text-sm truncate">{name}</span>
              {status === 'pending' && (
                <span className="text-xs text-gray-500 ml-2">申請中</span>
              )}
              {status === 'accepted' && (
                <span className="text-xs text-green-600 ml-2">友だち</span>
              )}
              {status === 'rejected' && (
                <button
                  className="text-xs bg-red-500 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRequest(u.id)}
                >
                  再申請
                </button>
              )}
              {!status && (
                <button
                  className="text-xs bg-blue-500 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRequest(u.id)}
                >
                  申請
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
