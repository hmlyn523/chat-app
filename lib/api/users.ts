// lib/api/users.ts
import { supabase } from '@/lib/supabaseClient'

export async function fetchOtherUsers(currentUserId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, nickname')
    .neq('user_id', currentUserId)

  if (error) throw error
  return data
}
