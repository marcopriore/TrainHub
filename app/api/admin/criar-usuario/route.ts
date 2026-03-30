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

  const { nome, email, senha, tenant_id, perfil_id } = await request.json()

  if (
    !nome ||
    !email ||
    !senha ||
    !tenant_id ||
    typeof tenant_id !== 'string' ||
    !perfil_id ||
    typeof perfil_id !== 'string'
  ) {
    return NextResponse.json(
      { error: 'nome, email, senha, tenant_id e perfil_id são obrigatórios' },
      { status: 400 }
    )
  }

  if (!canAccessTenant(caller, tenant_id)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { data: perfilOk } = await supabaseAdmin
    .from('perfis')
    .select('id')
    .eq('id', perfil_id)
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!perfilOk) {
    return NextResponse.json(
      { error: 'Perfil inválido para o tenant selecionado.' },
      { status: 400 }
    )
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: nome },
  })

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? ''
    if (
      msg.includes('already been registered') ||
      msg.includes('user already registered') ||
      msg.includes('already registered')
    ) {
      return NextResponse.json(
        {
          error:
            'Este e-mail já está cadastrado em outro tenant. Cada e-mail só pode pertencer a um tenant no TrainHub.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
    id: authData.user.id,
    tenant_id,
    perfil_id,
    nome,
    email,
    is_master: false,
    ativo: true,
  })

  if (dbError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  const { data: perfil } = await supabaseAdmin
    .from('perfis')
    .select('is_admin')
    .eq('id', perfil_id)
    .single()

  if (perfil && !perfil.is_admin) {
    const { data: existing } = await supabaseAdmin
      .from('colaboradores')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('colaboradores')
        .update({ nome, email })
        .eq('id', existing.id)
    } else {
      const { error: colErr } = await supabaseAdmin.from('colaboradores').insert({
        tenant_id,
        nome,
        email,
      })
      if (colErr) {
        // Ignorar erro (ex: colaborador já existe) - usuário foi criado
      }
    }
  }

  return NextResponse.json({ success: true, userId: authData.user.id })
}
