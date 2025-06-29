import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useRef } from 'react'
import { useUser } from '@supabase/auth-helpers-react'

export default function ChatRoom() {
    const router = useRouter()
    //  const chatId = router.query.chatId as string
    const chatIdRaw = router.query.id // URLパラメータ名が [id].tsx なので `id` です！
    const chatId = Array.isArray(chatIdRaw) ? chatIdRaw[0] : chatIdRaw

    const [messages, setMessages] = useState<any[]>([])
    const [input, setInput] = useState('')
    const [members, setMembers] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])

    const messagesEndRef = useRef<HTMLDivElement>(null)

    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const currentUserIdRef = useRef<string | null>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // メンバー取得
    const fetchMembers = async () => {
        const { data, error } = await supabase
            .from('chat_members')
            .select('user_id, users(email)')
            .eq('chat_id', chatId)

        if (error) {
            console.error('メンバー取得失敗:', error)
        } else {
            setMembers(data || [])
        }
    }

    // 全ユーザー取得
    const fetchUsers = async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, email')

        if (error) {
            console.error('ユーザー一覧取得失敗:', error)
        } else {
            setAllUsers(data || [])
        }
    }

    // 既読登録用関数（渡されたメッセージIDの配列を既読登録）
    const markMessagesAsRead = async (messageIds: string[], userId: string) => {
        if (messageIds.length === 0) return

        const inserts = messageIds.map((messageId) => ({
            message_id: messageId,
            user_id: userId,
        }))

        // 重複があるとinsert失敗するので upsert を使う
        const { error } = await supabase
            .from('message_reads')
            .upsert(inserts, {
                onConflict: 'message_id,user_id', // ← string に修正
            })

        if (error) {
            console.error('既読登録失敗:', error)
        }
    }

    // メッセージ一覧取得＋リアルタイム購読
    useEffect(() => {
        if (!chatId) return

        if (currentUserId !== null) {
            currentUserIdRef.current = currentUserId
        }

        // 既存メッセージ取得
        const fetchMessagesAndMarkRead = async () => {
            const { data: userResponse } = await supabase.auth.getUser()
            const user = userResponse?.user
            if (!user) return

            supabase.auth.getUser().then(({ data }) => {
                setCurrentUserId(data?.user?.id ?? null)
            })

            const { data, error } = await supabase
            .from('messages')
                .select(`
                    id,
                    content,
                    user_id,
                    created_at,
                    users ( email )
                `)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

            if (error) {
                console.error(error)
            } else {
                setMessages(data || [])

                // 表示したメッセージのIDだけ既読登録
                // const messageIds = messages?.map((m) => m.id) || []
                const messageIds = (data || []).map((m) => m.id)
                await markMessagesAsRead(messageIds, user.id)
            }
        }
        fetchMessagesAndMarkRead()
        //  fetchMessages()
        fetchMembers()
        fetchUsers()
        // scrollToBottom()

        // リアルタイム購読セットアップ
        const channel = supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${chatId}`,
                },
                async (payload) => {
                    const newMessage = payload.new

                    // user_id から email を取得
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('email')
                        .eq('id', newMessage.user_id)
                        .single()

                    if (userError) {
                        console.error('ユーザー情報取得失敗:', userError.message)
                    }

                    setMessages((current) => {
                        const updated = [
                            ...current,
                            {
                            ...newMessage,
                            users: userData ? { email: userData.email } : undefined,
                            },
                        ]

                        // 自分の投稿ならスクロール
                        if (newMessage.user_id === currentUserId) {
                            setTimeout(() => scrollToBottom(), 100)
                        }

                          // ✅ 最新の userId を参照して比較
                        if (newMessage.user_id === currentUserIdRef.current) {
                            setTimeout(() => scrollToBottom(), 100)
                        }
                        return updated
                    })
                    // setMessages((current) => {
                    //     const updated = [...current, payload.new]
                    //     // ✅ 自分の投稿ならスクロール
                    //     if (payload.new.user_id === currentUserId) {
                    //         setTimeout(() => scrollToBottom(), 100)
                    //     }
                    //     return updated
                    // })
                }
            )
            .subscribe()

        // 購読解除
        return () => {
            supabase.removeChannel(channel)
        }
    }, [chatId, currentUserId])

  // メッセージ送信
  const sendMessage = async () => {
    if (!input.trim()) return

    const userResponse = await supabase.auth.getUser()
    const user = userResponse.data?.user
    if (!user) return

console.log('送信データ:', {
  chat_id: chatId,
  user_id: user?.id,
  content: input,
})

    const { error } = await supabase
      .from('messages')
      .insert([{ chat_id: chatId, user_id: user.id, content: input }])
    if (error) {
      alert('メッセージ送信に失敗しました')
    } else {
      setInput('')
    }
  }

return (
  <div>
    <button
      onClick={() => router.push('/')}
      className="p-2 mb-4 bg-gray-200 rounded hover:bg-gray-300"
    >
      ← チャット一覧に戻る
    </button>
    <h1>チャットルーム {chatId}</h1>

    {/* ここに参加メンバー一覧 */}
    <div>
      <h2>参加メンバー</h2>
      <ul>
        {members.map((m) => (
          <li key={m.user_id}>{m.users?.email}</li>
        ))}
      </ul>
    </div>

    {/* ここに招待できるユーザー一覧 */}
    <div>
      <h2>招待できるユーザー</h2>
      <ul>
        {allUsers
          .filter((u) => !members.find((m) => m.user_id === u.id))
          .map((user) => (
            <li key={user.id}>
              {user.email}
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from('chat_members')
                    .insert([{ chat_id: chatId, user_id: user.id }])
                  if (!error) {
                    setMembers((prev) => [
                      ...prev,
                      { user_id: user.id, users: { email: user.email } },
                    ])
                  }
                }}
              >
                招待
              </button>
            </li>
          ))}
      </ul>
    </div>

    {/* 既存のメッセージ一覧 */}
    <div style={{ height: '300px', overflowY: 'scroll' }}>
      {messages.map((msg) => (
        <div key={msg.id}>
          <b>{msg.users?.email ?? msg.user_id}</b>: {msg.content}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>

    {/* メッセージ入力 */}
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="メッセージを入力"
    />
    <button onClick={sendMessage}>送信</button>
  </div>
)
}
