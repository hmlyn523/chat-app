import { supabase } from './supabaseClient';

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error, data } = await supabase
    .from('friend_requests')
    .insert([{ sender_id: senderId, receiver_id: receiverId, status: 'pending' }]);
  return { error };
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
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`); // 自分が送った or 受けた
  return { data, error };
}

export async function acceptFriendRequest(requestId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  return { error };
}

export async function rejectFriendRequest(requestId: string) {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);
  return { error };
}

export async function getAcceptedFriends(userId: string) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (error) return { friends: [], error };

  const friends = data.map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id));

  return { friends, error: null };
}

export async function removeUserFromChat(chatId: string, userId: string) {
  // 1. 該当ユーザーをメンバーから削除
  await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', userId);

  // 2. 残りメンバーをチェック
  const { data: remaining } = await supabase
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId);

  // 残りメンバーが1人以下ならチャットを削除
  if (!remaining || remaining.length <= 1) {
    await supabase.from('chats').delete().eq('id', chatId);
  }
}

export async function unfriend(userId: string, targetUserId: string) {
  // 1. friend_requests を削除（フレンド解除）
  const { error: friendError } = await supabase
    .from('friend_requests')
    .delete()
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`
    );

  if (friendError) return { error: friendError };

  // 2. 自分が参加しているチャットを取得
  const { data: chats, error: chatError } = await supabase.from('chats').select(`
    id,
    chat_members!inner(user_id)
  `);

  if (chatError) return { error: chatError };

  for (const chat of chats ?? []) {
    const memberIds = chat.chat_members.map((m: any) => m.user_id);

    // 自分または対象ユーザーがチャットにいる場合は削除
    if (memberIds.includes(userId)) {
      await removeUserFromChat(chat.id, userId);
    }
    if (memberIds.includes(targetUserId)) {
      await removeUserFromChat(chat.id, targetUserId);
    }
  }

  return { error: null };
}
