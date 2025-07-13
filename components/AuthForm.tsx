import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      // サインアップ直後は確認メールが送られる。確認後にプロフィールを作成する必要があるが、
      // 今回は仮に自動で user_profiles にも追加しておく。
      const user = data?.user
      if (user) {
        const { error: profileError } = await supabase.from('user_profiles').insert([
          { user_id: user.id, nickname }
        ])
        if (profileError) {
          console.error('ニックネーム登録エラー:', profileError.message)
        }
      }

      alert('サインアップ確認メールを送信しました')
    }
  }

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  return (
    <div className="max-w-sm mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">
        {isSignUp ? 'サインアップ（新規登録）' : 'ログイン'}
      </h2>

      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="メールアドレス"
        className="w-full border p-2 mb-2 rounded"
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="パスワード"
        className="w-full border p-2 mb-2 rounded"
      />

      {/* サインアップのときだけニックネーム入力欄を表示 */}
      {isSignUp && (
        <input
          type="text"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="ニックネーム"
          className="w-full border p-2 mb-4 rounded"
        />
      )}

      {isSignUp ? (
        <button
          onClick={handleSignUp}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          サインアップ
        </button>
      ) : (
        <button
          onClick={handleSignIn}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          ログイン
        </button>
      )}

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-4 text-sm text-gray-600 underline"
      >
        {isSignUp ? '→ 既にアカウントをお持ちの方はこちら' : '→ 新規登録はこちら'}
      </button>
    </div>
  )
}
