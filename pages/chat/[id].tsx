import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useRef } from 'react'
import { useUser } from '@supabase/auth-helpers-react'

export default function ChatRoom() {
    const router = useRouter()

    // router.query.id: URLの chat/[id] に対応するチャットIDを取得

    // URLの /chat/[id]の 'id' を取得
    const chatIdRaw = router.query.id
    const chatId = Array.isArray(chatIdRaw) ? chatIdRaw[0] : chatIdRaw

    // useState: 状態を管理。チャット、入力、参加者などを保存

    const [messages, setMessages] = useState<any[]>([]) // チャットメッセージ一覧
    const [input, setInput] = useState('')              // 入力中のメッセージ
    const [members, setMembers] = useState<any[]>([])   // 参加メンバー一覧
    const [allUsers, setAllUsers] = useState<any[]>([]) // 全ユーザー（招待用）

    // useRef: DOM要素（スクロール位置）や変数（ユーザーID）の最新値の保持に使用

    const messagesEndRef = useRef<HTMLDivElement>(null) // スクロール位置の管理用

    const [currentUserId, setCurrentUserId] = useState<string | null>(null) // 自分のユーザーID
    const currentUserIdRef = useRef<string | null>(null) // 常に最新のユーザーIDを保持

    // メッセージ一覧の一番下までスクロール
    // const scrollToBottom = () => {
    //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    // }
    const safeScrollToBottom = (ref: React.RefObject<HTMLDivElement | null>, behavior: ScrollBehavior = 'auto') => {
        // Safari対策で2回ラフに遅延
        requestAnimationFrame(() => {
            setTimeout(() => {
            ref.current?.scrollIntoView({ behavior })
            }, 100)
        })
    }


    // チャットルームのメンバー一覧を取得
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

    // 全ユーザーを取得（未参加者を表示するため）
    const fetchUsers = async () => {
        const { data, error } = await supabase
            .from('users')
            .select('id, email')
        if (error) {
            console.error('ユーザー一覧取得失敗:', error)
        } else {
            // 招待できるユーザー一覧を表示するために使用
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
                onConflict: 'message_id,user_id',
            })

        if (error) {
            console.error('既読登録失敗:', error)
        }
    }

    // メッセージ一覧取得＋リアルタイム購読
    //   useEffect は、React のフックの一つで、コンポーネントのレンダリング後に副作用
    //   （データの取得、DOMの操作、タイマーなど）を実行するために使用される
    useEffect(() => {
        // チャットIDチェック
        //   URLから取得した chatId がまだ undefined のときは処理を止める
        //   これは Next.js の router.query が初期は undefined になることがあるため
        if (!chatId) return

        // 現在のユーザーIDの同期
        //   urrentUserId は React の状態管理なので非同期レンダリングでタイミングがズレる可能性がある
        //   そのため、常に最新の値を useRef で保持し、リアルタイム処理内でも使えるようにしている
        if (currentUserId !== null) {
            currentUserIdRef.current = currentUserId
        }

        // メッセージ一覧と既読処理
        const fetchMessagesAndMarkRead = async () => {
            // ここで現在のユーザー情報を取得しているが、setCurrentUserId が遅れて効くことがあるため、
            // 先に user.id を変数として使う。
            const { data: userResponse } = await supabase.auth.getUser()
            const user = userResponse?.user
            if (!user) return

            supabase.auth.getUser().then(({ data }) => {
                setCurrentUserId(data?.user?.id ?? null)
            })

            // メッセージ本体の取得と既読登録
            // messages テーブルから取得: 指定されたチャットIDのメッセージをすべて取得
            // users ( email ): ユーザーIDに紐づくメールアドレスも取得（JOIN）
            // markMessagesAsRead: 取得したメッセージを「既読」として登録
            const { data, error } = await supabase
            .from('messages')
                .select(`
                    id,
                    content,
                    user_id,
                    created_at,
                    users (
                        email,
                        user_profiles (
                            nickname
                        )
                    )
                `)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true })

            if (error) {
                console.error(error)
            } else {
                setMessages(data || [])

                // 描画が終わるまで待ってから瞬時に一番下へ
                // setTimeout(() => {
                //     scrollToBottom('auto')
                // }, 0)
                // 表示したメッセージのIDだけ既読登録
                const messageIds = (data || []).map((m) => m.id)
                // 取得したメッセージを「既読」として登録
                await markMessagesAsRead(messageIds, user.id)
            }
        }

        fetchMessagesAndMarkRead()
        //  fetchMessages()
        fetchMembers()
        fetchUsers()
        // scrollToBottom()

        // リアルタイム購読
        const channel = supabase
            // Supabaseの realtime 機能で messages テーブルに新しい行（INSERT）が
            // 追加されたときに発火する
            .channel('public:messages')
            // チャットIDでフィルターされているので、自分がいるルームのメッセージのみが対象
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

                    // emailを取得してスクロール制御
                    // user_id → email を再取得: メッセージには user_id しか入ってないので表示名にするために email を取得
                    // setMessages: 受信メッセージ一覧に新しいメッセージを追加
                    // scrollToBottom():	自分の投稿だったら下まで自動スクロールする
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select(`
                            email,
                            user_profiles ( nickname )
                        `)
                        .eq('id', newMessage.user_id)
                        .single()

                    if (userError) {
                        console.error('ユーザー情報取得失敗:', userError.message)
                    }

                    const nickname = (userData?.user_profiles as unknown as { nickname: string })?.nickname ?? null;

                    // setMessages: 受信メッセージ一覧に新しいメッセージを追加
                    setMessages((current) => {
                        const updated = [
                            ...current,
                            {
                                ...newMessage,
                                users: {
                                    email: userData?.email,
                                //},
                                    user_profiles: {
                                        nickname: nickname ?? null,
                                    },
                                },
                            }
                        ]

                        // 自分の投稿ならスクロール
                        if (newMessage.user_id === currentUserId ||
                            newMessage.user_id === currentUserIdRef.current) {
                            setTimeout(() => safeScrollToBottom(messagesEndRef, 'auto'), 100)
                        }

                        return updated
                    })

                    // scrollToBottom()
                    setTimeout(() => safeScrollToBottom(messagesEndRef, 'auto'), 100)
                }
            )
            .subscribe()

        // 購読解除
        // コンポーネントがアンマウントされた時（例：チャットを抜けたとき）に、リアルタイム購読を解除
        // これにより、メモリリークや不要なリアルタイム更新を防ぐ
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

            {/* メンバー追加UI */}
            <div className="mt-4">
                <h2 className="font-semibold mb-2">メンバーを追加</h2>
                <ul className="space-y-2">
                    {allUsers
                    .filter((u) => !members.find((m) => m.user_id === u.id)) // 未参加者だけ
                    .map((user) => (
                        <li key={user.id} className="flex justify-between items-center">
                        <span>{user.email}</span>
                        <button
                            className="bg-blue-500 text-white text-xs px-2 py-1 rounded"
                            onClick={async () => {
                            const { error } = await supabase
                                .from('chat_members')
                                .insert([{ chat_id: chatId, user_id: user.id }])
                            if (!error) {
                                // UI反映＋is_groupをtrueに
                                setMembers((prev) => [
                                ...prev,
                                { user_id: user.id, users: { email: user.email } },
                                ])
                                await supabase
                                .from('chats')
                                .update({ is_group: true })
                                .eq('id', chatId)
                            }
                            }}
                        >
                            追加
                        </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* チャット一覧に戻るボタン */}
            <button
            onClick={() => router.push('/')}
            className="p-2 mb-4 bg-gray-200 rounded hover:bg-gray-300"
            >
            ← チャット一覧に戻る
            </button>

            {/* 参加メンバー一覧 */}
            <div>
                <h2>参加メンバー</h2>
                <ul>
                    {members.map((m) => (
                        <li key={m.user_id}>
                            {/* メールアドレスを表示（なければUUID） */}
                            {m.users?.email}
                        </li>
                    ))}
                </ul>
            </div>

            {/* 招待可能なユーザー一覧（まだ参加していない人） */}
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
                            // UIにも反映させる
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

            {/* メッセージ一覧表示 */}
<div className="h-[300px] overflow-y-scroll bg-gray-100 p-4 space-y-2">
  {messages.map((msg) => {
    const isMine = msg.user_id === currentUserId
    const name = msg.users?.user_profiles?.nickname ?? msg.users?.email ?? msg.user_id

    return (
      <div
        key={msg.id}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
      >
        <div className="max-w-[75%]">
          {!isMine && (
            <div className="text-xs text-gray-600 mb-1 ml-2">{name}</div>
          )}
          <div
            className={`
              px-4 py-2 text-sm break-words
              ${isMine
                ? 'bg-blue-500 text-white rounded-xl rounded-br-none'
                : 'bg-white text-gray-800 rounded-xl rounded-bl-none shadow'}
            `}
          >
            {msg.content}
          </div>
        </div>
      </div>
    )
  })}
  <div ref={messagesEndRef} />
</div>

<div className="fixed bottom-0 left-0 right-0 p-2 bg-white border-t">
  <div className="flex items-center gap-2">
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="メッセージを入力"
      className="flex-1 border rounded-full px-4 py-2 focus:outline-none"
    />
    <button
      onClick={sendMessage}
      className="bg-blue-500 text-white rounded-full px-4 py-2 hover:bg-blue-600"
    >
      送信
    </button>
  </div>
</div>


        </div>
    )
}
