// アプリケーション全体で使用される主要な型定義

// ====================
// ユーザー関連
// ====================

/**
 * ユーザー プロフィール情報
 */
export interface UserProfile {
  user_id: string;
  nickname: string;
}

/**
 * 生のユーザー情報（Supabaseから取得）
 */
export interface RawUser {
  id: string;
  email: string;
  user_profiles: {
    user_id: string;
    nickname?: string | null;
  } | null;
}

// ====================
// チャット関連
// ====================

/**
 * 表示用のチャット情報
 */
export interface Chat {
  chat_id: string;
  name: string;
}

/**
 * チャットメンバー（表示用）
 */
export interface ChatMember extends UserProfile {
  joined_at?: string;
  last_read_at?: string;
}

/**
 * Homeページ用（chat_members → chats, users直接JOIN）
 * クエリ: chat_members → chats, users (auth.users) → user_profiles
 */
export interface RawChatMemberForHome {
  chat_id: string; // ✅ chat_members.chat_id
  user_id: string; // ✅ chat_members.user_id
  chats: {
    // ✅ chatsテーブル直接JOIN
    id: string;
    name?: string;
  };
  users: {
    // ✅ usersテーブル（auth.users）直接JOIN
    id: string;
    email: string;
    user_profiles?: {
      // ✅ user_profilesをusers経由でJOIN
      nickname?: string | null;
    } | null;
  };
}

/**
 * ChatHeader用（chat_members → users!inner → user_profiles, chats直接JOIN）
 * クエリ: chat_members → users!inner (auth.users) → user_profiles, chats
 */
export interface RawChatMemberForHeader {
  user_id: string;
  users: {
    id: string;
    user_profiles: {
      user_id: string;
      nickname: string | null;
    };
  };
  chats: {
    id: string;
    name: string | null;
  };
}

// ====================
// その他の型
// ====================

/**
 * 未読数情報
 */
export interface UnreadCount {
  chat_id: string;
  unread_count: number;
}

/**
 * メッセージ
 */
export interface Message {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  sender_nickname?: string; // 表示用に追加
}

// ====================
// フレンド関連（friend.tsからの再エクスポート）
// ====================

// friend.tsから全型を再エクスポート（重複削除）
export * from './friend';
