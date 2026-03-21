import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

type TokenRow = {
  token: string
  respondente_nome: string | null
  respondente_email: string | null
  respondente_tipo: string | null
  usado: boolean
}

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
    const { treinamento_id, tenant_id, formulario_id } = body as {
      treinamento_id?: string
      tenant_id?: string
      formulario_id?: string
    }
    if (
      !treinamento_id ||
      typeof treinamento_id !== 'string' ||
      !tenant_id ||
      typeof tenant_id !== 'string' ||
      !formulario_id ||
      typeof formulario_id !== 'string'
    ) {
      return NextResponse.json(
        { error: 'treinamento_id, tenant_id e formulario_id são obrigatórios' },
        { status: 400 }
      )
    }

    const { data: formulario, error: formError } = await supabaseAdmin
      .from('pesquisa_formularios')
      .select('id, nome')
      .eq('id', formulario_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (formError || !formulario) {
      return NextResponse.json(
        { error: 'Formulário de pesquisa não encontrado.' },
        { status: 404 }
      )
    }

    const form = formulario as { id: string; nome: string }

    const { data: tokensData, error: tokensError } = await supabaseAdmin
      .from('pesquisa_tokens')
      .select('token, respondente_nome, respondente_email, respondente_tipo, usado')
      .eq('treinamento_id', treinamento_id)
      .eq('formulario_id', formulario_id)
      .eq('tenant_id', tenant_id)

    if (tokensError) {
      return NextResponse.json(
        { error: 'Erro ao buscar tokens de pesquisa.' },
        { status: 500 }
      )
    }

    const tokens = (tokensData ?? []) as TokenRow[]
    const tokensNaoUsados = tokens.filter((t) => !t.usado)
    const jaResponderam = tokens.filter((t) => t.usado).length

    let enviados = 0
    const erros: string[] = []

    for (const token of tokensNaoUsados) {
      const email = token.respondente_email?.trim()
      if (!email) continue

      const link = `${appUrl}/pesquisa/${token.token}`

      const resendResult = await resend.emails.send({
        from: 'TrainHub <onboarding@resend.dev>',
        to: email,
        subject: `Pesquisa de Satisfação: ${form.nome}`,
        html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #00C9A7; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0;">TrainHub</h1>
      </div>
      <div style="padding: 32px; background-color: #ffffff;">
        <h2 style="color: #1a1a1a;">Olá, ${token.respondente_nome || token.respondente_email || 'participante'}!</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          Gostaríamos de saber sua opinião sobre o treinamento realizado.
          Sua resposta é muito importante para melhorarmos cada vez mais.
        </p>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0; color: #1a1a1a;"><strong>Pesquisa:</strong> ${form.nome}</p>
        </div>
        <p style="color: #4a4a4a; line-height: 1.6;">
          Leva apenas alguns minutos para responder.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${link}"
             style="background-color: #00C9A7; color: white; padding: 14px 32px;
                    text-decoration: none; border-radius: 8px; font-weight: bold;
                    font-size: 16px;">
            Responder Pesquisa
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

      if (!resendResult.error) {
        enviados += 1
      } else {
        erros.push(`${email}: ${resendResult.error.message}`)
      }
    }

    return NextResponse.json({
      enviados,
      jaResponderam,
      erros,
    })
  } catch (error) {
    console.error('Erro ao enviar e-mails de pesquisa:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar requisição' },
      { status: 500 }
    )
  }
}
