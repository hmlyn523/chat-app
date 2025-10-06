import { supabase } from 'lib/supabaseClient';

/**
 * チャットからユーザーを削除（chat_membersからDELETE）
 * @param chatId - チャットID
 * @param userId - 削除するユーザーID
 * @returns { error: SupabaseError | null } - エラー情報
 */
export async function removeUserFromChat(chatId: string, userId: string) {
  const { error } = await supabase
    .from('chat_members')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', userId);

  return { error }; // これで { error } が返る
}

// チャットにフレンドを追加
export async function addFriendToChat(userId: string, chatId: string, targetUserId: string) {
  // 1. 自分のフレンドかチェック
  const { data: friends, error: friendError } = await supabase
    .from('friend_requests')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${userId})`
    );

  if (friendError) return { error: friendError };
  if (!friends || friends.length === 0) return { error: '指定ユーザーはフレンドではありません' };

  // 2. 既にチャットにいるかチェック
  const { data: chatMembers, error: chatError } = await supabase
    .from('chat_members')
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', targetUserId);

  if (chatError) return { error: chatError };
  if (chatMembers && chatMembers.length > 0) return { error: 'すでにチャットに参加しています' };

  // 3. チャットに追加
  const { error: insertError } = await supabase.from('chat_members').insert({
    chat_id: chatId,
    user_id: targetUserId,
  });

  if (insertError) return { error: insertError };

  return { error: null };
}
