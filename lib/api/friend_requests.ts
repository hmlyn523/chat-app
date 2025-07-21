// lib/api/friend_requests.ts

import { supabase } from '@/lib/supabaseClient'

export async function requestFriend(senderId: string, receiverId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .insert([{ sender_id: senderId, receiver_id: receiverId, status: 'pending' }])

  if (error) throw error
  return data
}
