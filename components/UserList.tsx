'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from 'lib/supabaseClient';
import {
  sendFriendRequest,
  unfriend,
  acceptFriendRequest,
  rejectFriendRequest,
} from 'lib/services/friendService';
import { RawUser, UserProfile, FriendRequest, FriendRequestStatus } from '@/types'; // FriendRequestStatus追加

interface UserListProps {
  currentUserId: string;
}

export default function UserList({ currentUserId }: UserListProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<Record<string, FriendRequestStatus>>({}); // FriendRequest['status'] → FriendRequestStatus
  const [receivedRequests, setReceivedRequests] = useState<Record<string, FriendRequestStatus>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});

  // fetchData（変更なし）
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: userError } = await supabase
        .from('users')
        .select('id, email, user_profiles!inner(user_id, nickname)')
        .neq('id', currentUserId);

      if (userError) throw new Error(userError.message);

      const usersData = data as unknown as RawUser[] | null;

      if (!usersData) {
        setUsers([]);
        return;
      }

      const mappedUsers: UserProfile[] = usersData.map((u) => ({
        user_id: u.id,
        nickname: u.user_profiles?.nickname ?? `User1(${u.id.slice(0, 6)})`,
      }));

      setUsers(mappedUsers);

      const { data: requestsData, error: requestsError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id, status')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (requestsError) throw new Error(requestsError.message);

      const sentMap: Record<string, FriendRequestStatus> = {};
      const receivedMap: Record<string, FriendRequestStatus> = {};

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

    const senderSubscription = supabase
      .channel('sent_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${currentUserId}`,
        },
        (payload) => {
          if (payload.new) {
            const newReq = payload.new as FriendRequest;
            if (newReq.sender_id === currentUserId) {
              setSentRequests((prev) => ({ ...prev, [newReq.receiver_id]: newReq.status }));
            }
          }
          if (payload.old) {
            const oldReq = payload.old as FriendRequest;
            if (oldReq.sender_id === currentUserId) {
              setSentRequests((prev) => {
                const copy = { ...prev };
                delete copy[oldReq.receiver_id];
                return copy;
              });
            }
          }
        }
      )
      .subscribe();

    const receiverSubscription = supabase
      .channel('received_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          if (payload.new) {
            const newReq = payload.new as FriendRequest;
            if (newReq.receiver_id === currentUserId) {
              setReceivedRequests((prev) => ({ ...prev, [newReq.sender_id]: newReq.status }));
            }
          }
          if (payload.old) {
            const oldReq = payload.old as FriendRequest;
            if (oldReq.receiver_id === currentUserId) {
              setReceivedRequests((prev) => {
                const copy = { ...prev };
                delete copy[oldReq.sender_id];
                return copy;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(senderSubscription);
      supabase.removeChannel(receiverSubscription);
    };
  }, [currentUserId]);

  // handleRequest（変更なし）
  const handleRequest = useCallback(
    async (userId: string) => {
      const actionKey = `request_${userId}`;
      setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
      try {
        const { error } = await sendFriendRequest(currentUserId, userId);
        if (error) throw new Error(error.message);
        alert('友だち申請を送りました'); // TODO: toast.success
        setSentRequests((prev) => ({ ...prev, [userId]: 'pending' }));
      } catch (err: any) {
        alert(err.message || '友だち申請に失敗しました');
      } finally {
        setPendingActions((prev) => {
          const copy = { ...prev };
          delete copy[actionKey];
          return copy;
        });
      }
    },
    [currentUserId]
  );

  // handleAcceptRequest: requestId削除（不要）
  const handleAcceptRequest = useCallback(
    async (senderId: string) => {
      const actionKey = `accept_${senderId}`;
      setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
      try {
        const { error } = await acceptFriendRequest(currentUserId, senderId);
        if (error) throw new Error(error.message);
        alert('友だち申請を承認しました');
        setReceivedRequests((prev) => ({ ...prev, [senderId]: 'accepted' }));
      } catch (err: any) {
        alert(err.message || '承認に失敗しました');
      } finally {
        setPendingActions((prev) => {
          const copy = { ...prev };
          delete copy[actionKey];
          return copy;
        });
      }
    },
    [currentUserId]
  );

  // handleRejectRequest: requestId削除（不要）
  const handleRejectRequest = useCallback(
    async (senderId: string) => {
      const actionKey = `reject_${senderId}`;
      setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
      try {
        const { error } = await rejectFriendRequest(currentUserId, senderId);
        if (error) throw new Error(error.message);
        alert('友だち申請を拒否しました');
        setReceivedRequests((prev) => {
          const copy = { ...prev };
          delete copy[senderId];
          return copy;
        });
      } catch (err: any) {
        alert(err.message || '拒否に失敗しました');
      } finally {
        setPendingActions((prev) => {
          const copy = { ...prev };
          delete copy[actionKey];
          return copy;
        });
      }
    },
    [currentUserId]
  );

  // handleRemoveFriend（変更なし）
  const handleRemoveFriend = useCallback(
    async (friendId: string) => {
      if (!confirm('本当にフレンドを外しますか？')) return; // TODO: モーダル
      const actionKey = `remove_${friendId}`;
      setPendingActions((prev) => ({ ...prev, [actionKey]: true }));
      try {
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
        setPendingActions((prev) => {
          const copy = { ...prev };
          delete copy[actionKey];
          return copy;
        });
      }
    },
    [currentUserId]
  );

  // getRequestIdForUserとrequestId変数: 削除（不要）

  const isActionPending = (actionKey: string) => pendingActions[actionKey] || isLoading; // 個別優先だが、グローバルも考慮

  return (
    <div className="container mx-auto p-4">
      {isLoading && !Object.keys(pendingActions).length && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
          <span className="text-sm text-gray-500">読み込み中...</span>
        </div>
      )}
      {error && <div className="text-center py-4 text-red-500">{error}</div>}
      {users.length === 0 && !isLoading && (
        <div className="text-center py-4 text-gray-500">ユーザーが見つかりません</div>
      )}
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
                  <div className="flex space-x-1">
                    <span className="text-xs text-blue-600">承認待ち</span>
                    <button
                      onClick={() => handleAcceptRequest(user.user_id)} // requestId削除
                      disabled={isActionPending(`accept_${user.user_id}`)}
                      className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label={`ユーザー ${user.nickname} の申請を承認`}
                    >
                      承認
                    </button>
                    <button
                      onClick={() => handleRejectRequest(user.user_id)} // requestId削除
                      disabled={isActionPending(`reject_${user.user_id}`)}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label={`ユーザー ${user.nickname} の申請を拒否`}
                    >
                      拒否
                    </button>
                  </div>
                )}
                {isFriend && <span className="text-xs text-green-600">フレンド</span>}
                {sentStatus === 'rejected' && (
                  <button
                    onClick={() => handleRequest(user.user_id)}
                    disabled={isActionPending(`request_${user.user_id}`)}
                    className="text-xs bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`ユーザー ${user.nickname} に再申請`}
                  >
                    再申
                  </button>
                )}
                {!sentStatus && !receivedStatus && (
                  <button
                    onClick={() => handleRequest(user.user_id)}
                    disabled={isActionPending(`request_${user.user_id}`)}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`ユーザー ${user.nickname} に申請`}
                  >
                    申請
                  </button>
                )}
                {isFriend && (
                  <button
                    onClick={() => handleRemoveFriend(user.user_id)}
                    disabled={isActionPending(`remove_${user.user_id}`)}
                    className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`ユーザー ${user.nickname} をフレンド解除`}
                  >
                    解除
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
