// lib/services/userService.ts
import {
  fetchMessagesByChatId,
  markMessagesAsRead,
  // fetchMembersByChatId,
  // fetchAllUsers,
  // getCurrentUser,
  Message,
  // User,
} from '@/lib/api/messages';

import {
  // fetchMessagesByChatId,
  // markMessagesAsRead,
  fetchMembersByChatId,
  fetchAllUsers,
  getCurrentUser,
  // Message,
  User,
} from '@/lib/api/users';

export async function fetchMessages(chatId: string): Promise<Message[]> {
  return fetchMessagesByChatId(chatId);
}

export async function fetchMembers(chatId: string): Promise<User[]> {
  return fetchMembersByChatId(chatId);
}

export async function fetchUsers(): Promise<User[]> {
  return fetchAllUsers();
}

// メッセージ取得 + 既読登録
export async function fetchMessagesAndMarkRead(
  chatId: string,
  setMessages: (msgs: Message[]) => void,
  setCurrentUserId: (id: string) => void
) {
  const user = await getCurrentUser();
  if (!user) return;

  setCurrentUserId(user.id);

  const messages = await fetchMessagesByChatId(chatId);
  setMessages(messages);

  const messageIds = messages.map((m) => m.id);
  await markMessagesAsRead(messageIds, user.id);
}
