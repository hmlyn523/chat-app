import { useState } from 'react';
import { supabase } from 'lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

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

  const [anonNickname, setAnonNickname] = useState(() => {
    return localStorage.getItem('anonNickname') || '';
  });

  // 追加: 匿名ログイン
  const handleAnonymousLogin = async () => {
    let anonEmail = localStorage.getItem('anonEmail');
    let anonPassword = localStorage.getItem('anonPassword');

    if (!anonEmail || !anonPassword) {
      // 初回生成
      anonEmail = `anon_${uuidv4()}@example.com`;
      anonPassword = uuidv4();

      localStorage.setItem('anonEmail', anonEmail);
      localStorage.setItem('anonPassword', anonPassword);

      // サインアップ
      const { data, error } = await supabase.auth.signUp({
        email: anonEmail,
        password: anonPassword,
      });

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
        localStorage.setItem('anonNickname', nicknameToUse);
        alert('匿名アカウントを作成してログインしました！');
      }
    } else {
      // 既存アカウントでログイン
      const { error } = await supabase.auth.signInWithPassword({
        email: anonEmail,
        password: anonPassword,
      });

      if (error) {
        alert('匿名ログイン失敗: ' + error.message);
        return;
      }

      alert('匿名ログインしました！');
    }
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

      {/* 匿名ログインボタン */}
      <button
        onClick={handleAnonymousLogin}
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 mb-2"
      >
        匿名ログイン
      </button>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        className="mt-4 text-sm text-gray-600 underline"
      >
        {isSignUp ? '> アカウントがある場合はこちら' : '> 新規登録はこちら'}
      </button>
    </div>
  );
}
