// lib/api/friend_requests.ts

import { supabase } from '@/lib/supabaseClient';

export async function requestFriend(senderId: string, receiverId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .insert([{ sender_id: senderId, receiver_id: receiverId, status: 'pending' }]);

  if (error) throw error;
  return data;
}

export async function removeFriend(userId: string, friendId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
    );

  if (error) {
    console.error('友だち削除エラー:', error);
    throw error;
  }
}
