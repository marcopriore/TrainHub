import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export type ApiCaller = {
  authUserId: string
  isMaster: boolean
  isAdmin: boolean
  tenantId: string | null
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getAuthUserOr401(): Promise<
  { user: User } | { response: NextResponse }
> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  }

  return { user }
}

export async function loadApiCaller(
  supabaseAdmin: SupabaseClient,
  authUserId: string
): Promise<ApiCaller | null> {
  const { data: row, error } = await supabaseAdmin
    .from('usuarios')
    .select('tenant_id, is_master, perfis(is_admin)')
    .eq('id', authUserId)
    .maybeSingle()

  if (error || !row) return null

  const u = row as {
    tenant_id: string | null
    is_master: boolean
    perfis: { is_admin: boolean } | { is_admin: boolean }[] | null
  }
  const rawPerfil = u.perfis
  const isAdmin = Array.isArray(rawPerfil)
    ? rawPerfil[0]?.is_admin ?? false
    : rawPerfil?.is_admin ?? false

  return {
    authUserId,
    isMaster: u.is_master === true,
    isAdmin,
    tenantId: u.tenant_id ?? null,
  }
}

export function canAccessTenant(caller: ApiCaller, tenantId: string): boolean {
  if (caller.isMaster) return true
  if (!caller.tenantId) return false
  return caller.tenantId === tenantId
}

export function canManageUsers(caller: ApiCaller): boolean {
  return caller.isMaster || caller.isAdmin
}
