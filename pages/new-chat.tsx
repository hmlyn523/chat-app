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
    // const fetchUsers = async () => {
    //   const { data } = await supabase.from('users').select('id, email')
    //   if (data) {
    //     // 自分以外を表示
    //     setUsers(data.filter((u) => u.id !== user?.id))
    //   }
    // }
    // fetchUsers()
    const fetchApprovedFriends = async () => {
      if (!user) return

      const { data, error } = await supabase
        .from('friends')
        .select(`
          user_id,
          friend_id,
          status,
          users:friend_id ( id, email )
        `)
        .eq('user_id', user.id)
        .eq('status', 'approved')

      if (error) {
        console.error('フレンド取得エラー', error)
        return
      }

      // フレンド情報が users にネストされてる
      const approvedFriends = data
        .map((f) => f.users?.[0]) // { id, email }
        .filter((u) => u?.id) // 念のためnull除外

      setUsers(approvedFriends)
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
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-2">新しいチャット作成</h1>

      {selectedUserIds.length > 1 && (
        <input
          placeholder="グループ名（任意）"
          className="input w-full mb-4"
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
        />
      )}

      <div className="mb-4">
        <p className="mb-2">メンバーを選択：</p>
        {users.map((u) => (
          <label key={u.id} className="block mb-1">
            <input
              type="checkbox"
              checked={selectedUserIds.includes(u.id)}
              onChange={() => toggleUser(u.id)}
              className="mr-2"
            />
            {u.email}
          </label>
        ))}
      </div>

      <button onClick={createChat} className="btn btn-primary w-full">
        作成する
      </button>
    </div>
  )
}
