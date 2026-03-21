'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  | 'leitura'
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

interface RespostaRow {
  pergunta_id: string
  opcao_selecionada: string | null
  valor_numerico: number | null
  valor_texto: string | null
}

const ESCALA_NUM_LABELS: Record<number, string> = {
  1: '1 - Péssimo',
  2: '2 - Ruim',
  3: '3 - Regular',
  4: '4 - Bom',
  5: '5 - Excelente',
}

const ESCALA_QUAL_OPCOES = ['Ruim', 'Razoável', 'Bom', 'Excelente']

export default function AvaliacaoTokenPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const tokenParam = typeof params?.token === 'string' ? params.token : ''
  const modoLeitura = searchParams?.get('modo') === 'leitura'

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

      if (token.usado && !modoLeitura) {
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

      if (modoLeitura && token.usado) {
        const { data: respostasData, error: respostasError } = await supabase
          .from('avaliacao_respostas')
          .select('pergunta_id, opcao_selecionada, valor_numerico, valor_texto')
          .eq('token_id', token.id)

        if (cancelled) return
        if (!respostasError && respostasData) {
          const mapa: Record<string, number | string> = {}
          ;(respostasData as RespostaRow[]).forEach((r) => {
            if (r.valor_numerico != null) {
              mapa[r.pergunta_id] = r.valor_numerico
            } else if (r.opcao_selecionada != null) {
              mapa[r.pergunta_id] = r.opcao_selecionada
            } else if (r.valor_texto != null) {
              mapa[r.pergunta_id] = r.valor_texto
            }
          })
          setRespostas(mapa)
        }
        setState('leitura')
      } else {
        setState('formulario')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [tokenParam, modoLeitura])

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
    for (const p of perguntas) {
      if (!p.obrigatoria) continue
      const v = respostas[p.id]
      if (v === undefined || v === null || v === '') {
        next[p.id] = 'Esta pergunta é obrigatória.'
      } else if (
        (p.tipo === 'dissertacao' || p.tipo === 'multipla_escolha') &&
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
      const perguntasComRespostaCorreta = perguntas.filter(
        (p) => p.resposta_correta != null && p.resposta_correta !== ''
      )
      let acertos = 0
      const totalComResposta = perguntasComRespostaCorreta.length

      const rows = perguntas.map((p) => {
        const valor = respostas[p.id]
        const tipo = p.tipo
        let opcaoSelecionada: string | null = null
        let valorNumerico: number | null = null
        let valorTexto: string | null = null

        if (tipo === 'multipla_escolha' || tipo === 'verdadeiro_falso' || tipo === 'escala_qualitativa') {
          opcaoSelecionada = typeof valor === 'string' ? valor : null
        } else if (tipo === 'escala_numerica') {
          valorNumerico = typeof valor === 'number' ? valor : null
        } else if (tipo === 'dissertacao') {
          valorTexto = typeof valor === 'string' ? valor : null
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

  const getRespostaDada = (perguntaId: string): number | string | null => {
    const v = respostas[perguntaId]
    if (v === undefined || v === null) return null
    return v
  }

  const isRespostaCorreta = (p: Pergunta, valor: number | string | null): boolean => {
    if (valor == null || !p.resposta_correta) return false
    if (typeof valor === 'number') return String(valor) === p.resposta_correta
    return valor === p.resposta_correta
  }

  const isRespostaErrada = (p: Pergunta, valor: number | string | null): boolean => {
    if (valor == null || !p.resposta_correta) return false
    return !isRespostaCorreta(p, valor)
  }

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
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <CheckCircle className="h-12 w-12 text-[#00C9A7]" />
            </div>
            <CardTitle className="font-serif text-xl">Esta avaliação já foi respondida</CardTitle>
            <CardDescription>
              Você já respondeu esta avaliação. Clique abaixo para ver suas respostas e o resultado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-[#00C9A7] hover:bg-[#00C9A7]/90">
              <Link href={`/avaliacao/${tokenParam}?modo=leitura`}>
                Ver respostas
              </Link>
            </Button>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-8 w-8 text-[#00C9A7]" />
                <span className="font-serif text-xl font-semibold text-[#00C9A7]">TrainHub</span>
              </div>
              {state === 'leitura' && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="#" onClick={() => window.history.back()}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Voltar
                  </Link>
                </Button>
              )}
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
            {perguntas.map((p) => (
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

                {state === 'leitura' ? (
                  <div className="text-muted-foreground pl-2">
                    {p.tipo === 'dissertacao' && (
                      <p className="whitespace-pre-wrap">
                        {getRespostaDada(p.id) ?? '—'}
                      </p>
                    )}
                    {(p.tipo === 'multipla_escolha' || p.tipo === 'verdadeiro_falso') && (
                      <div className="space-y-1">
                        <p
                          className={cn(
                            'font-medium',
                            isRespostaCorreta(p, getRespostaDada(p.id))
                              ? 'text-green-600'
                              : isRespostaErrada(p, getRespostaDada(p.id))
                                ? 'text-destructive'
                                : ''
                          )}
                        >
                          Resposta: {String(getRespostaDada(p.id) ?? '—')}
                        </p>
                        {p.resposta_correta && (
                          <p className="text-sm text-green-600">
                            Correta: {p.resposta_correta}
                          </p>
                        )}
                      </div>
                    )}
                    {p.tipo === 'escala_numerica' && (
                      <p>Resposta: {getRespostaDada(p.id) ?? '—'}</p>
                    )}
                    {p.tipo === 'escala_qualitativa' && (
                      <p>Resposta: {getRespostaDada(p.id) ?? '—'}</p>
                    )}
                  </div>
                ) : (
                  <>
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

                    {p.tipo === 'dissertacao' && (
                      <Textarea
                        placeholder="Sua resposta..."
                        value={(respostas[p.id] as string) ?? ''}
                        onChange={(e) => handleRespostaChange(p.id, e.target.value)}
                        className="min-h-[100px] resize-y"
                      />
                    )}

                    {p.tipo === 'escala_numerica' && (
                      <RadioGroup
                        value={String(respostas[p.id] ?? '')}
                        onValueChange={(v) => handleRespostaChange(p.id, Number(v) || 0)}
                        className="flex flex-wrap gap-2"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div
                            key={n}
                            className="flex items-center space-x-2 rounded-lg border px-3 py-2 hover:bg-muted/50"
                          >
                            <RadioGroupItem value={String(n)} id={`${p.id}-${n}`} />
                            <Label
                              htmlFor={`${p.id}-${n}`}
                              className="cursor-pointer font-normal text-sm"
                            >
                              {ESCALA_NUM_LABELS[n]}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {p.tipo === 'escala_qualitativa' && (
                      <RadioGroup
                        value={String(respostas[p.id] ?? '')}
                        onValueChange={(v) => handleRespostaChange(p.id, v)}
                        className="space-y-2"
                      >
                        {ESCALA_QUAL_OPCOES.map((op) => (
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
                  </>
                )}
              </div>
            ))}

            {state === 'leitura' && tokenData && (
              <div className="pt-4 space-y-4">
                <Separator />
                <div className="flex items-center gap-3">
                  <span className="font-medium">Sua nota:</span>
                  <Badge
                    className={cn(
                      tokenData.aprovado === true && 'bg-green-500/10 text-green-600 border-green-500/40',
                      tokenData.aprovado === false && 'bg-destructive/10 text-destructive border-destructive/40',
                      tokenData.aprovado === null && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {tokenData.nota != null ? `${tokenData.nota}%` : '—'}
                  </Badge>
                  {tokenData.aprovado === true && (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/40">
                      Aprovado
                    </Badge>
                  )}
                  {tokenData.aprovado === false && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/40">
                      Reprovado
                    </Badge>
                  )}
                </div>
                <Button variant="outline" asChild>
                  <Link href="#" onClick={() => window.history.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Link>
                </Button>
              </div>
            )}
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
