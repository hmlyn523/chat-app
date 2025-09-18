import { supabase } from 'lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useUser } from '@supabase/auth-helpers-react';

export default function ListHeader() {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isOverlayOpen, setOverlayOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
    setOverlayOpen(false);
  };

  const handleBack = () => {
    router.back();
  };

  const showBackButton = pathname !== '/';

  const goToProfile = () => {
    router.push('/profile');
    setOverlayOpen(false);
  };

  const getPageTitle = () => {
    if (pathname === '/friends') return '友達一覧';
    if (pathname === '/profile') return 'プロフィール';
    if (pathname === '/new-chat') return 'チャット作成';
    if (pathname === '/friends/add') return '友達追加';
    return '24Chat';
  };

  // 退会ボタン押したとき
  const handleDeleteAccount = async () => {
    // 1. 現在ログインしているユーザーを取得
    if (!user) return;

    // 2. API経由でSupabaseのユーザー削除を呼ぶ
    await fetch('/api/delete-user', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id }),
      headers: { 'Content-Type': 'application/json' },
    });

    // 3. localStorageをクリア
    localStorage.clear();

    // 4. サインアウト
    await supabase.auth.signOut();

    // 5. オーバーレイを閉じる
    setOverlayOpen(false);

    // 6. リダイレクト
    router.push('/auth');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-10 p-4 bg-gray-100 flex justify-between items-center shadow">
        <div className="flex items-center gap-2">
          <button
            onClick={showBackButton ? handleBack : undefined}
            className={`text-2xl font-bold mr-2 ${
              showBackButton ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {showBackButton ? '←' : ''}
          </button>
          <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
        </div>

        {/* 右側のプロフィール開閉ボタン */}
        <button onClick={() => setOverlayOpen(!isOverlayOpen)} className="text-xl font-bold ml-2">
          {isOverlayOpen ? '≡' : '≡'}
        </button>

        {/* オーバーレイ */}
        {isOverlayOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/10"
            onClick={() => setOverlayOpen(false)} // 背景クリックで閉じる
          >
            <div
              className="space-y-2 fixed top-16 right-4 w-72 bg-white shadow-xl rounded-lg p-4 max-h-[60vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()} // 内部クリックで閉じない
            >
              <button
                onClick={goToProfile}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
              >
                プロフィール
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
              >
                ログアウト
              </button>
              <button
                onClick={handleDeleteAccount}
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
              >
                退会
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
