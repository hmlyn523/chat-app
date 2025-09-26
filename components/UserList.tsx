'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';
import { sendFriendRequest, unfriend } from 'lib/services/friendService';
import { RawUser, UserProfile, FriendRequest } from '@/types'; // ClientHeader.tsx と共通の型をインポート

interface UserListProps {
  currentUserId: string;
}

export default function UserList({ currentUserId }: UserListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<Record<string, FriendRequest['status']>>({});
  const [receivedRequests, setReceivedRequests] = useState<Record<string, FriendRequest['status']>>(
    {}
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // データ取得関数
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // ユーザー一覧取得
      const { data, error } = await supabase
        .from('users')
        .select('id, email, user_profiles!inner(user_id, nickname)')
        .neq('id', currentUserId);

      console.log(JSON.stringify(data, null, 2));

      if (error) throw new Error(error.message);

      // 型アサーション
      // unknown: Supabase の data 型が any[] | null なので unknown 経由で RawUser[] | null に変換
      const usersData = data as unknown as RawUser[] | null;

      if (!usersData) {
        setUsers([]);
        return;
      }

      const mappedUsers: UserProfile[] = usersData.map((u) => {
        return {
          user_id: u.id,
          nickname: u.user_profiles?.nickname ?? `User1(${u.id.slice(0, 6)})`,
        };
      });

      setUsers(mappedUsers);

      // フレンドリクエスト取得
      const { data: requestsData, error: requestsError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (requestsError) throw new Error(requestsError.message);

      const sentMap: Record<string, FriendRequest['status']> = {};
      const receivedMap: Record<string, FriendRequest['status']> = {};

      requestsData?.forEach((req: FriendRequest) => {
        if (req.sender_id === currentUserId) {
          sentMap[req.receiver_id] = req.status;
        } else if (req.receiver_id === currentUserId) {
          receivedMap[req.sender_id] = req.status;
        }
      });

      setSentRequests(sentMap);
      setReceivedRequests(receivedMap);
    } catch (err: any) {
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchData();

    // リアルタイムサブスクリプション
    const subscription = supabase
      .channel('friend_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${currentUserId},receiver_id=eq.${currentUserId}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchData, currentUserId]);

  // フレンドリクエスト送信
  const handleRequest = useCallback(
    async (userId: string) => {
      try {
        setIsLoading(true);
        const { error } = await sendFriendRequest(currentUserId, userId);
        if (error) throw new Error(error.message);
        alert('友だち申請を送りました');
        setSentRequests((prev) => ({ ...prev, [userId]: 'pending' }));
      } catch (err: any) {
        alert(err.message || '友だち申請に失敗しました');
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId]
  );

  // フレンド解除
  const handleRemoveFriend = useCallback(
    async (friendId: string) => {
      if (!confirm('本当にフレンドを外しますか？')) return;

      try {
        setIsLoading(true);
        const { error } = await unfriend(currentUserId, friendId);
        if (error) throw new Error(error.message);

        setSentRequests((prev) => {
          const copy = { ...prev };
          delete copy[friendId];
          return copy;
        });
        setReceivedRequests((prev) => {
          const copy = { ...prev };
          delete copy[friendId];
          return copy;
        });

        alert('フレンドを外しました');
      } catch (err: any) {
        alert(err.message || 'フレンド解除に失敗しました');
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId]
  );

  return (
    <div className="container mx-auto p-4">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-sm text-gray-500">読み込み中...</span>
        </div>
      )}
      {error && <div className="text-center py-4 text-red-500">{error}</div>}
      <ul className="space-y-2 max-w-md mx-auto">
        {users.map((user) => {
          const sentStatus = sentRequests[user.user_id];
          const receivedStatus = receivedRequests[user.user_id];
          const isFriend = sentStatus === 'accepted' || receivedStatus === 'accepted';

          return (
            <li
              key={user.user_id}
              className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-colors ${
                isFriend
                  ? 'border-l-4 border-green-500'
                  : sentStatus === 'pending' || receivedStatus === 'pending'
                    ? 'border-l-4 border-yellow-500'
                    : 'border-l-4 border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-blue-600">
                    {user.nickname.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 truncate">{user.nickname}</span>
              </div>
              <div className="flex items-center space-x-2">
                {sentStatus === 'pending' && <span className="text-xs text-gray-500">申請中</span>}
                {receivedStatus === 'pending' && (
                  <span className="text-xs text-blue-600">承認待ち</span>
                )}
                {isFriend && <span className="text-xs text-green-600">フレンド</span>}
                {sentStatus === 'rejected' && (
                  <button
                    onClick={() => handleRequest(user.user_id)}
                    disabled={isLoading}
                    className="text-xs bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`ユーザー ${user.nickname} に再申請`}
                  >
                    再申請
                  </button>
                )}
                {!sentStatus && !receivedStatus && (
                  <button
                    onClick={() => handleRequest(user.user_id)}
                    disabled={isLoading}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`ユーザー ${user.nickname} に申請`}
                  >
                    申請
                  </button>
                )}
                {isFriend && (
                  <button
                    onClick={() => handleRemoveFriend(user.user_id)}
                    disabled={isLoading}
                    className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`ユーザー ${user.nickname} をフレンド解除`}
                  >
                    友達解除
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
