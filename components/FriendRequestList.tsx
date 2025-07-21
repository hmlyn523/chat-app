import { useEffect, useState } from 'react'
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest } from '../lib/friendService'
import { supabase } from '../lib/supabaseClient'

export default function FriendRequestList({ currentUserId }: { currentUserId: string }) {
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await getFriendRequests(currentUserId)
      setRequests(data?.filter((r) => r.receiver_id === currentUserId && r.status === 'pending') || [])
    }
    load()
  }, [currentUserId])

  const handleAccept = async (id: string) => {
    await acceptFriendRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
    alert('友だちになりました！')
    // ここで DM チャット作成処理を入れてもOK
  }

  const handleReject = async (id: string) => {
    await rejectFriendRequest(id)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div>
      <h2>受信した友だち申請</h2>
      {requests.length === 0 && <p>新しい申請はありません。</p>}
      <ul>
        {requests.map((r) => (
          <li key={r.id}>
            {r.sender_id}
            <button className="ml-2 bg-green-500 text-white px-2 py-1 rounded"
              onClick={() => handleAccept(r.id)}>承認</button>
            <button className="ml-2 bg-red-500 text-white px-2 py-1 rounded"
              onClick={() => handleReject(r.id)}>拒否</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
