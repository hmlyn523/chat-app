import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import router from 'next/router';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const [anonNickname, setAnonNickname] = useState('');
  const [anonEmail, setAnonEmail] = useState<string | null>(null);
  const [anonPassword, setAnonPassword] = useState<string | null>(null);

  // ✅ 初回マウント時に localStorage から読み込む
  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR対策

    const storedNickname = localStorage.getItem('anonNickname') || '';
    const storedEmail = localStorage.getItem('anonEmail');
    const storedPassword = localStorage.getItem('anonPassword');

    setAnonNickname(storedNickname);
    setAnonEmail(storedEmail);
    setAnonPassword(storedPassword);
  }, []);

  // ✅ anonNickname が変わったら localStorage に保存
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (anonNickname) {
      localStorage.setItem('anonNickname', anonNickname);
    }
  }, [anonNickname]);

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
      return;
    }

    const user = data?.user;
    if (user) {
      await supabase.from('user_profiles').insert([{ user_id: user.id, nickname }]);
      alert('登録確認メールを送信しました。');
    }
  };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  // ✅ 匿名ログイン
  const handleAnonymousLogin = async () => {
    let email = anonEmail;
    let password = anonPassword;

    if (!email || !password) {
      // 初回生成
      email = `anon_${uuidv4()}@example.com`;
      password = uuidv4();

      if (typeof window !== 'undefined') {
        localStorage.setItem('anonEmail', email);
        localStorage.setItem('anonPassword', password);
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert('匿名ログイン失敗: ' + error.message);
        return;
      }

      const user = data?.user;
      if (user) {
        const nicknameToUse = anonNickname || `匿名_${Math.floor(Math.random() * 1000)}`;
        await supabase
          .from('user_profiles')
          .insert([{ user_id: user.id, nickname: nicknameToUse }]);
        setAnonNickname(nicknameToUse); // 自動的に localStorage に保存される
        alert('匿名アカウントを作成してログインしました！');
      }
    } else {
      // 既存アカウントでログイン
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert('匿名ログイン失敗: ' + error.message);
        return;
      }
      alert('匿名ログインしました！');
    }
  };

  // 退会ボタン押したとき
  const handleDeleteAccount = async () => {
    // 1. 現在ログインしているユーザーを取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // 2. API経由でSupabaseのユーザー削除を呼ぶ
    await fetch('/api/delete-user', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id }),
      headers: { 'Content-Type': 'application/json' },
    });

    // 3. localStorageをクリア
    localStorage.clear();

    // 4. サインアウト
    await supabase.auth.signOut();

    // 5. リダイレクト
    router.push('/auth');
  };

  return (
    <div className="max-w-sm mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign up' : 'Login'}</h2>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Emailアドレス"
        className="w-full border p-2 mb-2 rounded"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        className="w-full border p-2 mb-2 rounded"
      />

      {isSignUp && (
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="ニックネーム"
          className="w-full border p-2 mb-4 rounded"
        />
      )}

      {isSignUp ? (
        <button
          onClick={handleSignUp}
          className="w-full bg-gray-500 text-white py-2 rounded mb-2 hover:bg-gray-600"
        >
          サインアップ
        </button>
      ) : (
        <button
          onClick={handleSignIn}
          className="w-full bg-gray-500 text-white py-2 rounded mb-2 hover:bg-gray-600"
        >
          ログイン
        </button>
      )}

      {/* 匿名ログイン時のニックネーム入力欄 */}
      <input
        type="text"
        value={anonNickname}
        onChange={(e) => setAnonNickname(e.target.value)}
        placeholder="ニックネームを入力"
        className="w-full border p-2 mb-4 rounded"
      />

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mb-4 text-sm text-gray-600 underline"
      >
        {isSignUp ? '> アカウントがある場合はこちら' : '> 新規登録はこちら'}
      </button>

      {/* 匿名ログインボタン */}
      <button
        onClick={handleAnonymousLogin}
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 mb-2"
      >
        匿名ログイン
      </button>

      {/* 退会ボタン */}
      <button
        onClick={handleDeleteAccount}
        className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 mb-2"
      >
        退会
      </button>
    </div>
  );
}
