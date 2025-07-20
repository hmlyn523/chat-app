import { supabase } from '../lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'


type UserProfile = {
  id: string
  nickname: string
}

type ChatMemberData = {
  user_profiles: {
    user_id: string
    nickname: string
  }
  chats: {
    name: string
  }
}


export default function Header() {
  const router = useRouter()
  const pathname = usePathname()

  const isChatRoom = typeof pathname === 'string' && pathname.startsWith('/chat/')
  const chatId = isChatRoom ? pathname.split('/chat/')[1] : null

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [chatName, setChatName] = useState<string | null>(null)
  const [members, setMembers] = useState<UserProfile[]>([])

  // 現在のユーザー取得
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser()
      setCurrentUserId(data?.user?.id ?? null)
    }
    fetchUser()
  }, [])

  // チャット情報とメンバー取得
  useEffect(() => {
    if (!chatId) return

    const fetchChatData = async () => {
      const { data, error } = await supabase
        .from('chat_members')
        .select(`
          user_profiles (
            user_id,
            nickname
          ),
          chats:chat_id (
            name
          )
        `)
        .eq('chat_id', chatId)

      if (error || !data) return

      const typedData = data as unknown as ChatMemberData[]

      const chatName = typedData[0]?.chats.name ?? ''
      const users = data.map((d: any) => d.user_profiles)

      setChatName(chatName)
      setMembers(users)
    }

    fetchChatData()
  }, [chatId])

  // 表示するタイトルを構築
  const displayTitle = (() => {
    if (!chatId || members.length === 0) return 'My Chat App'
    const otherMembers = members.filter((m) => m.id !== currentUserId)
    const isGroup = members.length > 2

    if (isGroup) {
      if (chatName && chatName.trim() !== '') {
        return `${chatName} (${members.length})`
      } else {
        const names = otherMembers.map((m) => m.nickname).join('、')
        return `${names} (${members.length})`
      }
    } else {
      return otherMembers[0]?.nickname ?? 'チャット'
    }
  })()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-10 p-4 bg-gray-100 flex justify-between shadow items-center">
      <div className="flex items-center gap-2">
        {isChatRoom && (
          <button onClick={() => router.push('/')} className="text-blue-500 text-lg font-bold">
            &lt;
          </button>
        )}
        <h1 className="font-bold text-lg truncate">{displayTitle}</h1>
      </div>

      <button
        onClick={handleLogout}
        className="text-sm text-blue-500"
      >
        ログアウト
      </button>
    </header>
  )
}