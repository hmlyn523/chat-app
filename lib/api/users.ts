// lib/api/users.ts
import { supabase } from '@/lib/supabaseClient';

export type UserProfile = {
  user_id: string;
  nickname: string;
};

export type User = {
  id: string;
  email: string;
  user_profiles?: UserProfile;
};

// 自分以外のユーザー一覧を取得
export async function fetchOtherUsers(currentUserId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, nickname')
    .neq('user_id', currentUserId);

  if (error) throw error;
  return data;
}

// チャットメンバー一覧
export async function fetchMembersByChatId(chatId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id, users(email, user_profiles(nickname))')
    .eq('chat_id', chatId);

  if (error) throw error;
  return (data || []).map((m: any) => ({
    id: m.user_id,
    email: m.users?.[0]?.email ?? '',
    user_profiles: m.users?.[0]?.user_profiles?.[0] ?? undefined,
  }));
}

// 全ユーザー一覧
export async function fetchAllUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('id, email');

  if (error) throw error;
  return data || [];
}

// 現在ログイン中のユーザー
export async function getCurrentUser() {
  const { data: userResponse } = await supabase.auth.getUser();
  return userResponse?.user ?? null;
}
