import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('サインアップ確認メールを送信しました')
  }

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  return (
    <div className="max-w-sm mx-auto p-4">
      <h2 className="text-2xl mb-4">ログイン／サインアップ</h2>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="input mb-2"/>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="input mb-4"/>
      <button onClick={handleSignIn} className="btn btn-primary w-full">ログイン</button>
      <button onClick={handleSignUp} className="btn btn-secondary w-full mt-2">サインアップ</button>
    </div>
  )
}
