import { useEffect, useState } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function NewChat() {
  const [chatName, setChatName] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const user = useUser()
  const router = useRouter()

  useEffect(() => {
    const fetchApprovedFriends = async () => {
      if (!user) return

      // フレンド申請のうち、承認済みのものだけ取得
      const { data: requests, error } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted')

      if (error) {
        console.error('フレンド取得エラー', error)
        return
      }

      // 自分ではない方（相手ユーザーID）だけを抽出
      const friendIds = requests.map((r) =>
        r.sender_id === user.id ? r.receiver_id : r.sender_id
      )

      if (friendIds.length === 0) {
        setUsers([]) // 該当なし
        return
      }

      // 相手ユーザーの情報を users テーブルから取得
      const { data: friendUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, user_profiles(nickname)')
        .in('id', friendIds)

      if (usersError) {
        console.error('ユーザー情報取得エラー', usersError)
        return
      }

      setUsers(friendUsers ?? [])
    }

    fetchApprovedFriends()
  }, [user])

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    )
  }

  const createChat = async () => {
    if (selectedUserIds.length === 0 || !user) {
      alert('1人以上選択してください')
      return
    }

    const isGroup = selectedUserIds.length > 1
    const nameToSave = isGroup ? chatName : null

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert([{ name: nameToSave, is_group: isGroup, created_by: user.id }])
      .select()
      .single()

    if (chatError || !chat) {
      alert('チャット作成に失敗しました')
      return
    }

    const allMembers = [...selectedUserIds, user.id]
    const { error: memberError } = await supabase.from('chat_members').insert(
      allMembers.map((userId) => ({
        chat_id: chat.id,
        user_id: userId,
      }))
    )

    if (memberError) {
      alert('メンバー追加に失敗しました')
      return
    }

    router.push(`/chat/${chat.id}`)
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-24 pb-10">
      <h1 className="text-2xl font-bold text-center mb-6">新しいチャット作成</h1>

      {selectedUserIds.length > 1 && (
        <input
          placeholder="グループ名（任意）"
          className="w-full mb-4 px-3 py-2 border rounded shadow-sm"
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
        />
      )}

      <div className="mb-6">
        <p className="font-semibold mb-2">メンバーを選択：</p>
        <ul className="space-y-2">
          {users.map((u) => {
            const isChecked = selectedUserIds.includes(u.id)
            const nickname = u.user_profiles?.nickname || u.email
            return (
              <li
                key={u.id}
                className={`flex items-center justify-between border px-3 py-2 rounded shadow-sm ${
                  isChecked ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <label className="flex items-center w-full cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleUser(u.id)}
                    className="mr-3"
                  />
                  <span className="text-sm">{nickname}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <button
        onClick={createChat}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
      >
        作成する
      </button>
    </div>
  )
}
