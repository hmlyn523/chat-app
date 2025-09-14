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

// 友だち申請作成
export async function createFriendRequest(senderId: string, receiverId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .insert([{ sender_id: senderId, receiver_id: receiverId, status: 'pending' }]);
  return { data, error };
}

// 友だち申請取得
export async function fetchFriendRequests(userId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(
      `
      id,
      sender_id,
      receiver_id,
      status,
      created_at,
      sender:user_profiles!friend_requests_sender_id_fkey(nickname)
    `
    )
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
  return { data, error };
}

// 友だち申請承認
export async function updateFriendRequestStatus(
  requestId: string,
  status: 'accepted' | 'rejected'
) {
  const { error } = await supabase.from('friend_requests').update({ status }).eq('id', requestId);
  return { error };
}

// フレンド関係削除
export async function deleteFriendRelation(userId: string, targetUserId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`
    );
  return { error };
}

// 承認済みフレンド取得
export async function fetchAcceptedFriends(userId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');
  return { data, error };
}
