// lib/api/messages.ts
import { supabase } from '../supabaseClient';

export type Message = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  image_url: string | null;
  users: {
    email: string;
    user_profiles: {
      nickname: string;
    } | null;
  } | null;
  message_reads: { user_id: string }[];
};

// メッセージ一覧を取得
export async function fetchMessagesByChatId(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(
      `
      id,
      content,
      user_id,
      created_at,
      image_url,
      users (
        email,
        user_profiles (
          nickname
        )
      ),
      message_reads (
        user_id
      )
    `
    )
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .overrideTypes<Message[], { merge: false }>();

  if (error) throw error;
  return data || [];
}

// 既読登録
export async function markMessagesAsRead(messageIds: string[], userId: string) {
  if (messageIds.length === 0) return;

  const inserts = messageIds.map((messageId) => ({
    message_id: messageId,
    user_id: userId,
  }));

  const { error } = await supabase
    .from('message_reads')
    .upsert(inserts, { onConflict: 'message_id,user_id' });

  if (error) console.error('既読登録失敗:', error);
}
