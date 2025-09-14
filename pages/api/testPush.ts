import type { NextApiRequest, NextApiResponse } from 'next';
import sendPushHandler from './sendPush';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 本番では無効化
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden in production' });
  }

  // デバッグ用: 固定の userId に通知送信
  req.method = 'POST';
  req.body = {
    userId: '9367bee3-baa5-4646-a8d5-a75b4d996ccb', // ←テスト用の送信先ユーザーIDに置き換える
    title: 'テスト通知',
    body: 'これはテスト送信です 📢',
    data: { type: 'test', time: new Date().toISOString() },
  };

  return sendPushHandler(req, res);
}
