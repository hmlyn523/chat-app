import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useRef } from 'react'
import dayjs from 'dayjs'
import weekday from 'dayjs/plugin/weekday'
import localeData from 'dayjs/plugin/localeData'
import 'dayjs/locale/ja'

dayjs.extend(weekday)
dayjs.extend(localeData)
dayjs.locale('ja')

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

    // 初回のみフラグ
    const didInitialScrollRef = useRef(false)

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
            .select('user_id, users(email, user_profiles(nickname))')
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

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !chatId) return

        const { data: userResponse } = await supabase.auth.getUser()
        const user = userResponse.user
        if (!user) return

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${user.id}.${fileExt}`
        const filePath = `${chatId}/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, file)

        if (uploadError) {
            alert('画像のアップロードに失敗しました')
            return
        }

        const { data: urlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath)

        const imageUrl = urlData?.publicUrl
        if (!imageUrl) return

        const { error: insertError } = await supabase
            .from('messages')
            .insert([{ chat_id: chatId, user_id: user.id, image_url: imageUrl }])

        if (insertError) {
            alert('画像付きメッセージの送信に失敗しました')
        } else {
            didInitialScrollRef.current = false
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

        if (messages.length > 0 && !didInitialScrollRef.current) {
            setTimeout(() => {
                safeScrollToBottom(messagesEndRef, 'auto')
                didInitialScrollRef.current = true
            }, 100)
        }
  
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
                    image_url,
                    users (
                        email,
                        user_profiles (
                            nickname
                        )
                    ),
                    message_reads (
                        user_id
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
        fetchMembers()
        fetchUsers()

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
    }, [chatId, messages])

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
            didInitialScrollRef.current = false
        }
    }

    const unjoinedUsers = allUsers.filter(
        (u) => !members.find((m) => m.user_id === u.id)
    )
    // const myFriends = allUsers.filter(
    //     (u) => acceptedFriendIds.includes(u.id)
    // )

    return (
        <div className="pt-16 pb-20 h-screen flex flex-col overflow-hidden ">

            {/* 上部：メンバー追加など */}
            <div className="p-2 space-y-4 overflow-y-auto">

                {/* メンバー追加UI */}
                {unjoinedUsers.length > 0 && (
                    <div>
                        <h2 className="font-semibold mb-2">メンバー追加</h2>
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
                )}
            </div>

            {/* メッセージ一覧：スクロール対象 */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                {messages.map((msg, index) => {
                    const isMine = msg.user_id === currentUserId
                    const name = msg.users?.user_profiles?.nickname ?? msg.users?.email ?? msg.user_id
                    const timeText = dayjs(msg.created_at).format('HH:mm')

                    const readByUserIds = msg.message_reads?.map((r: any) => r.user_id) || []
                    const otherMembers = members.filter((m) => m.user_id !== currentUserId)
                    const readCount = readByUserIds.filter((id: any) =>
                        otherMembers.some((m) => m.user_id === id)
                    ).length
                    const totalOtherMembers = otherMembers.length

                        const currentDate = dayjs(msg.created_at).format('YYYY-MM-DD')

                        const prev = index > 0 ? messages[index - 1] : null
                        const prevDate = prev ? dayjs(prev.created_at).format('YYYY-MM-DD') : null
                        const showDate = currentDate !== prevDate
                        const showTime =
                            !prev || dayjs(msg.created_at).format('YYYY-MM-DD HH:mm') !== dayjs(prev.created_at).format('YYYY-MM-DD HH:mm')

                    return (
                        <div key={msg.id}>
                            {/* ✅ 日付が変わったら中央に年月日（曜日）を表示 */}
                            {showDate && (
                                <div className="text-center text-xs text-gray-500 my-4">
                                    {dayjs(msg.created_at).format('YYYY年M月D日（ddd）')}
                                </div>
                            )}                        
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
                                            : 'bg-gray-200 text-gray-800 rounded-xl rounded-bl-none shadow'}
                                        `}
                                    >
                                        {/* テキストがある場合は表示 */}
                                        {msg.content && <p>{msg.content}</p>}

                                        {/* 画像がある場合は表示 */}
                                        {msg.image_url && (
                                            <img
                                                src={msg.image_url}
                                                alt="uploaded"
                                                className="mt-2 rounded max-w-full h-auto max-h-40"
                                            />
                                        )}
                                    </div>
                                    
                                    {/* 追加: 時間表示 */}
                                    <div
                                    className={`text-[10px] mt-1 ${
                                        isMine ? 'text-right text-gray-500' : 'text-left text-gray-500 ml-2'
                                    }`}
                                    >
                                        {timeText}
                                    </div>

                                    {/* 👇 既読表示を追加（自分の投稿のみ） */}
                                    {isMine && (
                                    <div className="text-xs text-right mt-1 text-gray-500">
                                        {readCount === totalOtherMembers
                                        ? '既読'
                                        : `既読 ${readCount} / ${totalOtherMembers}`}
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* 固定フッター(入力欄 + 送信ボタン) */}
            <div className="fixed bottom-0 left-0 right-0 p-2 bg-white border-t z-10">
                <div className="flex items-center gap-2">
                    {/* 画像選択ボタン */}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="image-upload"
                    />
                    <label htmlFor="image-upload" className="cursor-pointer px-2 text-blue-500">
                        📷
                    </label>
                    {/* 入力フォーム */}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="メッセージを入力"
                        className="flex-1 border rounded-full px-4 py-2 focus:outline-none"
                        />
                    {/* 送信ボタン */}
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
