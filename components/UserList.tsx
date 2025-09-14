import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { sendFriendRequest } from '../lib/services/friendService';
import { removeFriend } from '../lib/api/friend_requests';
import { unfriend } from '../lib/services/friendService'; // unfriend をインポート

export default function UserList({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<Record<string, string>>({});
  const [receivedRequests, setReceivedRequests] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      // ユーザー一覧取得
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, user_profiles(nickname)');

      const filteredUsers = usersData?.filter((u) => u.id !== currentUserId) || [];
      setUsers(filteredUsers);

      // 自分が関係している全 friend_requests を取得（sender または receiver）
      const { data: requestsData } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (requestsData) {
        const sentMap: Record<string, string> = {};
        const receivedMap: Record<string, string> = {};

        requestsData.forEach((req) => {
          if (req.sender_id === currentUserId) {
            // 自分が送った申請
            sentMap[req.receiver_id] = req.status;
          } else if (req.receiver_id === currentUserId) {
            // 自分が受け取った申請
            receivedMap[req.sender_id] = req.status;
          }
        });

        setSentRequests(sentMap);
        setReceivedRequests(receivedMap);
      }
    };

    fetchData();
  }, [currentUserId]);

  const handleRequest = async (userId: string) => {
    const { error } = await sendFriendRequest(currentUserId, userId);
    if (!error) {
      alert('友だち申請を送りました');
      setSentRequests((prev) => ({ ...prev, [userId]: 'pending' }));
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('本当にフレンドを外しますか？')) return;

    const { error } = await unfriend(currentUserId, friendId);
    if (error) {
      alert('フレンド解除に失敗しました');
      return;
    }

    // ローカル state 更新
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
  };

  return (
    <div>
      <ul className="space-y-2">
        {users.map((u) => {
          const sentStatus = sentRequests[u.id]; // 自分が送った申請状況
          const receivedStatus = receivedRequests[u.id]; // 自分が受け取った申請状況
          const name = u.user_profiles?.nickname || u.email;
          const isFriend = sentStatus === 'accepted' || receivedStatus === 'accepted';

          return (
            <li
              key={u.id}
              className={`flex items-center justify-between border p-3 rounded shadow-sm max-w-xs mx-auto
              ${isFriend ? 'bg-gray-100' : sentStatus === 'pending' || receivedStatus === 'pending' ? 'bg-yellow-50' : 'bg-white'}`}
            >
              <span className="text-sm truncate">{name}</span>

              {/* 状態表示 */}
              {sentStatus === 'pending' && (
                <span className="text-xs text-gray-500 ml-2">Pending</span>
              )}
              {receivedStatus === 'pending' && (
                <span className="text-xs text-blue-600 ml-2">Pending approval</span>
              )}
              {isFriend && <span className="text-xs text-gray-600 ml-2">Friend</span>}
              {sentStatus === 'rejected' && (
                <button
                  className="text-xs bg-gray-500 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRequest(u.id)}
                >
                  Reapplication
                </button>
              )}
              {!sentStatus && !receivedStatus && (
                <button
                  className="text-xs bg-gray-500 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRequest(u.id)}
                >
                  Application
                </button>
              )}

              {/* 追加: フレンド解除ボタン */}
              {isFriend && (
                <button
                  className="text-xs bg-gray-400 text-white px-3 py-1 rounded ml-2"
                  onClick={() => handleRemoveFriend(u.id)}
                >
                  Unfriend
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
