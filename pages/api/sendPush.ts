import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { supabase } from '../../lib/supabaseClient';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, title, body, data } = req.body;

  // バリデーション
  if (!userId || !title || !body) {
    console.error('Missing parameters:', { userId, title, body });
    return res.status(400).json({ error: 'Missing parameters' });
  }

  console.log('Sending push notification to user:', userId);

  try {
    // DBから対象ユーザーのfcm_tokenを取得
    const { data: tokenData, error } = await supabase
      .from('push_tokens')
      .select('fcm_token')
      .eq('user_id', userId)
      .single();

    if (error || !tokenData?.fcm_token) {
      console.error('Token not found for user:', userId, error);
      return res.status(404).json({ error: 'Token not found' });
    }

    console.log('Found FCM token for user:', userId);

    const message: admin.messaging.Message = {
      token: tokenData.fcm_token,
      // Android 用通知
      android: {
        notification: {
          title,
          body,
          channelId: 'chat_messages', // 必要に応じて作成済みチャンネルID
          priority: 'high',
          defaultSound: true,
        },
      },
      // iOS 用通知
      apns: {
        payload: {
          aps: {
            alert: { title, body }, // 二重通知防止
            sound: 'default',
            badge: 1,
          },
        },
      },
      // データだけ送りたい場合はここに
      data: {
        title,
        body,
        ...data,
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      res.status(200).json({ success: true, response });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error sending push notification:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
}
