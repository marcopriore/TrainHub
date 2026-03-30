import { createBrowserClient } from '@supabase/ssr'

function getBrowserSupabaseConfig() {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const keyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const url = urlRaw.trim().replace(/\/+$/, '')
  const anonKey = keyRaw.trim()
  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado no cliente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local e reinicie o servidor (npm run dev).'
    )
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL deve começar com https:// (ex.: https://xxxx.supabase.co).'
    )
  }
  return { url, anonKey }
}

export function createClient() {
  const { url, anonKey } = getBrowserSupabaseConfig()
  return createBrowserClient(url, anonKey)
}
