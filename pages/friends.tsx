import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from 'lib/supabaseClient';
import Link from 'next/link';
import UserList from 'components/UserList';
import Footer from 'components/Footer'; // パスを適宜調整

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
    <div className="max-w-md mx-auto min-h-screen flex flex-col pt-16 bg-white">
      {/* コンテンツ（スクロール可能、フッター高さ分のボトムパディング追加） */}
      <div className="flex-1 overflow-y-auto px-4 space-y-8 py-4 pb-20">
        {/* <FriendRequestList currentUserId={currentUserId} /> */}
        <UserList currentUserId={currentUserId} />
      </div>

      {/* フッターを共通コンポーネントに置き換え */}
      <Footer pathname={router.pathname} />
    </div>
  );
}
