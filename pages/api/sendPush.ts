import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { supabase } from 'lib/supabaseClient';

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

  const { userId, title, body, data, chatId } = req.body;

  // バリデーション
  if (!userId || !title || !body || !chatId) {
    console.error('Missing parameters:', { userId, title, body, chatId });
    return res.status(400).json({ error: 'Missing parameters' });
  }

  console.log('Sending push notification to user:', userId);

  try {
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('fcm_token')
      .eq('user_id', userId);

    if (error || !tokens?.length) {
      console.error('No tokens found for user:', userId, error);
      return res.status(404).json({ error: 'No tokens found' });
    }

    // dataの値をすべて文字列に変換
    const stringifiedData = Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    );

    const registrationTokens = tokens.map((t) => t.fcm_token);

    console.log('------------> title:', title);
    console.log('------------> body:', body);
    console.log('------------> stringifiedData:', stringifiedData);
    console.log('------------> chatId:', chatId);

    const message: admin.messaging.MulticastMessage = {
      tokens: registrationTokens,
      // notification: {
      //   title,
      //   body,
      // },
      data: {
        title,
        body,
        ...stringifiedData, // 既存のデータ
        click_action: `/chat/${chatId}`,
      },
      // // android: {
      //   notification: {
      //     title,
      //     body,
      //     channelId: 'chat_messages',
      //     priority: 'high',
      //     defaultSound: true,
      //   },
      //   data: {
      //     ...stringifiedData, // 既存のデータ
      //     click_action: `/chat/${chatId}`,
      //   },
      // },
      // apns: {
      //   payload: {
      //     aps: {
      //       alert: { title: title, body: body },
      //       sound: 'default',
      //       badge: 1,
      //     },
      //     ...stringifiedData,
      //     // click_action: `/chat/${chatId}`,
      //   },
      // },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log('Successfully sent to devices:', response.successCount);
      console.log('Failed to send to devices:', response.failureCount);

      // 無効トークンの削除
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(registrationTokens[idx]);
        }
      });
      if (invalidTokens.length > 0) {
        await supabase.from('push_tokens').delete().in('fcm_token', invalidTokens);
      }

      return res.status(200).json({
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
      });
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
