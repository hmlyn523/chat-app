import dayjs from 'dayjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', method: req.method })
  }

  const cutoff = dayjs().subtract(24, 'hour').toISOString()

  try {
    // 1. 画像付きメッセージ取得（24時間より前）
    const { data: oldImageMessages, error: imgMsgError } = await supabase
      .from('messages')
      .select('id, image_url')
      .lt('created_at', cutoff)
      .not('image_url', 'is', null)

    if (imgMsgError) throw imgMsgError

    // 画像の削除処理
    if (oldImageMessages && oldImageMessages.length > 0) {
      const paths = oldImageMessages.map(msg => {
        const url = new URL(msg.image_url)
        return url.pathname.replace(/^\/storage\/v1\/object\/public\/chat-images\//, '')
      })

      const { error: deleteError } = await supabase.storage.from('chat-images').remove(paths)
      if (deleteError) {
        console.error('画像削除失敗', deleteError)
      }
    }

    // 2. 画像の有無にかかわらず24時間以上前の全メッセージIDを取得
    const { data: oldMessages, error: allMsgError } = await supabase
      .from('messages')
      .select('id')
      .lt('created_at', cutoff)

    if (allMsgError) throw allMsgError

    if (!oldMessages || oldMessages.length === 0) {
      return res.status(200).json({ deleted: 0 })
    }

    const messageIds = oldMessages.map(m => m.id)

    // 3. 関連するmessage_readsを削除
    const { error: readsDelError } = await supabase
      .from('message_reads')
      .delete()
      .in('message_id', messageIds)

    if (readsDelError) {
      console.error('message_reads削除失敗', readsDelError)
    }

    // 4. messagesを削除
    const { error: msgDelError } = await supabase
      .from('messages')
      .delete()
      .in('id', messageIds)

    if (msgDelError) throw msgDelError

    return res.status(200).json({ deleted: messageIds.length })
  } catch (error: any) {
    console.error('削除処理エラー', error)
    return res.status(500).json({ error: error.message || error.toString() })
  }
}
