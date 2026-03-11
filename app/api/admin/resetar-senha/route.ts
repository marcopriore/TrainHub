import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' },
      { status: 500 }
    )
  }

  const { userId, novaSenha } = (await request.json()) as { userId: string; novaSenha: string }

  if (!userId || !novaSenha) {
    return NextResponse.json({ error: 'userId e novaSenha são obrigatórios' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: novaSenha,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
