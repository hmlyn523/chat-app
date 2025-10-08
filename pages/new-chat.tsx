import { useEffect, useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { supabase } from 'lib/supabaseClient';
import { useRouter } from 'next/router';
import Footer from 'components/Footer'; // パスを適宜調整

export default function NewChat() {
  const [chatName, setChatName] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const user = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchApprovedFriends = async () => {
      if (!user) return;

      // フレンド申請のうち、承認済みのものだけ取得
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) {
        console.error('フレンド取得エラー', error);
        setIsLoading(false);
        return;
      }

      // 自分ではない方（相手ユーザーID）だけを抽出
      const friendIds = requests.map((r) =>
        r.sender_id === user.id ? r.receiver_id : r.sender_id
      );

      if (friendIds.length === 0) {
        setUsers([]); // 該当なし
        setIsLoading(false);
        return;
      }

      // 相手ユーザーの情報を users テーブルから取得
      const { data: friendUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, user_profiles(nickname)')
        .in('id', friendIds);

      if (usersError) {
        console.error('ユーザー情報取得エラー', usersError);
        setIsLoading(false);
        return;
      }

      setUsers(friendUsers ?? []);
      setIsLoading(false);
    };

    fetchApprovedFriends();
  }, [user]);

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const createChat = async () => {
    if (selectedUserIds.length === 0 || !user) {
      alert('少なくとも1人を選択してください。');
      return;
    }

    const isGroup = selectedUserIds.length > 1;
    const nameToSave = isGroup ? chatName : null;

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert([{ name: nameToSave, is_group: isGroup, created_by: user.id }])
      .select()
      .single();

    if (chatError || !chat) {
      alert('チャットの作成に失敗しました。');
      return;
    }

    const allMembers = [...selectedUserIds, user.id];
    const { error: memberError } = await supabase.from('chat_members').insert(
      allMembers.map((userId) => ({
        chat_id: chat.id,
        user_id: userId,
      }))
    );

    if (memberError) {
      alert('メンバーの追加に失敗しました。');
      return;
    }

    router.push(`/chat/${chat.id}`);
  };

  // セッションがnullの場合のローディング
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">リダイレクト中...</p>
      </div>
    );
  }

  // データロード中
  if (isLoading) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex flex-col pt-24 bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">読み込み中...</p>
          </div>
        </div>
        <Footer pathname={router.pathname} />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pt-24 bg-gray-50">
      {/* コンテンツ（スクロール可能、フッター高さ分のボトムパディング追加） */}
      <div className="flex-1 overflow-y-auto px-4 space-y-4 py-4 pb-[120px]">
        {/* グループ名入力（複数選択時のみ） */}
        {selectedUserIds.length > 1 && (
          <input
            placeholder="グループ名 (オプション)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
          />
        )}

        {/* メンバーリスト */}
        <div className="flex flex-col items-center">
          <p className="font-semibold mb-2 w-full text-left text-gray-900">メンバーを選択：</p>
          <ul className="space-y-2 w-full max-w-xs">
            {users.length === 0 ? (
              <li className="text-center text-gray-500 py-4">
                友達がまだいません。友達を追加しましょう！
              </li>
            ) : (
              users.map((u) => {
                const isChecked = selectedUserIds.includes(u.id);
                const nickname =
                  u.user_profiles?.nickname || u.email?.split('@')[0] || '不明なユーザー';
                return (
                  <li
                    key={u.id}
                    className={`flex items-center justify-between border border-gray-300 px-3 py-2 rounded-lg shadow-sm cursor-pointer transition-colors ${
                      isChecked ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => toggleUser(u.id)}
                  >
                    <span className="text-sm text-gray-900 flex-1">{nickname}</span>
                    {isChecked && <span className="text-blue-500 text-sm font-medium">✓</span>}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* 作成ボタン */}
        <div className="flex justify-center">
          <button
            onClick={createChat}
            disabled={selectedUserIds.length === 0}
            className="w-5/6 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {selectedUserIds.length === 0 ? 'メンバーを選択してください' : 'チャット作成'}
          </button>
        </div>
      </div>

      {/* フッター */}
      <Footer pathname={router.pathname} />
    </div>
  );
}
