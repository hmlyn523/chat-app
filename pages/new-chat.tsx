import { useEffect, useState } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function NewGroupChat() {
  const [chatName, setChatName] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const user = useUser()
  const router = useRouter()

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase.from('users').select('id, email')
      if (data) {
        // 自分を除く
        setUsers(data.filter((u) => u.id !== user?.id))
      }
    }
    fetchUsers()
  }, [user])

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    )
  }

  const createGroup = async () => {
    if (!chatName || selectedUserIds.length === 0 || !user) return

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert([{ name: chatName, is_group: true, created_by: user.id }])
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
      <h1 className="text-xl mb-2">グループチャット作成</h1>
      <input
        placeholder="グループ名"
        className="input w-full mb-4"
        value={chatName}
        onChange={(e) => setChatName(e.target.value)}
      />

      <div className="mb-4">
        <p className="mb-2">メンバーを選択：</p>
        {users.map((u) => (
          <label key={u.id} className="block">
            <input
              type="checkbox"
              checked={selectedUserIds.includes(u.id)}
              onChange={() => toggleUser(u.id)}
            />{' '}
            {u.email}
          </label>
        ))}
      </div>

      <button onClick={createGroup} className="btn btn-primary w-full">
        作成する
      </button>
    </div>
  )
}
