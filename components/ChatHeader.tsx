// components/ChatHeader.tsx
import { supabase } from '../lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { removeUserFromChat } from '../lib/friendService';

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

  return (
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
          <h2 className="text-lg font-semibold mb-2">メンバー一覧</h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                <span>{m.nickname}</span>
                {m.user_id === currentUserId && (
                  <span className="text-xs text-gray-500">(あなた)</span>
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
  );
}
