import { NextRequest, NextResponse } from 'next/server'
import {
  canAccessTenant,
  canManageUsers,
  getAuthUserOr401,
  getSupabaseAdmin,
  loadApiCaller,
} from '@/lib/server/api-route-auth'

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  }

  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Não é possível excluir o próprio usuário' }, { status: 400 })
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

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: dbError } = await supabaseAdmin.from('usuarios').delete().eq('id', userId)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
