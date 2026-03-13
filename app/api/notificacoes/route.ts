import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await request.json()
    const { treinamentoNome, tenantId, colaboradorIds } = body as {
      treinamentoNome?: string
      tenantId?: string
      colaboradorIds?: string[]
    }

    if (
      !treinamentoNome ||
      typeof treinamentoNome !== 'string' ||
      !tenantId ||
      typeof tenantId !== 'string' ||
      !Array.isArray(colaboradorIds) ||
      colaboradorIds.length === 0
    ) {
      return NextResponse.json(
        { error: 'treinamentoNome, tenantId e colaboradorIds (array não vazio) são obrigatórios' },
        { status: 400 }
      )
    }

    const titulo = 'Novo treinamento registrado'
    const mensagem = `O treinamento "${treinamentoNome}" foi registrado para você.`

    for (const colaboradorId of colaboradorIds) {
      try {
        const { data: colData, error: colErr } = await supabaseAdmin
          .from('colaboradores')
          .select('email')
          .eq('id', colaboradorId)
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (colErr || !colData?.email) continue

        const colEmail = (colData as { email: string | null }).email
        if (!colEmail) continue

        const { data: usrData, error: usrErr } = await supabaseAdmin
          .from('usuarios')
          .select('id')
          .eq('email', colEmail)
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (usrErr || !usrData) continue

        const usuarioId = (usrData as { id: string }).id

        const { data: configData, error: configErr } = await supabaseAdmin
          .from('usuario_notificacoes_config')
          .select('notif_interna')
          .eq('usuario_id', usuarioId)
          .maybeSingle()

        if (configErr) continue
        if (configData && (configData as { notif_interna: boolean }).notif_interna === false) {
          continue
        }

        await supabaseAdmin.from('notificacoes').insert({
          tenant_id: tenantId,
          usuario_id: usuarioId,
          titulo,
          mensagem,
        })
      } catch {
        // Pular colaborador em caso de erro sem interromper o fluxo
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro na API de notificações:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar notificações' },
      { status: 500 }
    )
  }
}
