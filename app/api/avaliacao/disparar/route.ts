import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' },
      { status: 500 }
    )
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY não configurada' },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
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
    } = await supabaseAuth.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { treinamento_id, tenant_id } = body as {
      treinamento_id?: string
      tenant_id?: string
    }

    if (
      !treinamento_id ||
      typeof treinamento_id !== 'string' ||
      !tenant_id ||
      typeof tenant_id !== 'string'
    ) {
      return NextResponse.json(
        { error: 'treinamento_id e tenant_id são obrigatórios' },
        { status: 400 }
      )
    }

    const { data: formulario } = await supabaseAdmin
      .from('avaliacao_formularios')
      .select('id, titulo, nota_minima')
      .eq('treinamento_id', treinamento_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (!formulario) {
      return NextResponse.json(
        { error: 'Nenhuma avaliação vinculada a este treinamento.' },
        { status: 404 }
      )
    }

    const form = formulario as { id: string; titulo: string; nota_minima: number }

    const { data: treinamento } = await supabaseAdmin
      .from('treinamentos')
      .select('tipo')
      .eq('id', treinamento_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    const tipo = (treinamento as { tipo: string } | null)?.tipo ?? 'colaborador'

    const participantes: { nome: string; email: string; tipo: 'colaborador' | 'parceiro' }[] = []

    if (tipo === 'colaborador') {
      const { data: tcData } = await supabaseAdmin
        .from('treinamento_colaboradores')
        .select('colaboradores(nome, email)')
        .eq('treinamento_id', treinamento_id)
        .eq('tenant_id', tenant_id)

      const rows = (tcData ?? []) as {
        colaboradores: { nome: string; email: string } | { nome: string; email: string }[] | null
      }[]
      rows.forEach((r) => {
        const col = Array.isArray(r.colaboradores) ? r.colaboradores[0] : r.colaboradores
        if (col?.email) {
          participantes.push({
            nome: col.nome ?? '',
            email: col.email,
            tipo: 'colaborador',
          })
        }
      })
    } else {
      const { data: parceirosData } = await supabaseAdmin
        .from('treinamento_parceiros')
        .select('nome, email')
        .eq('treinamento_id', treinamento_id)
        .eq('tenant_id', tenant_id)

      const rows = (parceirosData ?? []) as { nome: string; email: string }[]
      rows.forEach((p) => {
        if (p.email) {
          participantes.push({
            nome: p.nome ?? '',
            email: p.email,
            tipo: 'parceiro',
          })
        }
      })
    }

    let enviados = 0
    let jaExistiam = 0
    const erros: string[] = []

    for (const participante of participantes) {
      const { data: existingToken } = await supabaseAdmin
        .from('avaliacao_tokens')
        .select('id')
        .eq('formulario_id', form.id)
        .eq('respondente_email', participante.email)
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      let token: string

      if (existingToken) {
        const { data: tokenRow } = await supabaseAdmin
          .from('avaliacao_tokens')
          .select('token')
          .eq('id', (existingToken as { id: string }).id)
          .single()
        token = (tokenRow as { token: string } | null)?.token ?? ''
        if (token) {
          jaExistiam += 1
        } else {
          erros.push(`${participante.email}: Token não encontrado`)
          continue
        }
      } else {
        token = crypto.randomUUID()
        const { error: insertErr } = await supabaseAdmin
          .from('avaliacao_tokens')
          .insert({
            formulario_id: form.id,
            tenant_id,
            token,
            respondente_nome: participante.nome || null,
            respondente_email: participante.email,
            respondente_tipo: participante.tipo,
            usado: false,
          })

        if (insertErr) {
          erros.push(`${participante.email}: ${insertErr.message}`)
          continue
        }
      }

      const link = `${appUrl}/avaliacao/${token}`

      const { error: emailError } = await resend.emails.send({
        from: 'TrainHub <onboarding@resend.dev>',
        to: participante.email,
        subject: `Avaliação disponível: ${form.titulo}`,
        html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #00C9A7; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0;">TrainHub</h1>
      </div>
      <div style="padding: 32px; background-color: #ffffff;">
        <h2 style="color: #1a1a1a;">Olá, ${participante.nome || participante.email}!</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          Você tem uma avaliação disponível para responder.
        </p>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0; color: #1a1a1a;"><strong>Avaliação:</strong> ${form.titulo}</p>
          <p style="margin: 8px 0 0; color: #1a1a1a;"><strong>Nota mínima para aprovação:</strong> ${form.nota_minima}%</p>
        </div>
        <p style="color: #ef4444; font-weight: bold;">
          ⚠️ Esta avaliação só pode ser respondida uma única vez.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${link}" 
             style="background-color: #00C9A7; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold; 
                    font-size: 16px;">
            Responder Avaliação
          </a>
        </div>
        <p style="color: #9a9a9a; font-size: 12px; text-align: center;">
          Se o botão não funcionar, copie e cole este link no navegador:<br/>
          <a href="${link}" style="color: #00C9A7;">${link}</a>
        </p>
      </div>
      <div style="background-color: #f5f5f5; padding: 16px; text-align: center;">
        <p style="color: #9a9a9a; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} TrainHub. Todos os direitos reservados.
        </p>
      </div>
    </div>
  `,
      })

      if (emailError) {
        erros.push(`${participante.email}: ${emailError.message}`)
      } else {
        enviados += 1
      }
    }

    return NextResponse.json({
      enviados,
      jaExistiam,
      erros,
    })
  } catch (error) {
    console.error('Erro ao disparar e-mails de avaliação:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar requisição' },
      { status: 500 }
    )
  }
}
