// components/ChatHeader.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'lib/supabaseClient';
import { removeUserFromChat, addFriendToChat } from 'lib/api/chats';
import {
  UserProfile,
  RawChatMemberForHeader, // ✅ Header用型を使用
  Chat,
} from '@/types';

// interface RawChatMember {
//   user_id: string;
//   users: {
//     id: string;
//     user_profiles: {
//       user_id: string;
//       nickname: string | null;
//     } | null;
//   } | null;
//   chats: {
//     id: string;
//     name: string | null;
//   } | null;
// }

interface FriendRequest {
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export default function ChatHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  // チャットIDの抽出
  const isChatRoom = useMemo(
    () => typeof pathname === 'string' && pathname.startsWith('/chat/'),
    [pathname]
  );
  const chatId = useMemo(
    () => (isChatRoom ? pathname.split('/chat/')[1]?.replace(/\/$/, '') : null),
    [isChatRoom, pathname]
  );

  // 状態管理
  const [chatName, setChatName] = useState<string>('');
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 現在のユーザーID
  const currentUserId = session?.user?.id || null;

  // チャット情報とメンバーを取得（修正版）
  const fetchChatData = useCallback(
    async (chatId: string) => {
      if (!chatId || !currentUserId) {
        console.log('fetchChatData: Missing parameters', { chatId, currentUserId });
        return;
      }

      try {
        setIsLoading(true);
        console.log('🔍 Fetching chat data for chatId:', chatId);

        // ✅ 正しいJOINクエリ：chat_members → auth.users → user_profiles
        const { data, error } = await supabase
          .from('chat_members')
          .select(
            `
              user_id,
              users!inner (
                id,
                user_profiles!inner (
                  user_id,
                  nickname
                )
              ),
              chats!inner (
                id,
                name
              )
            `
          )
          .eq('chat_id', chatId);

        console.log(JSON.stringify(data, null, 2));

        console.log('📊 Raw data from Supabase:', {
          data,
          error,
          dataLength: data?.length,
        });

        if (error) {
          console.error('チャットデータ取得エラー:', error);
          return;
        }

        if (!data || data.length === 0) {
          console.log('⚠️ No data found for chatId:', chatId);
          return;
        }

        // 型アサーション
        const rawData = data as unknown as RawChatMemberForHeader[];

        rawData.forEach((d) => {
          const profile = d.users?.user_profiles; // これで { user_id, nickname } にアクセス可能

          const userProfile = profile
            ? {
                user_id: profile?.user_id,
                nickname: profile?.nickname ?? `User(${d.user_id.slice(0, 6)})`,
              }
            : {
                user_id: d.user_id,
                nickname: `User(${d.user_id.slice(0, 6)})`, // フォールバック
              };

          console.log(userProfile);
        });

        console.log('🔧 Processing rawData length:', rawData.length);

        // デバッグ：各データの構造を確認
        rawData.forEach((item, index) => {
          console.log(`📝 Raw data item ${index}:`, {
            user_id: item.user_id,
            users: item.users,
            user_profiles: item.users?.user_profiles,
            chats: item.chats,
          });
        });

        // チャット名を取得
        // const chatInfo = rawData.find((d) => d.user_id === currentUserId);
        const chatInfo = rawData[0]; // 先頭だけでOK（全員同じチャットなので）
        const chatNameValue = chatInfo?.chats?.name || '';
        setChatName(chatNameValue);
        console.log('📝 Set chatName:', chatNameValue);

        // メンバー一覧を作成
        const mappedProfiles = rawData.map((d) => {
          const profile = d.users?.user_profiles;
          if (!profile) {
            console.log(`⚠️ No profile found for user ${d.user_id}`);
            return {
              user_id: d.user_id,
              nickname: `User1(${d.user_id.slice(0, 6)})`, // フォールバック
            };
          }

          const result: UserProfile = {
            user_id: profile?.user_id || d.user_id,
            nickname: profile?.nickname || `User(${d.user_id.slice(0, 6)})`,
          };

          console.log(`✅ Mapped result for user ${d.user_id}:`, result);
          return result;
        });

        // 重複除去
        const uniqueMembers = mappedProfiles.filter(
          (profile, index, self) => index === self.findIndex((p) => p.user_id === profile.user_id)
        );
        console.log('👥 Final unique members:', uniqueMembers);

        setMembers(uniqueMembers);
        console.log('💾 Members state updated with length:', uniqueMembers.length);
      } catch (error) {
        console.error('チャットデータ取得エラー:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId, chatId]
  );

  // フレンドリストを取得
  const fetchFriends = useCallback(async () => {
    if (!currentUserId) return;

    try {
      console.log('🔍 Fetching friends for user:', currentUserId);

      // 承認済みのフレンドリクエストを取得
      const { data: friendRequests, error: requestError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      console.log('📊 Friend requests:', { friendRequests, requestError });

      if (requestError || !friendRequests || friendRequests.length === 0) {
        console.log('⚠️ No friend requests found');
        setFriendsList([]);
        return;
      }

      // フレンドIDを抽出
      const friendIds = friendRequests
        .map((req: FriendRequest) =>
          req.sender_id === currentUserId ? req.receiver_id : req.sender_id
        )
        .filter((id: string) => id !== currentUserId);

      console.log('👥 Extracted friend IDs:', friendIds);

      if (friendIds.length === 0) {
        setFriendsList([]);
        return;
      }

      // フレンドのプロフィールを取得
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, nickname')
        .in('user_id', friendIds);

      console.log('📊 Friend profiles:', { profiles, profileError });

      if (profileError || !profiles) {
        setFriendsList([]);
        return;
      }

      // 型安全な処理
      const typedProfiles = profiles as Array<{ user_id: string; nickname: string | null }>;

      const availableFriends: UserProfile[] = typedProfiles
        .map((profile) => ({
          user_id: profile.user_id,
          nickname: profile.nickname || `User(${profile.user_id.slice(0, 6)})`,
        }))
        .filter((friend) => !members.some((member) => member.user_id === friend.user_id));

      console.log('👥 Available friends:', availableFriends);
      setFriendsList(availableFriends);
    } catch (error) {
      console.error('フレンド取得エラー:', error);
    }
  }, [currentUserId, members]);

  // チャットデータ取得のuseEffect
  useEffect(() => {
    console.log('🔄 useEffect: chatId changed', { chatId, currentUserId });
    if (chatId && currentUserId) {
      fetchChatData(chatId);
    }
  }, [chatId, currentUserId, fetchChatData]);

  // フレンドリスト取得のuseEffect
  useEffect(() => {
    console.log('🔄 useEffect: profile opened', { isProfileOpen, membersLength: members.length });
    if (isProfileOpen && members.length > 0) {
      fetchFriends();
    }
  }, [isProfileOpen, members.length, fetchFriends]);

  // 表示タイトルを構築
  const displayTitle = useMemo(() => {
    if (!chatId || members.length === 0) return 'チャット';

    const otherMembers = members.filter((m) => m.user_id !== currentUserId);
    const isGroup = members.length > 2;

    if (isGroup) {
      return chatName.trim()
        ? `${chatName} (${members.length})`
        : `${otherMembers.map((m) => m.nickname).join('、')} (${members.length})`;
    }

    return otherMembers[0]?.nickname || 'チャット';
  }, [chatId, members, currentUserId, chatName]);

  // イベントハンドラー
  const handleLeaveGroup = useCallback(async () => {
    if (!chatId || !currentUserId) return;

    const confirmed = confirm('本当にこのグループから脱退しますか？');
    if (!confirmed) return;

    try {
      setIsLoading(true);
      await removeUserFromChat(chatId, currentUserId);
      router.push('/');
    } catch (error) {
      console.error('グループ脱退エラー:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, currentUserId, router]);

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!chatId) return;

      const confirmed = confirm('このメンバーをチャットから削除しますか？');
      if (!confirmed) return;

      try {
        setIsLoading(true);
        await removeUserFromChat(chatId, memberId);
        setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
      } catch (error) {
        console.error('メンバー削除エラー:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatId]
  );

  const handleAddFriend = useCallback(
    async (friendId: string) => {
      if (!chatId || !currentUserId) return;

      try {
        setIsLoading(true);
        const { error } = await addFriendToChat(currentUserId, chatId, friendId);

        if (error) {
          console.error('フレンド追加エラー:', error);
          return;
        }

        const friendProfile = friendsList.find((f) => f.user_id === friendId);
        if (friendProfile) {
          setMembers((prev) => [...prev, friendProfile]);
          setFriendsList((prev) => prev.filter((f) => f.user_id !== friendId));
        }

        setIsAddFriendOpen(false);
      } catch (error) {
        console.error('フレンド追加エラー:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, currentUserId, friendsList]
  );

  const toggleProfile = useCallback(() => {
    setIsProfileOpen((prev) => !prev);
  }, []);

  const closeModals = useCallback(() => {
    setIsProfileOpen(false);
    setIsAddFriendOpen(false);
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeModals();
      }
    },
    [closeModals]
  );

  // キーボードイベント
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModals();
      }
    };

    if (isProfileOpen || isAddFriendOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isProfileOpen, isAddFriendOpen, closeModals]);

  if (!isChatRoom) {
    return null;
  }

  console.log('🎨 Rendering ChatHeader:', {
    displayTitle,
    membersLength: members.length,
    isProfileOpen,
    isLoading,
    chatId,
    currentUserId,
  });

  return (
    <>
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-20 p-4 bg-gray-200 flex justify-between items-center shadow-md">
        <button
          onClick={() => router.push('/')}
          className="text-xl mr-2 font-bold text-gray-700 hover:text-gray-900 transition-colors"
          aria-label="チャット一覧に戻る"
        >
          ←
        </button>

        <h1
          className="text-xl font-bold leading-tight text-center flex-1 mx-4 truncate"
          title={displayTitle}
        >
          {displayTitle}
        </h1>

        <button
          onClick={toggleProfile}
          className="text-xl font-bold ml-2 text-gray-700 hover:text-gray-900 transition-colors"
          aria-label={isProfileOpen ? 'メニューを閉じる' : 'メニューを開く'}
          aria-expanded={isProfileOpen}
        >
          ≡
        </button>
      </header>

      {/* プロフィールオーバーレイ */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={handleBackdropClick}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="fixed top-20 right-4 w-80 bg-white shadow-2xl rounded-xl p-4 max-h-[70vh] overflow-y-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-lg font-semibold text-gray-800">チャット設定</h2>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 text-xl"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <button
                onClick={() => setIsAddFriendOpen(true)}
                disabled={isLoading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ➕ メンバーを追加
              </button>
            </div>

            <div className="mb-4">
              <h3 className="text-base font-semibold mb-2 text-gray-800">
                メンバー（{members.length}）
              </h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>メンバーが見つかりません</p>
                  <div className="text-xs mt-1 text-red-500">Debug: chatId={chatId}</div>
                </div>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {members.map((member) => (
                    <li
                      key={member.user_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">
                            {member.nickname.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {member.nickname}
                        </span>
                      </div>
                      {member.user_id !== currentUserId && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={isLoading}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                          aria-label={`ユーザー ${member.nickname} を削除`}
                        >
                          削除
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={handleLeaveGroup}
              disabled={isLoading}
              className="w-full bg-red-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🚪 グループを脱退
            </button>
          </div>
        </div>
      )}

      {/* フレンド追加モーダル */}
      {isAddFriendOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleBackdropClick}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">メンバーを追加</h2>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 text-xl"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                  <span className="text-gray-500">読み込み中...</span>
                </div>
              ) : friendsList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">追加できるフレンドがいません</p>
                  <button
                    onClick={() => {
                      setIsAddFriendOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    設定に戻る
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {friendsList.map((friend) => (
                    <li
                      key={friend.user_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-green-600">
                            {friend.nickname.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {friend.nickname}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAddFriend(friend.user_id)}
                        disabled={isLoading}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        追加
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={closeModals}
                disabled={isLoading}
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
