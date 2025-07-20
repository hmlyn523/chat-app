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
                        || '（相手）'
                    : others.map(m =>
                        m.users?.user_profiles?.nickname
                        || m.users?.email
                        || '？'
                        ).join(', ')

                    return {
                    chat_id: chatId,
                    name: chatName ?? nickname ?? '（無名）',
                    }
                })

                setChats(displayChats)
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
        .subscribe()

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
                        <span>{c.name}</span>
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
