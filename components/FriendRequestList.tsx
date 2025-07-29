import { useEffect, useState } from 'react'
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest } from '../lib/friendService'
import { supabase } from '../lib/supabaseClient'

export default function FriendRequestList({ currentUserId }: { currentUserId: string }) {
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await getFriendRequests(currentUserId)
      setRequests(
        data?.filter((r) => r.receiver_id === currentUserId && r.status === 'pending') || []
      )
    }
    load()
  }, [currentUserId])

  const handleAccept = async (id: string) => {
    await acceptFriendRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
    alert('友だちになりました！')
  }

  const handleReject = async (id: string) => {
    await rejectFriendRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">受信した友だち申請</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">新しい申請はありません。</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between border p-3 rounded shadow-sm bg-white"
            >
              <span className="text-sm">{r.sender?.nickname || r.sender_id}</span>
              <div className="flex space-x-2">
                <button
                  className="text-xs bg-green-500 text-white px-3 py-1 rounded"
                  onClick={() => handleAccept(r.id)}
                >
                  承認
                </button>
                <button
                  className="text-xs bg-red-500 text-white px-3 py-1 rounded"
                  onClick={() => handleReject(r.id)}
                >
                  拒否
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
