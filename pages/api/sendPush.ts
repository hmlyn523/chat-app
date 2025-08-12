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

    const message = {
      token: tokenData.fcm_token,
      notification: {
        title,
        body,
      },
      data: data ? {
        chatRoomId: data.chatRoomId || '',
        senderId: data.senderId || '',
        // 他のカスタムデータがあれば追加
        ...data
      } : undefined,
      // Android用の追加設定
      android: {
        notification: {
          channelId: 'chat_messages', // Android用チャンネルID
          priority: 'high' as const,
          defaultSound: true,
        },
      },
      // iOS用の追加設定
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    
    res.status(200).json({ success: true, response });
  } catch (e) {
    console.error('Error sending push notification:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
}