import { supabase } from '../supabaseClient';
import {
  createFriendRequest,
  fetchFriendRequests,
  updateFriendRequestStatus,
  deleteFriendRelation,
  fetchAcceptedFriends,
} from '@/lib/api/friend_requests';
import { removeUserFromChat } from '@/lib/api/chats';

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error } = await createFriendRequest(senderId, receiverId);
  return { error };
}

export async function getFriendRequests(userId: string) {
  return await fetchFriendRequests(userId);
}

export async function acceptFriendRequest(requestId: string) {
  return await updateFriendRequestStatus(requestId, 'accepted');
}

export async function rejectFriendRequest(requestId: string) {
  return await updateFriendRequestStatus(requestId, 'rejected');
}

export async function getAcceptedFriends(userId: string) {
  const { data, error } = await fetchAcceptedFriends(userId);
  if (error) return { friends: [], error };

  const friends = (data ?? []).map((r: any) =>
    r.sender_id === userId ? r.receiver_id : r.sender_id
  );
  return { friends, error: null };
}

export async function unfriend(userId: string, targetUserId: string) {
  const { error: friendError } = await deleteFriendRelation(userId, targetUserId);
  if (friendError) return { error: friendError };

  // ここでチャット関連の削除処理をまとめる
  const { data: chats, error: chatError } = await supabase
    .from('chats')
    .select('id, chat_members!inner(user_id)');
  if (chatError) return { error: chatError };

  for (const chat of chats ?? []) {
    const memberIds = chat.chat_members.map((m: any) => m.user_id);

    if (memberIds.includes(userId)) await removeUserFromChat(chat.id, userId);
    if (memberIds.includes(targetUserId)) await removeUserFromChat(chat.id, targetUserId);
  }

  return { error: null };
}
