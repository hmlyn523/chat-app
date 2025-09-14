import { supabase } from '../supabaseClient';

export async function removeUserFromChat(chatId: string, userId: string) {
  // 1. 該当ユーザーをメンバーから削除
  await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', userId);

  // 2. 残りメンバーをチェック
  const { data: remaining } = await supabase
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId);

  const remainingCount = remaining?.length ?? 0;

  if (remainingCount <= 1) {
    await supabase.from('chats').delete().eq('id', chatId);
  }
}
