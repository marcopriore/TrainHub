'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { GraduationCap, CheckCircle, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type PageState =
  | 'loading'
  | 'invalido'
  | 'ja_respondido'
  | 'formulario'
  | 'resultado'

interface TokenData {
  id: string
  token: string
  formulario_id: string
  tenant_id: string
  usado: boolean
  respondido_em: string | null
  respondente_nome: string | null
  nota: number | null
  aprovado: boolean | null
  avaliacao_formularios: {
    titulo: string
    descricao: string | null
    nota_minima: number
    treinamentos: { nome: string; codigo: string } | null
  } | null
}

interface Pergunta {
  id: string
  formulario_id: string
  texto: string
  tipo: string
  opcoes: string[] | null
  resposta_correta: string | null
  obrigatoria: boolean
  ordem: number
}

const TIPOS_SUPORTADOS = ['multipla_escolha', 'verdadeiro_falso']

export default function AvaliacaoTokenPage() {
  const params = useParams()
  const tokenParam = typeof params?.token === 'string' ? params.token : ''

  const [state, setState] = useState<PageState>('loading')
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [perguntas, setPerguntas] = useState<Pergunta[]>([])
  const [respostas, setRespostas] = useState<Record<string, number | string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [resultadoNota, setResultadoNota] = useState<number | null>(null)
  const [resultadoAprovado, setResultadoAprovado] = useState<boolean | null>(null)

  useEffect(() => {
    if (!tokenParam) {
      setState('invalido')
      return
    }

    const supabase = createClient()
    let cancelled = false

    async function load() {
      const { data: tokenRow, error: tokenError } = await supabase
        .from('avaliacao_tokens')
        .select(
          `
          id,
          token,
          formulario_id,
          tenant_id,
          usado,
          respondido_em,
          respondente_nome,
          nota,
          aprovado,
          avaliacao_formularios(
            titulo,
            descricao,
            nota_minima,
            treinamentos(nome, codigo)
          )
        `
        )
        .eq('token', tokenParam)
        .maybeSingle()

      if (cancelled) return
      if (tokenError || !tokenRow) {
        setState('invalido')
        return
      }

      const token = tokenRow as unknown as TokenData

      if (token.usado) {
        setTokenData(token)
        setState('ja_respondido')
        return
      }

      const { data: perguntasData, error: perguntasError } = await supabase
        .from('avaliacao_perguntas')
        .select('*')
        .eq('formulario_id', token.formulario_id)
        .order('ordem', { ascending: true })

      if (cancelled) return
      if (perguntasError) {
        setState('invalido')
        return
      }

      setTokenData(token)
      setPerguntas((perguntasData as Pergunta[]) ?? [])
      setState('formulario')
    }

    load()
    return () => {
      cancelled = true
    }
  }, [tokenParam])

  const handleRespostaChange = (perguntaId: string, value: number | string) => {
    setRespostas((prev) => ({ ...prev, [perguntaId]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[perguntaId]
      return next
    })
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    const perguntasValidas = perguntas.filter((p) => TIPOS_SUPORTADOS.includes(p.tipo))
    for (const p of perguntasValidas) {
      if (!p.obrigatoria) continue
      const v = respostas[p.id]
      if (v === undefined || v === null || v === '') {
        next[p.id] = 'Esta pergunta é obrigatória.'
      } else if (
        p.tipo === 'multipla_escolha' &&
        typeof v === 'string' &&
        !v.trim()
      ) {
        next[p.id] = 'Esta pergunta é obrigatória.'
      }
    }
    setErrors(next)
    if (Object.keys(next).length > 0) {
      const firstId = Object.keys(next)[0]
      const el = document.getElementById(`pergunta-${firstId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!tokenData || state !== 'formulario') return
    if (!validate()) {
      toast.error('Preencha todas as perguntas obrigatórias.')
      return
    }

    const supabase = createClient()
    setSubmitting(true)
    try {
      const perguntasSuportadas = perguntas.filter((p) => TIPOS_SUPORTADOS.includes(p.tipo))
      const perguntasComRespostaCorreta = perguntasSuportadas.filter(
        (p) => p.resposta_correta != null && p.resposta_correta !== ''
      )
      let acertos = 0
      const totalComResposta = perguntasComRespostaCorreta.length

      const rows = perguntasSuportadas.map((p) => {
        const valor = respostas[p.id]
        const tipo = p.tipo
        let opcaoSelecionada: string | null = null
        let valorNumerico: number | null = null
        let valorTexto: string | null = null

        if (tipo === 'multipla_escolha' || tipo === 'verdadeiro_falso') {
          opcaoSelecionada = typeof valor === 'string' ? valor : null
        }

        if (
          tipo === 'multipla_escolha' ||
          tipo === 'verdadeiro_falso'
        ) {
          const resp = typeof valor === 'string' ? valor : null
          if (p.resposta_correta && resp === p.resposta_correta) {
            acertos += 1
          }
        }

        return {
          token_id: tokenData.id,
          pergunta_id: p.id,
          tenant_id: tokenData.tenant_id,
          opcao_selecionada: opcaoSelecionada,
          valor_numerico: valorNumerico,
          valor_texto: valorTexto,
        }
      })

      const { error: insertError } = await supabase.from('avaliacao_respostas').insert(rows)
      if (insertError) throw insertError

      let nota: number | null = null
      let aprovado: boolean | null = null
      if (totalComResposta > 0) {
        nota = Math.round((acertos / totalComResposta) * 100)
        const notaMinima = tokenData.avaliacao_formularios?.nota_minima ?? 70
        aprovado = nota >= notaMinima
      }

      await supabase
        .from('avaliacao_tokens')
        .update({
          usado: true,
          respondido_em: new Date().toISOString(),
          nota,
          aprovado,
        })
        .eq('id', tokenData.id)

      setResultadoNota(nota)
      setResultadoAprovado(aprovado)
      setState('resultado')
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error)
      toast.error('Não foi possível enviar suas respostas. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const form = tokenData?.avaliacao_formularios
  const treinamento = form?.treinamentos
  const titulo = form?.titulo ?? 'Avaliação'
  const respondenteNome = tokenData?.respondente_nome
  const notaMinima = form?.nota_minima ?? 70

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  if (state === 'invalido') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="font-serif text-xl">Avaliação não encontrada</CardTitle>
            <CardDescription>
              Avaliação não encontrada ou link inválido.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (state === 'ja_respondido') {
    const aprovado = tokenData?.aprovado
    const nota = tokenData?.nota
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Card
          className={cn(
            'max-w-md w-full',
            aprovado === true && 'border-green-500/50',
            aprovado === false && 'border-destructive/50',
            aprovado === null && 'border-[#00C9A7]/50'
          )}
        >
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              {aprovado === true && (
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              )}
              {aprovado === false && (
                <XCircle className="h-12 w-12 text-destructive" />
              )}
              {aprovado === null && (
                <CheckCircle2 className="h-12 w-12 text-[#00C9A7]" />
              )}
            </div>
            <CardTitle className="font-serif text-xl">Avaliação já respondida</CardTitle>
            <CardDescription>
              Esta avaliação já foi respondida e não pode ser alterada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            {aprovado === true && (
              <>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/40">
                  Aprovado
                </Badge>
                <span className="text-sm">Sua nota: {nota ?? '—'}%</span>
              </>
            )}
            {aprovado === false && (
              <>
                <Badge className="bg-destructive/10 text-destructive border-destructive/40">
                  Reprovado
                </Badge>
                <span className="text-sm">Sua nota: {nota ?? '—'}%</span>
              </>
            )}
            {aprovado === null && (
              <Badge className="bg-muted text-muted-foreground">
                Respondido
              </Badge>
            )}
          </CardContent>
        </Card>
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <GraduationCap className="h-5 w-5 text-[#00C9A7]" />
          <span className="font-serif font-medium text-[#00C9A7]">TrainHub</span>
        </div>
      </div>
    )
  }

  if (state === 'resultado') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <Card
          className={cn(
            'max-w-md w-full',
            resultadoAprovado === true && 'border-green-500/50 bg-green-500/5',
            resultadoAprovado === false && 'border-destructive/50 bg-destructive/5',
            resultadoAprovado === null && 'border-blue-500/50 bg-blue-500/5'
          )}
        >
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {resultadoAprovado === true && (
                <CheckCircle className="h-16 w-16 text-green-600" />
              )}
              {resultadoAprovado === false && (
                <XCircle className="h-16 w-16 text-destructive" />
              )}
              {resultadoAprovado === null && (
                <CheckCircle className="h-16 w-16 text-blue-600" />
              )}
            </div>
            <CardTitle className="font-serif text-2xl">
              {resultadoAprovado === true &&
                `Parabéns! Você foi aprovado com ${resultadoNota}%`}
              {resultadoAprovado === false &&
                `Você não atingiu a nota mínima. Sua nota: ${resultadoNota}%`}
              {resultadoAprovado === null && 'Avaliação enviada com sucesso!'}
            </CardTitle>
            <CardDescription className="text-base">
              {resultadoAprovado === true && 'Você atingiu a nota mínima necessária.'}
              {resultadoAprovado === false && `A nota mínima para aprovação é ${notaMinima}%.`}
              {resultadoAprovado === null && 'Sua avaliação foi registrada.'}
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <GraduationCap className="h-5 w-5 text-[#00C9A7]" />
          <span className="font-serif font-medium text-[#00C9A7]">TrainHub</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-background', state === 'formulario' && 'pb-24')}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-[#00C9A7]" />
              <span className="font-serif text-xl font-semibold text-[#00C9A7]">TrainHub</span>
            </div>
            <CardTitle className="font-serif text-2xl font-bold">{titulo}</CardTitle>
            {form?.descricao && (
              <CardDescription className="text-base">{form.descricao}</CardDescription>
            )}
            <Separator />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Treinamento:</span>{' '}
                {treinamento?.nome ?? '—'}
              </p>
              <p>
                <span className="font-medium text-foreground">Código:</span>{' '}
                {treinamento?.codigo ?? '—'}
              </p>
              {respondenteNome && (
                <p>
                  <span className="font-medium text-foreground">Respondente:</span>{' '}
                  {respondenteNome}
                </p>
              )}
              <p>
                <span className="font-medium text-foreground">Nota mínima para aprovação:</span>{' '}
                {notaMinima}%
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {state === 'formulario' && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">
                    Atenção: esta avaliação só pode ser respondida uma única vez.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Após o envio, não será possível alterar suas respostas.
                  </p>
                </div>
              </div>
            )}
            {perguntas
              .filter((p) => TIPOS_SUPORTADOS.includes(p.tipo))
              .map((p) => (
              <div key={p.id} id={`pergunta-${p.id}`} className="space-y-3">
                <Label className="text-base font-semibold">
                  {p.texto}
                  {p.obrigatoria && <span className="text-destructive ml-0.5">*</span>}
                  {p.obrigatoria && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Obrigatória
                    </Badge>
                  )}
                </Label>
                {errors[p.id] && (
                  <p className="text-sm text-destructive">{errors[p.id]}</p>
                )}

                {p.tipo === 'multipla_escolha' && (
                      <RadioGroup
                        value={String(respostas[p.id] ?? '')}
                        onValueChange={(v) => handleRespostaChange(p.id, v)}
                        className="space-y-2"
                      >
                        {(p.opcoes ?? []).map((op) => (
                          <div
                            key={op}
                            className="flex items-center space-x-2 rounded-lg border px-4 py-3 hover:bg-muted/50"
                          >
                            <RadioGroupItem value={op} id={`${p.id}-${op}`} />
                            <Label
                              htmlFor={`${p.id}-${op}`}
                              className="flex-1 cursor-pointer font-normal"
                            >
                              {op}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                {p.tipo === 'verdadeiro_falso' && (
                  <RadioGroup
                    value={String(respostas[p.id] ?? '')}
                    onValueChange={(v) => handleRespostaChange(p.id, v)}
                    className="space-y-2"
                  >
                    {['Verdadeiro', 'Falso'].map((op) => (
                      <div
                        key={op}
                        className="flex items-center space-x-2 rounded-lg border px-4 py-3 hover:bg-muted/50"
                      >
                        <RadioGroupItem value={op} id={`${p.id}-${op}`} />
                        <Label
                          htmlFor={`${p.id}-${op}`}
                          className="flex-1 cursor-pointer font-normal"
                        >
                          {op}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {state === 'formulario' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-10">
            <div className="max-w-2xl mx-auto">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              >
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
