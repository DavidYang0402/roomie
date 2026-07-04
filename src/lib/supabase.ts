import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // 讓設定漏掉時的錯誤一眼看得懂，而不是後面一堆神秘的 network error
  throw new Error(
    '缺少 Supabase 設定。請把 .env.example 複製成 .env，填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。',
  )
}

export const supabase = createClient(url, anonKey)
