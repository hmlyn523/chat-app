import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { sendFriendRequest } from '../lib/friendService'

export default function UserList({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [sentRequests, setSentRequests] = useState<Record<string, string>>({})
  const [receivedRequests, setReceivedRequests] = useState<Record<string, string>>({})

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
        const sentMap: Record<string, string> = {}
        const receivedMap: Record<string, string> = {}

        requestsData.forEach((req) => {
          if (req.sender_id === currentUserId) {
            // 自分が送った申請
            sentMap[req.receiver_id] = req.status
          } else if (req.receiver_id === currentUserId) {
            // 自分が受け取った申請
            receivedMap[req.sender_id] = req.status
          }
        })

        setSentRequests(sentMap)
        setReceivedRequests(receivedMap)
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
      <ul className="space-y-2">
        {users.map((u) => {
          const sentStatus = sentRequests[u.id]  // 自分が送った申請状況
          const receivedStatus = receivedRequests[u.id] // 自分が受け取った申請状況
          const name = u.user_profiles?.nickname || u.email

          return (
            <li
              key={u.id}
              className={`flex items-center justify-between border p-3 rounded shadow-sm max-w-xs mx-auto
              ${
                sentStatus === 'accepted' || receivedStatus === 'accepted'
                  ? 'bg-green-100'
                  : sentStatus === 'pending' || receivedStatus === 'pending'
                  ? 'bg-yellow-50'
                  : 'bg-white'
              }`}
            >
              <span className="text-sm truncate">{name}</span>

              {/* 自分が送った申請が pending の場合 */}
              {sentStatus === 'pending' && (
                <span className="text-xs text-gray-500 ml-2">Pending</span>
              )}

              {/* 自分が受け取った申請が pending の場合 */}
              {receivedStatus === 'pending' && (
                <span className="text-xs text-blue-600 ml-2">Pending approval</span>
              )}

              {/* どちらかが accepted の場合 */}
              {(sentStatus === 'accepted' || receivedStatus === 'accepted') && (
                <span className="text-xs text-green-600 ml-2">Friend</span>
              )}

              {/* 自分が送った申請が rejected の場合 */}
              {sentStatus === 'rejected' && (
                <button
                  className="text-xs bg-red-500 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRequest(u.id)}
                >
                  Reapplication
                </button>
              )}

              {/* 申請していない場合 */}
              {!sentStatus && !receivedStatus && (
                <button
                  className="text-xs bg-blue-500 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRequest(u.id)}
                >
                  Application
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
