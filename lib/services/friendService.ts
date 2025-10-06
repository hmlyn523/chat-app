import { supabase } from 'lib/supabaseClient';
import {
  createFriendRequest,
  fetchFriendRequests,
  updateFriendRequestStatus,
  deleteFriendRelation,
  fetchAcceptedFriends,
} from '@/lib/api/friend_requests';
import { removeUserFromChat } from '@/lib/api/chats';

import { FriendRequestStatus } from '@/types'; // 修正: /friend削除、index.ts経由

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error } = await createFriendRequest(senderId, receiverId);
  return { error };
}

export async function getFriendRequests(userId: string) {
  return await fetchFriendRequests(userId);
}

// accept/reject: コメントアウト復活、API一貫性でupdateFriendRequestStatus使用（requestId必要ならUserListで管理）
export async function acceptFriendRequest(receiverId: string, senderId: string) {
  // TODO: requestIdが必要なら、fetchで取得後update
  const { data: reqData } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('receiver_id', receiverId)
    .eq('sender_id', senderId)
    .eq('status', 'pending')
    .single(); // 1件取得

  if (!reqData) return { error: new Error('リクエストが見つかりません') };

  const { error } = await updateFriendRequestStatus(reqData.id, 'accepted');
  return { error };
}

export async function rejectFriendRequest(receiverId: string, senderId: string) {
  // 同上
  const { data: reqData } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('receiver_id', receiverId)
    .eq('sender_id', senderId)
    .eq('status', 'pending')
    .single();

  if (!reqData) return { error: new Error('リクエストが見つかりません') };

  const { error } = await updateFriendRequestStatus(reqData.id, 'rejected');
  return { error };
}

export async function getAcceptedFriends(userId: string) {
  const { data, error } = await fetchAcceptedFriends(userId);
  if (error) return { friends: [], error };

  const friends = (data ?? []).map((r: any) =>
    r.sender_id === userId ? r.receiver_id : r.sender_id
  );
  return { friends, error: null };
}

// lib/services/friendService.ts の unfriend 関数を以下に置き換え

export async function unfriend(userId: string, targetUserId: string) {
  // 1. フレンド関係を削除（friend_requestsのacceptedを削除）
  const { error: friendError } = await deleteFriendRelation(userId, targetUserId);
  if (friendError) {
    console.error('フレンド削除エラー:', friendError);
    return { error: friendError };
  }

  // 2. ステップ1: userIdのchat_id一覧を取得（フィルターなしでuserIdのメンバーシップ）
  const { data: userChatIds, error: chatIdsError } = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', userId);

  if (chatIdsError) {
    console.error('userIdのchat_id取得エラー:', chatIdsError);
    return { error: chatIdsError };
  }

  const userChatIdList = userChatIds?.map((item: any) => item.chat_id) ?? [];

  if (userChatIdList.length === 0) {
    return { error: null }; // 共有チャットなし
  }

  // 3. ステップ2: 上記のchat_idでchatsと全chat_membersを取得（JOINフィルターなし）
  let query = supabase
    .from('chats')
    .select(
      `
      id,
      is_group,
      chat_members!inner(user_id)
    `
    )
    .in('id', userChatIdList); // chat_id IN (userのchat_id一覧)

  const { data: userChats, error: userChatError } = await query;

  if (userChatError) {
    console.error('共有チャット取得エラー:', userChatError);
    return { error: userChatError };
  }

  // 4. 各共有チャットから両ユーザーを削除
  for (const chat of userChats ?? []) {
    const memberIds = chat.chat_members.map((m: any) => m.user_id);
    if (memberIds.includes(targetUserId)) {
      // 今度は全メンバーが入るのでtrueになる
      console.log(`共有チャット検知: ${chat.id} (メンバー: ${memberIds.join(', ')})`);

      // userIdを削除
      const { error: removeUserError1 } = await removeUserFromChat(chat.id, userId);
      if (removeUserError1) {
        console.error(
          `ユーザー ${userId} のチャット削除エラー (chat ${chat.id}):`,
          removeUserError1
        );
      }

      // targetUserIdを削除
      const { error: removeUserError2 } = await removeUserFromChat(chat.id, targetUserId);
      if (removeUserError2) {
        console.error(
          `ユーザー ${targetUserId} のチャット削除エラー (chat ${chat.id}):`,
          removeUserError2
        );
      }

      // 5. 削除後、個人チャットでメンバー0人ならchats削除
      if (!chat.is_group) {
        const { data: remainingMembers, error: membersError } = await supabase
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', chat.id);

        if (membersError) {
          console.error(`メンバー確認エラー (chat ${chat.id}):`, membersError);
          continue;
        }

        if ((remainingMembers ?? []).length === 0) {
          const { error: deleteChatError } = await supabase
            .from('chats')
            .delete()
            .eq('id', chat.id);

          if (deleteChatError) {
            console.error(`チャット削除エラー (chat ${chat.id}):`, deleteChatError);
          } else {
            console.log(`空の個人チャット削除完了: ${chat.id}`);
          }
        }
      }
    }
  }

  return { error: null };
}
