// types/friend.ts

/**
 * フレンドリクエストのステータス型
 */
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * フレンドリクエストの型（オプション: 拡張用）
 */
export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: FriendRequestStatus;
  created_at?: string; // Supabaseのタイムスタンプ用
}
