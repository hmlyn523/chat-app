import { useEffect, useState, useCallback, useMemo } from 'react';
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
import Footer from 'components/Footer'; // パスを適宜調整

// Chat型を拡張（lastMessageとupdatedAtを追加）
interface ExtendedChat extends Chat {
  lastMessage?: string;
  updatedAt?: string;
}

export default function Home() {
  const session = useSession();
  const user = useUser();
  const router = useRouter();

  const [chats, setChats] = useState<ExtendedChat[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // フッターの高さを計算（横並びなので調整、固定値で近似）
  const footerHeight = 120; // py-4 (16px*2) + アイコン+テキスト高さ + border-t (1px) + 余裕

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

      // 表示用データに変換（基本情報のみ）
      const displayChats: ExtendedChat[] = Object.entries(groupedChats).map(([chatId, members]) => {
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
          lastMessage: undefined, // 後で設定
          updatedAt: undefined, // 後で設定
        };
      });

      // 最新メッセージを取得（各チャットごとに1つ） - limitを削除して全メッセージを取得（チャット数が多い場合、RPC推奨）
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select(
          `
          chat_id,
          content,
          created_at,
          user_id,
          users (
            id,
            user_profiles ( nickname )
          )
        `
        )
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });
      // limit(chatIds.length) を削除して全メッセージを取得

      if (msgError) {
        console.error('メッセージ取得失敗:', msgError);
      } else {
        // チャットIDごとに最新メッセージをマップ（重複を避ける）
        const latestMessages: Record<string, { content: string; created_at: string }> = {};
        messages?.forEach((msg) => {
          if (
            !latestMessages[msg.chat_id] ||
            new Date(msg.created_at) > new Date(latestMessages[msg.chat_id].created_at)
          ) {
            latestMessages[msg.chat_id] = {
              content: msg.content || 'メディア共有されました', // 空の場合のフォールバック
              created_at: msg.created_at,
            };
          }
        });

        // displayChatsに適用
        displayChats.forEach((chat) => {
          const latest = latestMessages[chat.chat_id];
          if (latest) {
            chat.lastMessage = latest.content;
            chat.updatedAt = latest.created_at;
          }
        });
      }

      // 名前ソートを削除（コンポーネント内で動的ソート）

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

  // ソートされたチャットリスト（未読優先 + 最新メッセージ降順）
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aUnread = unreadCounts[a.chat_id] || 0;
      const bUnread = unreadCounts[b.chat_id] || 0;

      // 未読があるものを優先（上位）
      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;

      // 未読がない場合、または両方未読の場合、updatedAtで降順（新しいもの上位）
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [chats, unreadCounts]);

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
    <div className="max-w-md mx-auto min-h-screen flex flex-col pt-24 bg-gray-50">
      {/* チャットリスト（スクロール可能、フッター高さ分のボトムパディング追加） */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 py-4 pb-[120px]">
        {' '}
        {/* pb-[120px] でフッター高さ分のスペース */}
        {/* 空の状態 */}
        {sortedChats.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">まだチャットがありません</p>
            <p className="text-gray-400 text-sm">新しいチャットを作成して会話を始めましょう！</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedChats.map((c) => {
              const lastMessage = c.lastMessage || 'まだメッセージがありません';
              const lastTime = c.updatedAt
                ? new Date(c.updatedAt).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              // イニシャルアイコン（名前が空の場合を避ける）
              const initial = c.name.charAt(0).toUpperCase() || 'U';

              return (
                <li key={c.chat_id} className="relative">
                  <button
                    onClick={() => router.push(`/chat/${c.chat_id}`)}
                    className="w-full bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center px-4 py-3 relative overflow-hidden"
                    aria-label={`チャット: ${c.name}`}
                  >
                    {/* アバター（イニシャルアイコン） */}
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <span className="text-xs font-semibold text-white">{initial}</span>
                    </div>

                    {/* 中央コンテンツ */}
                    <div className="flex-1 min-w-0 pr-8">
                      <span
                        className="block text-sm font-semibold text-gray-900 truncate"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                      <span className="block text-xs text-gray-500 truncate max-w-full">
                        {lastMessage}
                      </span>
                      {lastTime && (
                        <span className="block text-xs text-gray-400 mt-1">{lastTime}</span>
                      )}
                    </div>

                    {/* 未読バッジ（右上寄り） */}
                    {unreadCounts[c.chat_id] > 0 && (
                      <span className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] flex items-center justify-center">
                        {unreadCounts[c.chat_id]}
                      </span>
                    )}
                  </button>

                  {/* 将来的なスワイプ機能用（react-swipeableをインストールして使用） */}
                  {/* 
                  <div className="absolute inset-0 flex">
                    <div className="bg-green-500 w-20 flex items-center justify-center translate-x-full transition-transform">
                      既読
                    </div>
                    <div className="bg-red-500 w-20 flex items-center justify-center -translate-x-full transition-transform">
                      削除
                    </div>
                  </div>
                  */}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* フッターを共通コンポーネントに置き換え */}
      <Footer pathname={router.pathname} />
    </div>
  );
}
