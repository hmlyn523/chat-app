// types/chat.ts
// チャット関連の型定義

// ✅ 正しい相対パスでインポート
import type { Chat, ChatMember, UserProfile, UnreadCount, Message } from './index'; // ./index.ts を参照

// チャット特化の拡張型
export interface ChatWithMembers extends Chat {
  members: ChatMember[];
  unread_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_nickname: string;
  };
}

/**
 * チャットリストアイテム（Home画面用）
 */
export interface ChatListItem extends Chat {
  unread_count: number;
  last_message_preview?: string;
  last_message_time?: string;
  is_group: boolean;
}

/**
 * チャット作成用のデータ
 */
export interface CreateChatData {
  name?: string;
  is_group: boolean;
  member_ids: string[];
}

// 便利な再エクスポート（チャット関連型のみ）
export type { Chat, ChatMember, UserProfile, UnreadCount, Message } from './index';
