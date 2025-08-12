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

  const { userId, title, body } = req.body;
  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // DBから対象ユーザーのfcm_tokenを取得
  const { data, error } = await supabase
    .from('push_tokens')
    .select('fcm_token')
    .eq('user_id', userId)
    .single();

  if (error || !data?.fcm_token) {
    return res.status(404).json({ error: 'Token not found' });
  }

  const message = {
    token: data.fcm_token,
    notification: {
      title,
      body,
    },
  };

  try {
    const response = await admin.messaging().send(message);
    res.status(200).json({ success: true, response });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}
