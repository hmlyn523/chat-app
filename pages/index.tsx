import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession, useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
    const session = useSession()
    const user = useUser()
    const router = useRouter()

    const [chats, setChats] = useState<any[]>([])
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        if (!session || !user) {
            router.push('/auth')
            return
        }

        const loadChats = async () => {
            const userId = user.id

            const { data, error } = await supabase
            .from('chat_members')
            .select('chat_id, chats (id, name)')
            .eq('user_id', user.id)

            if (error) {
                console.error('チャットの取得に失敗:', error.message)
            } else {
                setChats(data ?? [])
            }
        }

        const loadUnreadCounts = async () => {
            const { data, error } = await supabase.rpc('get_unread_counts', { user_uuid: user.id })

            if (error) {
                console.error('未読件数取得失敗:', error.message)
            } else {
                // dataは {chat_id: string, unread_count: number} の配列
                const counts: Record<string, number> = {};
                (data ?? []).forEach((item: any) => {
                    counts[item.chat_id] = item.unread_count
                })
                setUnreadCounts(counts)
            }
        }

        const loadAndWatch = async () => {
            await loadChats()

            const handleRouteChange = (url: string) => {
                if (url === '/') {
                    loadChats()
                }
            }

            router.events.on('routeChangeComplete', handleRouteChange)
            return () => {
                router.events.off('routeChangeComplete', handleRouteChange)
            }
        }

        // const interval = setInterval(() => {
        //     loadUnreadCounts();
        // }, 5000); // 5秒ごとに更新
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
                // 自分以外のユーザーが送信したときだけ未読を更新
                if (payload.new.user_id !== user.id) {
                    await loadUnreadCounts();
                }
            }
        )
        .subscribe();

        loadAndWatch()
        loadChats()
        loadUnreadCounts()

        // return () => clearInterval(interval);
        return () => {
            supabase.removeChannel(channel);
        };
    }, [session, user])

    return (
    <div className="max-w-md mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">チャット一覧</h1>

        <ul className="space-y-2">
            {chats.map((c) => (
                <li key={c.chat_id}>
                    <button
                        onClick={() => router.push(`/chat/${c.chat_id}`)}
                        className="w-full text-left p-2 border rounded hover:bg-gray-100 flex justify-between items-center"
                    >
                        <span>{c.chats?.name ?? '（無名チャット）'}</span>
                        {unreadCounts[c.chat_id] > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {unreadCounts[c.chat_id]}
                            </span>
                        )}
                    </button>
                </li>
            ))}
        </ul>

        <div className="mt-6">
        <button
            className="btn btn-primary w-full"
            onClick={() => router.push('/new-chat')}
        >
            新しいチャットを作成
        </button>
        </div>
    </div>
    )
}
