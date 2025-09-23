// types/user.ts
// ユーザー関連の型定義

import type { UserProfile, RawUser, FriendRequest } from './index';

// ユーザー特化の追加型
export interface UserWithProfile extends RawUser {
  profile: UserProfile | null;
}

export interface FriendListItem extends UserProfile {
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
}
