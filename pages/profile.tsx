// pages/profile.tsx

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function Profile() {
    const [nickname, setNickname] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('users')
                .select('nickname')
                .eq('id', user.id)
                .single()

            if (!error && data) {
                setNickname(data.nickname || '')
            }
        }

        loadProfile()
    }, [])

    const handleSave = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // const { error } = await supabase
        //     .from('users')
        //     .update({ nickname })
        //     .eq('id', user.id)

        // if (error) {
        //     alert('更新失敗しました')
        // } else {
        //     alert('保存しました')
        // }

        await supabase
            .from('user_profiles')
            .upsert({
                user_id: user.id,
                nickname: nickname,
            }, {
                onConflict: 'user_id', // 既に存在する場合は上書き
            })


        setLoading(false)
    }

    return (
        <div className="p-4">
            <h1 className="text-xl mb-2">プロフィール</h1>
            <label className="block mb-2">ニックネーム:</label>
            <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="border px-2 py-1 mb-4 w-full max-w-sm"
            />
            <br />
            <button
                onClick={handleSave}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                disabled={loading}
            >
                保存
            </button>
        </div>
    )
}
