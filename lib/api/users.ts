// lib/api/users.ts
import { supabase } from '@/lib/supabaseClient';

export type UserProfile = {
  user_id: string;
  nickname: string;
};

export type User = {
  id: string;
  email: string;
  user_profiles?: UserProfile | null;
};

type ChatMemberResponse = {
  user_id: string;
  users: {
    email: string;
    user_profiles: UserProfile | null;
  } | null;
};

// 指定したユーザー以外のユーザー一覧を取得
export async function fetchUsersExcluding(excludeUserId: string): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, nickname')
    .neq('user_id', excludeUserId);

  if (error) throw error;
  return data ?? [];
}

// チャットメンバー一覧
export async function fetchMembersByChatId(chatId: string): Promise<User[]> {
  if (!chatId || typeof chatId !== 'string') {
    throw new Error('Invalid chatId provided');
  }

  const { data, error } = await supabase
    .from('chat_members')
    .select(
      `
      user_id,
      users (
        email,
        user_profiles (
          user_id,
          nickname
        )
      )
    `
    )
    .eq('chat_id', chatId)
    .overrideTypes<ChatMemberResponse[], { merge: false }>();

  if (error) {
    throw new Error(`Failed to fetch chat members: ${error.message}`);
  }

  // 型を揃えて返す
  return (data ?? []).map((m) => ({
    id: m.user_id,
    email: m.users?.email ?? '',
    user_profiles: m.users?.user_profiles ?? null,
  }));
}

// 全ユーザー一覧
export async function fetchAllUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('id, email').returns<User[]>();

  if (error) throw error;
  return data ?? [];
}

// 現在ログイン中のユーザー
export async function getCurrentUser() {
  const { data: userResponse } = await supabase.auth.getUser();
  return userResponse?.user ?? null;
}
