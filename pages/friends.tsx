import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from 'lib/supabaseClient';
import Link from 'next/link';
import UserList from 'components/UserList';
import FriendRequestList from 'components/FriendRequestList';

export default function FriendsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, []);

  if (!currentUserId)
    return (
      <div className="text-2xl font-bold text-center mb-4">
        <p>ログイン情報を取得中...</p>
      </div>
    );

  const isFriendsActive = router.pathname === '/friends';

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col pt-24 bg-gray-50">
      {/* コンテンツ（スクロール可能、フッター高さ分のボトムパディング追加） */}
      <div className="flex-1 overflow-y-auto px-4 space-y-8 py-4 pb-[120px]">
        <FriendRequestList currentUserId={currentUserId} />
        <UserList currentUserId={currentUserId} />
      </div>

      {/* 固定アクションボタン（画面下部に横並びアイコン、position fixed） */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 px-4 py-0 flex flex-row justify-around items-center space-x-4 z-10">
        <button
          className="flex flex-col items-center justify-center text-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 py-2"
          onClick={() => router.push('/new-chat')}
          aria-label="チャット作成"
        >
          <span className="text-2xl mb-1">💬</span>
          <span className="text-xs">New Chat</span>
        </button>
        <Link
          href="/friends"
          className={`flex flex-col items-center justify-center transition-colors flex-1 py-2 ${
            isFriendsActive ? 'text-blue-500' : 'text-gray-700 hover:text-gray-900'
          }`}
          aria-label="友達"
        >
          <span className="text-2xl mb-1">👥</span>
          <span className="text-xs">friends</span>
        </Link>
      </div>
    </div>
  );
}
