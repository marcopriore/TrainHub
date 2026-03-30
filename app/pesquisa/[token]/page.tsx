'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { GraduationCap, CheckCircle, XCircle } from 'lucide-react'
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
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type PageState = 'loading' | 'invalido' | 'ja_respondido' | 'formulario' | 'sucesso'

interface TokenData {
  id: string
  token: string
  formulario_id: string
  tenant_id: string
  usado: boolean
  respondido_em: string | null
  respondente_nome: string | null
}

interface FormularioData {
  nome: string
  descricao: string | null
}

interface Pergunta {
  id: string
  formulario_id: string
  texto: string
  tipo: string
  obrigatoria: boolean
  opcoes: string[] | null
  ordem: number
}

export default function PesquisaTokenPage() {
  const params = useParams()
  const tokenParam = typeof params?.token === 'string' ? params.token : ''

  const [state, setState] = useState<PageState>('loading')
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [formulario, setFormulario] = useState<FormularioData | null>(null)
  const [perguntas, setPerguntas] = useState<Pergunta[]>([])
  const [respostas, setRespostas] = useState<Record<string, number | string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!tokenParam) {
      setState('invalido')
      return
    }

    const supabase = createClient()
    let cancelled = false

    async function load() {
      const { data: tokenRow, error: tokenError } = await supabase
        .from('pesquisa_tokens')
        .select('*')
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

      const { data: formularioData } = await supabase
        .from('pesquisa_formularios')
        .select('nome, descricao')
        .eq('id', token.formulario_id)
        .maybeSingle()

      if (cancelled) return

      const { data: perguntasData, error: perguntasError } = await supabase
        .from('pesquisa_perguntas')
        .select('*')
        .eq('formulario_id', token.formulario_id)
        .order('ordem', { ascending: true })

      if (cancelled) return
      if (perguntasError) {
        setState('invalido')
        return
      }

      setTokenData(token)
      setFormulario((formularioData as FormularioData | null) ?? null)
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
    for (const p of perguntas) {
      if (!p.obrigatoria) continue
      const v = respostas[p.id]
      if (v === undefined || v === null || v === '') {
        next[p.id] = 'Esta pergunta é obrigatória.'
      } else if (p.tipo === 'texto_livre' && typeof v === 'string' && !v.trim()) {
        next[p.id] = 'Esta pergunta é obrigatória.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
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
      const rows = perguntas.map((p) => {
        const valor = respostas[p.id]
        const tipo = p.tipo
        return {
          token_id: tokenData.id,
          pergunta_id: p.id,
          tenant_id: tokenData.tenant_id,
          valor_numerico: tipo === 'escala' ? (typeof valor === 'number' ? valor : null) : null,
          valor_texto: tipo === 'texto_livre' ? (typeof valor === 'string' ? valor : null) : null,
          opcao_selecionada: tipo === 'multipla_escolha' ? (typeof valor === 'string' ? valor : null) : null,
        }
      })

      const { error: insertError } = await supabase.from('pesquisa_respostas').insert(rows)
      if (insertError) throw insertError

      await supabase
        .from('pesquisa_tokens')
        .update({ usado: true, respondido_em: new Date().toISOString() })
        .eq('id', tokenData.id)

      try {
        await fetch('/api/pesquisa/calcular-satisfacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenParam, tokenId: tokenData.id }),
        })
      } catch {
        // Falha silenciosa — não impede o sucesso da resposta
      }

      setState('sucesso')
    } catch (error) {
      console.error('Erro ao enviar pesquisa:', error)
      toast.error('Não foi possível enviar suas respostas. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const formNome = formulario?.nome ?? 'Pesquisa'
  const formDescricao = formulario?.descricao ?? null
  const respondenteNome = tokenData?.respondente_nome

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
            <CardTitle className="font-serif text-xl">Link inválido</CardTitle>
            <CardDescription>
              Este link de pesquisa não é válido ou expirou.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (state === 'ja_respondido') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <CheckCircle className="h-12 w-12 text-[#00C9A7]" />
            </div>
            <CardTitle className="font-serif text-xl">Pesquisa já respondida</CardTitle>
            <CardDescription>
              Você já respondeu esta pesquisa. Obrigado pela participação!
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (state === 'sucesso') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-[#00C9A7]" />
            </div>
            <CardTitle className="font-serif text-2xl">Obrigado pela sua resposta!</CardTitle>
            <CardDescription className="text-base">
              Sua avaliação foi registrada com sucesso.
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
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-[#00C9A7]" />
              <span className="font-serif text-xl font-semibold text-[#00C9A7]">TrainHub</span>
            </div>
            <CardTitle className="font-serif text-2xl font-bold">{formNome}</CardTitle>
            {formDescricao && (
              <CardDescription className="text-base">{formDescricao}</CardDescription>
            )}
            <Separator />
            {respondenteNome && (
              <p className="text-sm text-muted-foreground">
                Respondendo como: <span className="font-medium text-foreground">{respondenteNome}</span>
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {perguntas.map((p) => (
              <div key={p.id} className="space-y-3">
                <Label className="text-base">
                  {p.texto}
                  {p.obrigatoria && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {errors[p.id] && (
                  <p className="text-sm text-destructive">{errors[p.id]}</p>
                )}

                {p.tipo === 'escala' && (
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          'h-10 w-10 rounded-full',
                          respostas[p.id] === n
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-primary/10'
                        )}
                        onClick={() => handleRespostaChange(p.id, n)}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                )}

                {p.tipo === 'multipla_escolha' && (
                  <div className="space-y-2">
                    {(p.opcoes ?? []).map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => handleRespostaChange(p.id, op)}
                        className={cn(
                          'w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                          respostas[p.id] === op
                            ? 'border-primary bg-primary/5'
                            : 'border-input hover:bg-muted/50'
                        )}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                )}

                {p.tipo === 'texto_livre' && (
                  <Textarea
                    placeholder="Sua resposta..."
                    value={(respostas[p.id] as string) ?? ''}
                    onChange={(e) => handleRespostaChange(p.id, e.target.value)}
                    className="min-h-[100px] resize-y"
                  />
                )}
              </div>
            ))}

            <div className="pt-4">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              >
                {submitting ? 'Enviando...' : 'Enviar respostas'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
