import { supabase } from '@/lib/supabaseClient'
import dayjs from 'dayjs'

export default async function handler(_req: any, res: any) {
  const cutoff = dayjs().subtract(24, 'hour').toISOString()

  // 1. 画像付きメッセージを取得（24時間より前）
  const { data: oldMessages, error } = await supabase
    .from('messages')
    .select('id, image_url')
    .lt('created_at', cutoff)
    .not('image_url', 'is', null)

  if (error) {
    console.error('取得エラー', error)
    return res.status(500).json({ error: error.message })
  }

  // 2. ストレージから削除
  for (const msg of oldMessages) {
    const imagePath = msg.image_url.split('/chat-images/')[1] // パスを抽出

console.log(msg.image_url)
console.log(imagePath)

    if (imagePath) {
      const { error: deleteError } = await supabase
        .storage
        .from('chat-images')
        .remove([imagePath])

      if (deleteError) {
        console.error(`画像削除失敗 (${imagePath})`, deleteError)
      }
    }
  }

  // 3. DBから削除（任意）
  const messageIds = oldMessages.map((m) => m.id)
  if (messageIds.length > 0) {
    await supabase.from('messages').delete().in('id', messageIds)
  }

  return res.status(200).json({ deleted: oldMessages.length })
}
