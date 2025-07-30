import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useSession, useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link';

export default function Home() {
    const session = useSession()
    const user = useUser()
    const router = useRouter()

    const [chats, setChats] = useState<any[]>([])
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        if (session === null || user === null || !session || !user) {
            router.push('/auth')
            return
        }

        const loadChats = async () => {
            const userId = user.id

            // 1. 自分が属しているチャット一覧を取得
            const { data: myMemberships, error } = await supabase
            .from('chat_members')
            .select('chat_id')
            .eq('user_id', user.id)

            const chatIds = myMemberships?.map(m => m.chat_id) ?? []

            // 2. そのチャットに属するすべてのメンバー情報を取得（JOIN込み）
            const { data: members, error: membersError } = await supabase
            .from('chat_members')
            .select(`
                chat_id,
                user_id,
                chats ( id, name ),
                users (
                id,
                email,
                user_profiles (
                    nickname
                )
                )
            `)
            .in('chat_id', chatIds)

            if (membersError) {
                console.error('チャットメンバー取得失敗:', membersError.message)
            } else {
                const groupedChats: Record<string, any[]> = {}
                for (const row of members ?? []) {
                    if (!groupedChats[row.chat_id]) groupedChats[row.chat_id] = []
                    groupedChats[row.chat_id].push(row)
                }

                const displayChats = Object.entries(groupedChats).map(([chatId, members]) => {
                    const chatName = members[0].chats?.name

                    const others = members.filter(m => m.user_id !== user.id)

                    const nickname = others.length === 1
                    ? others[0]?.users?.user_profiles?.nickname
                        || others[0]?.users?.email
                        || '（Partner）'
                    : others.map(m =>
                        m.users?.user_profiles?.nickname
                        || m.users?.email
                        || '？'
                        ).join(', ')

                    return {
                    chat_id: chatId,
                    name: chatName ?? nickname ?? '（Anonymous）',
                    }
                })

                setChats(displayChats)
            }
        }

        const loadUnreadCounts = async () => {
            const { data, error } = await supabase.rpc('get_unread_counts', { user_uuid: user.id })

            if (error) {
                console.error('Failed to retrieve unread items:', error.message)
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
        .subscribe()

        loadAndWatch()
        loadChats()
        loadUnreadCounts()

        // return () => clearInterval(interval);
        return () => {
            supabase.removeChannel(channel);
        };
    }, [session, user])

    if (session === null) {
        return <p>Redirecting...</p>
    }

    return (
        <div className="max-w-md mx-auto pt-24 space-y-6">
            <header className="text-center">
                <h1 className="text-2xl font-bold text-gray-800">📬 Connect with friends</h1>
            </header>

            <ul className="space-y-3 px-4">
                {chats.map((c) => (
                    <li key={c.chat_id}>
                    <button
                        onClick={() => router.push(`/chat/${c.chat_id}`)}
                        className="w-full bg-white rounded-2xl shadow-md hover:shadow-lg transition flex items-center justify-between px-5 py-4"
                    >
                        <span className="text-base font-semibold text-gray-900 truncate">
                            {c.name}
                        </span>
                        {unreadCounts[c.chat_id] > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {unreadCounts[c.chat_id]}
                            </span>
                        )}
                    </button>
                    </li>
                ))}
            </ul>

            <div className="space-y-3 pt-6 flex flex-col items-center">
                <button
                className="w-5/6 bg-blue-600 text-white py-2 px-4 rounded-xl font-semibold hover:bg-blue-700 transition"
                onClick={() => router.push('/new-chat')}
                >
                    ➕ Create chat
                </button>
                <Link
                href="/friends"
                className="block text-center w-5/6 border border-gray-300 py-2 px-4 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                >
                    👥 Friend
                </Link>
            </div>
        </div>
    )
}
