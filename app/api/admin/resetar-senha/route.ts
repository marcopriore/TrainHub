import { NextRequest, NextResponse } from 'next/server'
import {
  canAccessTenant,
  canManageUsers,
  getAuthUserOr401,
  getSupabaseAdmin,
  loadApiCaller,
} from '@/lib/server/api-route-auth'

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' },
      { status: 500 }
    )
  }

  const auth = await getAuthUserOr401()
  if ('response' in auth) return auth.response

  const supabaseAdmin = getSupabaseAdmin()
  const caller = await loadApiCaller(supabaseAdmin, auth.user.id)
  if (!caller || !canManageUsers(caller)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { userId, novaSenha } = (await request.json()) as { userId?: string; novaSenha?: string }

  if (!userId || !novaSenha) {
    return NextResponse.json({ error: 'userId e novaSenha são obrigatórios' }, { status: 400 })
  }

  const { data: alvo, error: alvoErr } = await supabaseAdmin
    .from('usuarios')
    .select('tenant_id, is_master')
    .eq('id', userId)
    .maybeSingle()

  if (alvoErr || !alvo?.tenant_id) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  if (alvo.is_master && !caller.isMaster) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (!canAccessTenant(caller, alvo.tenant_id)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: novaSenha,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
