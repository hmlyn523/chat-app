import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import UserList from '../components/UserList';
import FriendRequestList from '../components/FriendRequestList';

export default function FriendsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  return (
    <div className="max-w-md mx-auto px-4 pt-24 space-y-8">
      <UserList currentUserId={currentUserId} />
      <FriendRequestList currentUserId={currentUserId} />
    </div>
  );
}
