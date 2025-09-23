import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSession, useUser } from '@supabase/auth-helpers-react';
import { supabase } from 'lib/supabaseClient';
import Link from 'next/link';
import { UnreadCount, isUnreadCountArray } from 'types/unreadCount';
import {
  Chat,
  RawChatMemberForHome, // ✅ Home用型を使用
  UserProfile,
} from '@/types';

export default function Home() {
  const session = useSession();
  const user = useUser();
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // チャットデータを取得する関数
  const loadChats = useCallback(async (userId: string) => {
    try {
      // 自分が属しているチャット一覧を取得
      const { data: myMemberships, error: membershipError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', userId);

      if (membershipError) {
        console.error('チャットメンバー取得失敗:', membershipError);
        return;
      }

      const chatIds = myMemberships?.map((m) => m.chat_id) ?? [];
      if (chatIds.length === 0) {
        setChats([]);
        return;
      }

      // メンバー情報を一度に取得
      const { data: members, error: membersError } = await supabase
        .from('chat_members')
        .select(
          `
            chat_id,
            user_id,
            chats ( id, name ),
            users (
              id,
              email,
              user_profiles ( nickname )
            )
          `
        )
        .in('chat_id', chatIds);

      if (membersError) {
        console.error('メンバー情報取得失敗:', membersError);
        return;
      }

      // unknownを経由して型アサーション
      const rawMembers = (members ?? []) as unknown as RawChatMemberForHome[];

      // チャットごとにグループ化
      const groupedChats: Record<string, RawChatMemberForHome[]> = {};
      rawMembers.forEach((row) => {
        if (!groupedChats[row.chat_id]) {
          groupedChats[row.chat_id] = [];
        }
        groupedChats[row.chat_id].push(row);
      });

      // 表示用データに変換
      const displayChats: Chat[] = Object.entries(groupedChats).map(([chatId, members]) => {
        // chatsはオブジェクトとしてアクセス
        const chatName = members[0]?.chats?.name;

        // 他のメンバーの情報を取得（自分以外）
        const others = members.filter((m) => m.user_id !== userId);

        // ニックネームを取得（実際のデータ構造に基づく）
        const nickname = others
          .map((m) => {
            const user = m.users;
            if (!user) return null;

            // ニックネームの取得順序（優先度順）
            return (
              user.user_profiles?.nickname || // user_profilesから
              // user.nickname || // usersテーブルに直接nicknameがある場合
              user.email?.split('@')[0] || // メールアドレスのローカル部分
              `User(${user.id.slice(0, 6)})` // 最終フォールバック
            );
          })
          .filter(Boolean) // null/undefinedを除外
          .join(', ');

        return {
          chat_id: chatId,
          name: chatName || nickname || '（Group Chat）',
        };
      });

      // 名前でソート（オプション）
      displayChats.sort((a, b) => a.name.localeCompare(b.name));

      setChats(displayChats);
    } catch (error) {
      console.error('チャット取得エラー:', error);
    }
  }, []);

  // 未読数をロード
  const loadUnreadCounts = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_unread_counts', {
        user_uuid: userId,
      });

      if (error) {
        console.error('未読数取得失敗:', error);
        return;
      }

      // 型推論が効くようにキャスト
      const unreadCountsData: UnreadCount[] = isUnreadCountArray(data) ? data : [];

      const counts: Record<string, number> = {};
      unreadCountsData.forEach((item) => {
        counts[item.chat_id] = item.unread_count;
      });

      setUnreadCounts(counts);
    } catch (error) {
      console.error('未読数取得エラー:', error);
    }
  }, []);

  // ルート変更時のリロード
  const handleRouteChange = useCallback(
    (url: string) => {
      if (url === '/' && user?.id) {
        loadChats(user.id);
        loadUnreadCounts(user.id);
      }
    },
    [loadChats, loadUnreadCounts, user?.id]
  );

  useEffect(() => {
    if (!session || !user) {
      router.push('/auth');
      return;
    }

    const userId = user.id;
    setIsLoading(true);

    // 初回ロード
    const initializeData = async () => {
      await Promise.all([loadChats(userId), loadUnreadCounts(userId)]);
      setIsLoading(false);
    };

    initializeData();

    // ルート変更イベントの設定
    router.events.on('routeChangeComplete', handleRouteChange);

    // 定期更新（5分ごと）
    const interval = setInterval(() => {
      loadUnreadCounts(userId);
      // チャットリストは重いので30分ごとに更新
      if (Math.random() < 0.1) {
        // 10%の確率で更新（約30分に1回）
        loadChats(userId);
      }
    }, 300000); // 5分 = 300000ms

    // リアルタイム未読数更新
    const channel = supabase
      .channel('unread-counts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          if (payload.new.user_id !== userId) {
            await loadUnreadCounts(userId);
          }
        }
      )
      .subscribe();

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [session, user, router.events, loadChats, loadUnreadCounts, handleRouteChange]);

  // セッションがnullの場合のローディング
  if (session === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">リダイレクト中...</p>
      </div>
    );
  }

  // 認証中またはデータロード中
  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pt-24 space-y-6">
      {/* 空の状態 */}
      {chats.length === 0 ? (
        <div className="text-center">
          <p className="text-gray-500 mb-4">まだチャットがありません</p>
        </div>
      ) : (
        <ul className="space-y-3 px-4">
          {chats.map((c) => (
            <li key={c.chat_id}>
              <button
                onClick={() => router.push(`/chat/${c.chat_id}`)}
                className="w-full bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-between px-5 py-4"
                aria-label={`チャット: ${c.name}`}
              >
                <span
                  className="text-base font-semibold text-gray-900 truncate max-w-[80%]"
                  title={c.name}
                >
                  {c.name}
                </span>
                {unreadCounts[c.chat_id] > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                    {unreadCounts[c.chat_id]}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* アクションボタン */}
      <div className="space-y-3 pt-6 flex flex-col items-center">
        <button
          className="w-5/6 bg-blue-500 text-white py-2 px-4 rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => router.push('/new-chat')}
          disabled={isLoading}
        >
          ➕ チャット作成
        </button>
        <Link
          href="/friends"
          className="block text-center w-5/6 border border-gray-300 py-2 px-4 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
        >
          👥 友達
        </Link>
      </div>
    </div>
  );
}
