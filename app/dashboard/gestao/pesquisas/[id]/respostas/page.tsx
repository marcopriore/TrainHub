'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Formulario {
  id: string
  nome: string
  descricao: string | null
}

interface Treinamento {
  id: string
  codigo: string
  nome: string
  data_treinamento: string | null
}

interface TokenRow {
  id: string
  formulario_id: string
  treinamento_id: string | null
  respondente_nome: string | null
  respondente_email: string | null
  respondente_tipo: string | null
  usado: boolean
  respondido_em: string | null
  tenant_id: string
  treinamento?: Treinamento | null
}

interface Pergunta {
  id: string
  formulario_id: string
  texto: string
  tipo: 'escala' | 'multipla_escolha' | 'texto_livre'
  ordem: number
}

interface RespostaRow {
  id: string
  token_id: string
  pergunta_id: string
  valor_numerico: number | null
  valor_texto: string | null
  opcao_selecionada: string | null
}

type PerguntaComResposta = {
  pergunta: Pergunta
  resposta: RespostaRow | undefined
}

export default function PesquisaRespostasPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [perguntas, setPerguntas] = useState<Pergunta[]>([])
  const [respostasByToken, setRespostasByToken] = useState<Record<string, PerguntaComResposta[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null)

  const supabase = createClient()

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTreinamentoDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  useEffect(() => {
    if (!id || !activeTenantId) return

    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      try {
        const [formResult, perguntasResult, tokensResult] = await Promise.all([
          supabase
            .from('pesquisa_formularios')
            .select('id, nome, descricao')
            .eq('id', id)
            .eq('tenant_id', activeTenantId)
            .maybeSingle(),
          supabase
            .from('pesquisa_perguntas')
            .select('id, formulario_id, texto, tipo, ordem')
            .eq('formulario_id', id)
            .eq('tenant_id', activeTenantId)
            .order('ordem', { ascending: true }),
          supabase
            .from('pesquisa_tokens')
            .select(
              `
              id,
              formulario_id,
              treinamento_id,
              respondente_nome,
              respondente_email,
              respondente_tipo,
              usado,
              respondido_em,
              tenant_id,
              treinamento:treinamentos (
                id,
                codigo,
                nome,
                data_treinamento
              )
            `
            )
            .eq('formulario_id', id)
            .eq('tenant_id', activeTenantId)
            .eq('usado', true)
            .order('respondido_em', { ascending: false }),
        ])

        const { data: formData, error: formError } = formResult as {
          data: Formulario | null
          error: { message?: string } | null
        }

        if (formError) {
          console.error(formError)
          toast.error('Erro ao carregar formulário.')
          router.push('/dashboard/gestao/pesquisas')
          return
        }

        if (!formData) {
          router.push('/dashboard/gestao/pesquisas')
          return
        }

        if (cancelled) return
        setFormulario(formData as Formulario)

        const { data: perguntasData, error: perguntasError } = perguntasResult as {
          data: Pergunta[] | null
          error: { message?: string } | null
        }

        if (perguntasError) {
          console.error(perguntasError)
          toast.error('Erro ao carregar perguntas.')
          return
        }

        const perguntasList = (perguntasData as Pergunta[]) ?? []
        if (!cancelled) {
          setPerguntas(perguntasList)
        }

        const { data: tokensData, error: tokensError } = tokensResult as {
          data: TokenRow[] | null
          error: { message?: string } | null
        }

        if (tokensError) {
          console.error(tokensError)
          toast.error('Erro ao carregar respostas.')
          return
        }

        const tokensList = (tokensData as TokenRow[]) ?? []
        if (cancelled) return
        setTokens(tokensList)

        if (tokensList.length === 0 || perguntasList.length === 0) {
          setRespostasByToken({})
          return
        }

        // Respostas por token
        const respostasMap: Record<string, PerguntaComResposta[]> = {}

        await Promise.all(
          tokensList.map(async (token) => {
            const { data: respostasData, error: respostasError } = await supabase
              .from('pesquisa_respostas')
              .select('id, token_id, pergunta_id, valor_numerico, valor_texto, opcao_selecionada')
              .eq('tenant_id', activeTenantId)
              .eq('token_id', token.id)

            if (respostasError) {
              console.error(respostasError)
              toast.error('Erro ao carregar respostas de um respondente.')
              return
            }

            const respostasList = (respostasData as RespostaRow[]) ?? []
            const byPerguntaId = new Map<string, RespostaRow>()
            respostasList.forEach((r) => {
              byPerguntaId.set(r.pergunta_id, r)
            })

            respostasMap[token.id] = perguntasList.map((pergunta) => ({
              pergunta,
              resposta: byPerguntaId.get(pergunta.id),
            }))
          })
        )

        if (!cancelled) {
          setRespostasByToken(respostasMap)
        }
      } catch (error) {
        console.error(error)
        toast.error('Não foi possível carregar as respostas. Tente novamente.')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [id, activeTenantId, router, supabase])

  if (loading || !formulario) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-5 w-40" />
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32 hidden md:block" />
                <Skeleton className="h-4 w-24 hidden md:block" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="w-fit px-0 text-muted-foreground hover:text-foreground"
          >
            <Link href="/dashboard/gestao/pesquisas">← Voltar</Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{formulario.nome}</h1>
            <p className="text-sm text-muted-foreground mt-1">Respostas recebidas</p>
          </div>
        </div>
      </div>

      {tokens.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-border shadow-sm">
          Nenhuma resposta recebida ainda.
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Código</TableHead>
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium hidden md:table-cell">E-mail</TableHead>
                <TableHead className="font-medium">Tipo</TableHead>
                <TableHead className="font-medium hidden md:table-cell">Treinamento</TableHead>
                <TableHead className="font-medium">Data da Resposta</TableHead>
                <TableHead className="font-medium w-16 text-right">Respostas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => {
                const perguntasComRespostas = respostasByToken[token.id] ?? []
                const respondenteNome =
                  token.respondente_nome ||
                  token.respondente_email ||
                  'Respondente sem identificação'

                const tipo = token.respondente_tipo ?? 'indefinido'
                const treinamentoNome = token.treinamento?.nome ?? 'Treinamento não informado'
                const treinamentoData = token.treinamento?.data_treinamento
                const isExpanded = expandedTokenId === token.id

                const toggleRow = () => {
                  setExpandedTokenId((current) => (current === token.id ? null : token.id))
                }

                return (
                  <React.Fragment key={token.id}>
                    <TableRow
                      onClick={toggleRow}
                      className={`cursor-pointer ${
                        isExpanded ? 'bg-muted/40' : ''
                      }`}
                    >
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {token.treinamento?.codigo ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {respondenteNome}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {token.respondente_email ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            tipo === 'colaborador'
                              ? 'border-blue-500/40 text-blue-600 bg-blue-500/5'
                              : 'border-muted-foreground/40 text-muted-foreground bg-muted/30'
                          }
                        >
                          {tipo === 'colaborador'
                            ? 'Colaborador'
                            : tipo === 'parceiro'
                            ? 'Parceiro'
                            : 'Outro'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground">{treinamentoNome}</span>
                          {treinamentoData && (
                            <span className="text-xs text-muted-foreground">
                              {formatTreinamentoDate(treinamentoData)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(token.respondido_em)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleRow()
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                          aria-label={isExpanded ? 'Recolher respostas' : 'Ver respostas'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="p-4">
                          {perguntasComRespostas.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhuma resposta registrada para este respondente.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {perguntasComRespostas.map(({ pergunta, resposta }) => {
                                const key = `${token.id}-${pergunta.id}`
                                let conteudoResposta: React.ReactNode = '—'

                                if (pergunta.tipo === 'escala') {
                                  const valor = resposta?.valor_numerico
                                  conteudoResposta =
                                    typeof valor === 'number' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                                          {valor}
                                        </span>
                                        <div className="flex items-center gap-0.5">
                                          {Array.from({ length: 5 }).map((_, i) => (
                                            <span
                                              key={i}
                                              className={
                                                i < valor
                                                  ? 'text-yellow-400'
                                                  : 'text-muted-foreground/40'
                                              }
                                            >
                                              ★
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      '—'
                                    )
                                } else if (pergunta.tipo === 'multipla_escolha') {
                                  const opcao = resposta?.opcao_selecionada
                                  conteudoResposta = opcao ? (
                                    <Badge className="bg-muted text-foreground hover:bg-muted">
                                      {opcao}
                                    </Badge>
                                  ) : (
                                    '—'
                                  )
                                } else if (pergunta.tipo === 'texto_livre') {
                                  const texto = resposta?.valor_texto?.trim()
                                  conteudoResposta = texto && texto.length > 0 ? texto : '—'
                                }

                                return (
                                  <div key={key} className="text-sm">
                                    <p className="font-medium text-foreground mb-0.5">
                                      {pergunta.texto}
                                    </p>
                                    <div className="text-sm text-foreground">
                                      {conteudoResposta}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

