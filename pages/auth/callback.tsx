// pages/auth/callback.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@supabase/auth-helpers-react';

export default function AuthCallback() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

      if (error) {
        console.error('ログイン失敗:', error.message);
        router.replace('/login'); // エラー時の遷移先
      } else {
        router.replace('/'); // 認証成功時の遷移先
      }
    };

    // iOS Safari 対策: ページが完全にロードされるまで待つ
    if (document.readyState === 'complete') {
      handleOAuthCallback();
    } else {
      window.addEventListener('load', handleOAuthCallback);
      return () => window.removeEventListener('load', handleOAuthCallback);
    }
  }, [router]);

  return <p>ログイン処理中...</p>;
}
