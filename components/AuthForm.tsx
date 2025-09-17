import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export function AuthForm() {
  const [anonNickname, setAnonNickname] = useState('');
  const [anonEmail, setAnonEmail] = useState<string | null>(null);
  const [anonPassword, setAnonPassword] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState(''); // 追加

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedNickname = localStorage.getItem('anonNickname') || '';
    const storedEmail = localStorage.getItem('anonEmail');
    const storedPassword = localStorage.getItem('anonPassword');

    setAnonNickname(storedNickname);
    setAnonEmail(storedEmail);
    setAnonPassword(storedPassword);
  }, []);

  const handleAnonymousLogin = async () => {
    setErrorMessage(''); // 前回のエラーをリセット

    if (!anonNickname.trim()) {
      setErrorMessage('ニックネームを入力してください'); // alert の代わり
      return;
    }

    let email = anonEmail;
    let password = anonPassword;

    if (!email || !password) {
      email = `anon_${uuidv4()}@example.com`;
      password = uuidv4();

      if (typeof window !== 'undefined') {
        localStorage.setItem('anonEmail', email);
        localStorage.setItem('anonPassword', password);
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMessage('ログイン失敗: ' + error.message);
        return;
      }

      const user = data?.user;
      if (user) {
        await supabase.from('user_profiles').insert([{ user_id: user.id, nickname: anonNickname }]);
        localStorage.setItem('anonNickname', anonNickname);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage('匿名ログイン失敗: ' + error.message);
        return;
      }
    }
  };

  return (
    <div className="mt-20 max-w-sm mx-auto p-4 bg-white rounded shadow">
      <input
        type="text"
        value={anonNickname}
        onChange={(e) => setAnonNickname(e.target.value)}
        placeholder="ニックネームを入力"
        className="w-full border p-2 mb-2 rounded"
      />

      {/* エラーメッセージ表示 */}
      <div className="h-5 mb-2 text-red-600 text-sm">
        {errorMessage && <div className="text-red-600 text-sm mb-2">{errorMessage}</div>}
      </div>

      <button
        onClick={handleAnonymousLogin}
        className="w-full bg-gray-500 text-white py-2 rounded mb-2 hover:bg-gray-600"
      >
        はじめる
      </button>

      <button onClick={() => localStorage.clear()}>ローカルデータ削除</button>
    </div>
  );
}
