// components/ChatHeader.tsx
import { supabase } from '../lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { removeUserFromChat, addFriendToChat } from '../lib/api/chats';

type UserProfile = {
  user_id: string;
  nickname: string;
};

type ChatMemberData = {
  user_profiles: {
    user_id: string;
    nickname: string;
  };
  chats: {
    name: string;
  };
};

export default function ChatHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isChatRoom = typeof pathname === 'string' && pathname.startsWith('/chat/');
  const chatId = isChatRoom ? pathname.split('/chat/')[1] : null;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chatName, setChatName] = useState<string | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isProfileOpen, setProfileOpen] = useState(false);

  const [isAddFriendOpen, setAddFriendOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);

  // 現在のユーザー取得
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data?.user?.id ?? null);
    };
    fetchUser();
  }, []);

  // チャット情報とメンバー取得
  useEffect(() => {
    if (!chatId) return;

    const fetchChatData = async () => {
      const { data, error } = await supabase
        .from('chat_members')
        .select(
          `
          user_profiles (
            user_id,
            nickname
          ),
          chats:chat_id (
            name
          )
        `
        )
        .eq('chat_id', chatId);

      if (error || !data) return;

      const typedData = data as unknown as ChatMemberData[];

      const chatName = typedData[0]?.chats.name ?? '';
      const users = data.map((d: any) => d.user_profiles).flat();
      setChatName(chatName);
      setMembers(users);
    };

    fetchChatData();
  }, [chatId]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUserId) return;

      // 自分が承認済みフレンドのリクエストを取得
      const { data, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .eq('status', 'accepted');

      if (error || !data) return;

      // 自分のフレンドIDだけ抽出
      const friendIds = data
        .map((d: any) => (d.sender_id === currentUserId ? d.receiver_id : d.sender_id))
        .filter((id: string) => id !== currentUserId);

      if (friendIds.length === 0) return;

      // フレンドのプロフィールを取得
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, nickname')
        .in('user_id', friendIds);

      if (!profiles) return;

      // すでにチャットにいるメンバーを除外
      const friends: UserProfile[] = (profiles as UserProfile[]).filter(
        (f) => !members.some((m) => m.user_id === f.user_id)
      );

      setFriendsList(friends);
    };

    fetchFriends();
  }, [currentUserId, members]);

  // 表示するタイトルを構築
  const displayTitle = (() => {
    if (!chatId || members.length === 0) return '';
    const otherMembers = members.filter((m) => m.user_id !== currentUserId);
    const isGroup = members.length > 2;

    if (isGroup) {
      return chatName?.trim()
        ? `${chatName} (${members.length})`
        : `${otherMembers.map((m) => m.nickname).join('、')} (${members.length})`;
    } else {
      return otherMembers[0]?.nickname ?? 'Chat';
    }
  })();

  const handleLeaveGroup = async () => {
    if (!confirm('本当にこのグループから脱退しますか？')) return;
    if (!currentUserId) return;

    await removeUserFromChat(chatId!, currentUserId);
    alert('グループを脱退しました');
    router.push('/'); // ホームに戻す
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!chatId) return;
    if (!confirm('このメンバーをチャットから削除しますか？')) return;

    await removeUserFromChat(chatId, memberId);

    // メンバー一覧を更新
    setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
    alert('メンバーを削除しました');
  };

  const handleAddFriend = async (friendId: string) => {
    if (!chatId || !currentUserId) return;

    const { error } = await addFriendToChat(currentUserId, chatId, friendId);

    if (error) {
      alert('追加に失敗しました: ' + error);
      return;
    }

    setMembers((prev) => [...prev, friendsList.find((f) => f.user_id === friendId)!]);
    alert('フレンドを追加しました');
  };

  return (
    <>
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-20 p-4 bg-gray-200 flex justify-between items-center shadow">
        {/* 左側の戻るボタン */}
        {isChatRoom && (
          <button onClick={() => router.push('/')} className="text-xl mr-2 font-bold">
            ←
          </button>
        )}

        {/* タイトル */}
        <h1 className="text-2xl font-bold leading-none align-middle">{displayTitle}</h1>

        {/* 右側のプロフィール開閉ボタン */}
        {isChatRoom && (
          <button onClick={() => setProfileOpen(!isProfileOpen)} className="text-xl font-bold ml-2">
            {isProfileOpen ? 'v' : 'i'}
          </button>
        )}

        {/* プロフィールオーバーレイ */}
        {isProfileOpen && (
          <div className="absolute top-full right-4 w-72 bg-white shadow-xl rounded-lg p-4 z-30 max-h-[60vh] overflow-y-auto">
            {/* フレンド追加ボタン */}
            <div className="mb-2">
              <button
                onClick={() => setAddFriendOpen(true)}
                className="w-full bg-blue-500 text-white py-2 rounded"
              >
                フレンドを追加
              </button>
            </div>

            {/* メンバー一覧 */}
            <h2 className="text-lg font-semibold mb-2">メンバー一覧</h2>
            <ul className="space-y-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 p-2 bg-gray-100 rounded"
                >
                  <span>{m.nickname}</span>
                  {m.user_id !== currentUserId && (
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      className="text-xs text-red-500"
                    >
                      削除
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* グループ脱退ボタン */}
            <div className="mt-4">
              <button
                onClick={handleLeaveGroup}
                className="w-full bg-red-500 text-white py-2 rounded"
              >
                グループから脱退
              </button>
            </div>
          </div>
        )}
      </header>

      {/* フレンド追加モーダル */}
      {isAddFriendOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-80 max-h-[70vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-2">フレンドを追加</h2>
            <ul className="space-y-2">
              {friendsList.map((friend) => (
                <li
                  key={friend.user_id}
                  className="flex justify-between items-center p-2 bg-gray-100 rounded"
                >
                  <span>{friend.nickname}</span>
                  <button
                    onClick={() => handleAddFriend(friend.user_id)}
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    追加
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setAddFriendOpen(false)}
              className="mt-4 w-full bg-gray-300 text-black py-2 rounded"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
