// lib/supabaseClient.ts
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

// ✅ この関数は auth-helpers 用にトークン付きのクライアントを作成します
export const supabase = createPagesBrowserClient()
