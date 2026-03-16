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
    const { tokenId } = body as { tokenId?: string }

    if (!tokenId || typeof tokenId !== 'string') {
      return NextResponse.json(
        { error: 'tokenId é obrigatório' },
        { status: 400 }
      )
    }

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('pesquisa_tokens')
      .select('treinamento_id, formulario_id, tenant_id')
      .eq('id', tokenId)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Token não encontrado' },
        { status: 404 }
      )
    }

    const token = tokenData as { treinamento_id: string; formulario_id: string; tenant_id: string }

    const { data: perguntasData } = await supabaseAdmin
      .from('pesquisa_perguntas')
      .select('id')
      .eq('formulario_id', token.formulario_id)
      .eq('tipo', 'escala')

    const perguntaIds = (perguntasData ?? []).map((p: { id: string }) => p.id)
    if (perguntaIds.length === 0) {
      return NextResponse.json({ success: true, indice: null })
    }

    const { data: tokensData } = await supabaseAdmin
      .from('pesquisa_tokens')
      .select('id')
      .eq('treinamento_id', token.treinamento_id)
      .eq('formulario_id', token.formulario_id)
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
    // Escala 1-5 → 0-100%: 1 = 0%, 3 = 50%, 5 = 100%
    const indice = Math.round(((media - 1) / 4) * 100)

    const { error: updateError } = await supabaseAdmin
      .from('treinamentos')
      .update({ indice_satisfacao: indice })
      .eq('id', token.treinamento_id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Falha ao atualizar treinamento' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, indice })
  } catch (error) {
    console.error('Erro ao calcular satisfação:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
