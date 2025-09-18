// pages/api/delete-user.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Supabase Admin クライアント（サービスロールキー使用）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await supabaseAdmin
      .from('friend_requests')
      .delete()
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    await supabaseAdmin.from('messages').delete().eq('user_id', userId);
    await supabaseAdmin.from('chat_members').delete().eq('user_id', userId);
    await supabaseAdmin.from('push_tokens').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_profiles').delete().eq('user_id', userId);
    // 🔹 Optional: chats.created_by が CASCADE でない場合は事前に設定変更
    // await supabaseAdmin.from('chats').update({ created_by: null }).eq('created_by', userId);

    // 🔹 Auth ユーザーを削除
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    // 🔹 DB 側で ON DELETE CASCADE が効くので、関連テーブルの手動削除は不要
    // chat_members, messages, push_tokens, user_profiles は自動削除されます

    return res.status(200).json({ message: 'ユーザーと関連データを削除しました' });
  } catch (err: any) {
    console.error('Failed to delete user:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
}
