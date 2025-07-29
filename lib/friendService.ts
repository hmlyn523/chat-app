import { supabase } from './supabaseClient'

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error, data } = await supabase
    .from('friend_requests')
    .insert([{ sender_id: senderId, receiver_id: receiverId, status: 'pending' }])
  return { error }
}

// export async function getFriendRequests(userId: string) {
//   const { data, error } = await supabase
//     .from('friend_requests')
//     .select('id, sender_id, receiver_id, status, created_at')
//     .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`) // 自分が送った or 受けた
//   return { data, error }
// }

export async function getFriendRequests(userId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      sender_id,
      receiver_id,
      status,
      created_at,
      sender:user_profiles!friend_requests_sender_id_fkey(nickname)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`) // 自分が送った or 受けた
  return { data, error }
}

export async function acceptFriendRequest(requestId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
  return { error }
}

export async function rejectFriendRequest(requestId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
  return { error }
}

export async function getAcceptedFriends(userId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted')
  if (error) return { friends: [], error }

  const friends = data.map((r) =>
    r.sender_id === userId ? r.receiver_id : r.sender_id
  )

  return { friends, error: null }
}
