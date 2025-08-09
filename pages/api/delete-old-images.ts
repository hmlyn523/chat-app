import dayjs from 'dayjs'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

  if (oldMessages.length === 0) {
    return res.status(200).json({ deleted: 0 })
  }

  // 2. ストレージから削除
  const paths = oldMessages.map(msg => {
    const url = new URL(msg.image_url)
    return url.pathname.replace(/^\/storage\/v1\/object\/public\/chat-images\//, '')
  })

  const { error: deleteError } = await supabase.storage.from('chat-images').remove(paths)
  if (deleteError) {
    console.error('画像削除失敗', deleteError)
  }

  // 3. DBから削除（任意）
  const messageIds = oldMessages.map(m => m.id)
  await supabase.from('messages').delete().in('id', messageIds)

  return res.status(200).json({ deleted: oldMessages.length })
}
