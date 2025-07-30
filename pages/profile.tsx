// pages/profile.tsx

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function Profile() {
    const [nickname, setNickname] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('user_profiles')
                .select('nickname')
                .eq('user_id', user.id)
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

        const { error } = await supabase
            .from('user_profiles')
            .upsert({
                user_id: user.id,
                nickname: nickname,
            }, {
                onConflict: 'user_id', // 既に存在する場合は上書き
            })

        setLoading(false)

        if (!error) {
            setMessage('Saved.') // ✅ 通知をセット
            setTimeout(() => setMessage(''), 3000) // 3秒で非表示
        } else {
            setMessage('Failed to save.')
            setTimeout(() => setMessage(''), 3000)
        }
    }

    return (
        <div className="mt-20 p-4">
            <div className="text-center">
                <h1 className="text-xl font-bold mb-4">Edit Profile</h1>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
                <div>
                <label className="font-semibold mb-2 w-full text-left">Nickname:</label>
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
                />
                </div>

                <button
                    onClick={handleSave}
                    disabled={loading}
                    className={`w-full text-white px-4 py-2 rounded ${
                        loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>

                {/* ✅ メッセージ表示 */}
                {message && (
                    <div className="text-center text-sm text-green-600 mt-2">
                        {message}
                    </div>
                )}
            </div>
        </div>
    )
}
