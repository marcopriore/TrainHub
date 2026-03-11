import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { nome, email, senha, tenant_id, perfil_id } = await request.json()

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' },
      { status: 500 }
    )
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: nome },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: dbError } = await supabaseAdmin
    .from('usuarios')
    .insert({
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

  // Se perfil não for Admin, criar ou atualizar colaborador com email para Minhas Trilhas
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
