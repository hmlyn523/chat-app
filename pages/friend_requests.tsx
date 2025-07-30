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

  if (loading) return <p>Loading...</p>

  return (
    <div className='mt-10' style={{ padding: '1rem' }}>
      <h1>friend requests.</h1>
      {requests.length === 0 ? (
        <p>There is no application.</p>
      ) : (
        <ul>
          {requests.map((req) => (
            <li key={req.id}>
              Sender: {req.sender_id} / Recipient: {req.receiver_id} / Status: {req.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
