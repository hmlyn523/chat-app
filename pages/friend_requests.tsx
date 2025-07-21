// pages/friend_requests.tsx

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function FriendRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRequests() {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`id, sender_id, receiver_id, status`)

      if (error) {
        console.error('友だち申請の取得エラー:', error)
      } else {
        setRequests(data || [])
      }
      setLoading(false)
    }

    fetchRequests()
  }, [])

  if (loading) return <p>読み込み中...</p>

  return (
    <div className='mt-10' style={{ padding: '1rem' }}>
      <h1>友だち申請一覧</h1>
      {requests.length === 0 ? (
        <p>申請はありません。</p>
      ) : (
        <ul>
          {requests.map((req) => (
            <li key={req.id}>
              送信者: {req.sender_id} / 受信者: {req.receiver_id} / 状態: {req.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
