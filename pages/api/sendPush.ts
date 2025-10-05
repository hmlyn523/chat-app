import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { supabase } from 'lib/supabaseClient';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  // 環境変数のチェック
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

// POST /api/sendPush
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  /// method check
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, title, body, data, chatId } = req.body;

  // 必須パラメータのチェック
  if (!userId || !title || !body || !chatId) {
    console.error('Missing parameters:', { userId, title, body, chatId });
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 指定ユーザーのトークンをDBから取得
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('fcm_token')
      .eq('user_id', userId);

    // トークンがない場合は終了
    if (error || !tokens?.length) {
      console.error('No tokens found for user:', userId, error);
      return res.status(404).json({ error: 'No tokens found' });
    }

    // dataの値をすべて文字列に変換
    const stringifiedData = Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)])
    );

    // トークンの配列を作成
    const registrationTokens = tokens.map((t) => t.fcm_token);

    // メッセージの作成
    // const message: admin.messaging.MulticastMessage = {
    //   tokens: registrationTokens,
    //   data: {
    //     title,
    //     body,
    //     ...stringifiedData, // 既存のデータ
    //     chat_id: chatId,
    //   },
    // };

    // メッセージの作成
    const message: admin.messaging.MulticastMessage = {
      tokens: registrationTokens,
      // 1. notificationフィールドを含める（Androidのフォアグラウンド/バックグラウンドの挙動に影響）
      notification: {
        title,
        body,
      },
      // 2. dataフィールドを含める（メッセージの内容をアプリに渡す）
      data: {
        chat_id: chatId,
        // ... 他のカスタムデータ
      },

      // 3. iOS (APNs) の設定を含める
      apns: {
        payload: {
          aps: {
            // 通知バナー表示のために alert と sound を設定
            alert: {
              title: title,
              body: body,
            },
            sound: 'default',

            // onBackgroundMessage をトリガーするために content-available: 1 を設定
            'content-available': 1, // 🚨 これで onBackgroundMessage がバックグラウンドで呼ばれる
          },
          // カスタムデータは aps の外に配置（ベストプラクティス）
          chat_id: chatId,
          // ... 他のカスタムデータ
        },
      },

      // 4. Android (FCM) の設定を含める
      android: {
        notification: {
          title,
          body,
          channelId: 'chat_messages',
          priority: 'high',
          defaultSound: true,
        },
      },
    };

    try {
      // メッセージの送信
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log('Successfully sent to devices:', response.successCount);
      console.log('Failed to send to devices:', response.failureCount);

      // 無効トークンの削除
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        // トークンが無効な場合、削除リストに追加
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(registrationTokens[idx]);
        }
      });
      // 無効トークンがあればDBから削除
      if (invalidTokens.length > 0) {
        await supabase.from('push_tokens').delete().in('fcm_token', invalidTokens);
      }

      // 結果を返す
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
