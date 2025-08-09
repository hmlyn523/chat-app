// services/userService.ts
import { supabase } from '@/lib/supabaseClient'

// メッセージ一覧を取得
export async function fetchMessages(chatId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
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
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

// チャットルームのメンバー一覧を取得
export async function fetchMembers(chatId: string) {
  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id, users(email, user_profiles(nickname))')
    .eq('chat_id', chatId)

  if (error) {
    console.error('メンバー取得失敗:', error)
    throw error
  }

  return data || []
}

// ユーザー一覧を取得
export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email')

  if (error) {
    console.error('ユーザー一覧取得失敗:', error)
    throw error
  }

  return data || []
}

export async function fetchMessagesAndMarkRead(
  chatId: string,
  setMessages: (msgs: any[]) => void,
  setCurrentUserId: (id: string) => void
) {
  const { data: userResponse } = await supabase.auth.getUser()
  const user = userResponse?.user
  if (!user) return

  setCurrentUserId(user.id)

  const messages = await fetchMessages(chatId)
  setMessages(messages || [])

  const messageIds = (messages || []).map((m) => m.id)
  await markMessagesAsRead(messageIds, user.id)
}

export async function markMessagesAsRead(messageIds: string[], userId: string) {
  if (messageIds.length === 0) return

  const inserts = messageIds.map((messageId) => ({
    message_id: messageId,
    user_id: userId,
  }))

  const { error } = await supabase
    .from('message_reads')
    .upsert(inserts, { onConflict: 'message_id,user_id' })

  if (error) {
    console.error('既読登録失敗:', error)
  }
}
