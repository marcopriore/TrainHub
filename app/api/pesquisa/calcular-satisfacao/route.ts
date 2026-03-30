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
    const { token, tokenId } = body as { token?: string; tokenId?: string }

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'token (link público da pesquisa) é obrigatório' },
        { status: 400 }
      )
    }

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('pesquisa_tokens')
      .select('id, treinamento_id, formulario_id, tenant_id, usado')
      .eq('token', token)
      .maybeSingle()

    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'Token não encontrado' }, { status: 404 })
    }

    if (!tokenRow.usado) {
      return NextResponse.json({ error: 'Pesquisa ainda não foi concluída' }, { status: 403 })
    }

    if (tokenId && typeof tokenId === 'string' && tokenRow.id !== tokenId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const tokenData = tokenRow as {
      id: string
      treinamento_id: string
      formulario_id: string
      tenant_id: string
    }

    const { data: perguntasData } = await supabaseAdmin
      .from('pesquisa_perguntas')
      .select('id')
      .eq('formulario_id', tokenData.formulario_id)
      .eq('tipo', 'escala')

    const perguntaIds = (perguntasData ?? []).map((p: { id: string }) => p.id)
    if (perguntaIds.length === 0) {
      return NextResponse.json({ success: true, indice: null })
    }

    const { data: tokensData } = await supabaseAdmin
      .from('pesquisa_tokens')
      .select('id')
      .eq('treinamento_id', tokenData.treinamento_id)
      .eq('formulario_id', tokenData.formulario_id)
      .eq('usado', true)

    const tokenIds = (tokensData ?? []).map((t: { id: string }) => t.id)
    if (tokenIds.length === 0) {
      return NextResponse.json({ success: true, indice: null })
    }

    const { data: respostasData } = await supabaseAdmin
      .from('pesquisa_respostas')
      .select('valor_numerico')
      .in('token_id', tokenIds)
      .in('pergunta_id', perguntaIds)
      .not('valor_numerico', 'is', null)

    const valores = (respostasData ?? [])
      .map((r: { valor_numerico: number | null }) => r.valor_numerico)
      .filter((v): v is number => v != null)

    if (valores.length === 0) {
      return NextResponse.json({ success: true, indice: null })
    }

    const media = valores.reduce((a, b) => a + b, 0) / valores.length
    const indice = Math.round(((media - 1) / 4) * 100)

    const { error: updateError } = await supabaseAdmin
      .from('treinamentos')
      .update({ indice_satisfacao: indice })
      .eq('id', tokenData.treinamento_id)
      .eq('tenant_id', tokenData.tenant_id)

    if (updateError) {
      return NextResponse.json({ error: 'Falha ao atualizar treinamento' }, { status: 500 })
    }

    return NextResponse.json({ success: true, indice })
  } catch (error) {
    console.error(
      'Erro ao calcular satisfação:',
      error instanceof Error ? error.message : 'erro desconhecido'
    )
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
