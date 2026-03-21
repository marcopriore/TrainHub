'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraduationCap,
  LogOut,
  ChevronLeft,
  ClipboardList,
  Clock,
  XCircle,
  PenLine,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { NotificacoesSino } from '@/components/notificacoes-sino'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AvaliacaoToken {
  token: string
  usado: boolean
  aprovado: boolean | null
  nota: number | null
  avaliacao_formularios: {
    titulo: string
    nota_minima: number | null
    treinamentos: {
      codigo: string
      nome: string
      data_treinamento: string
    } | null
  } | null
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const [ano, mes, dia] = dateStr.split('-')
  if (!ano || !mes || !dia) return dateStr
  return `${dia}/${mes}/${ano}`
}

export default function AvaliacoesPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [colaboradorNaoEncontrado, setColaboradorNaoEncontrado] = useState(false)
  const [tokens, setTokens] = useState<AvaliacaoToken[]>([])

  useEffect(() => {
    if (!activeTenantId || !user?.email) {
      setLoading(false)
      setTokens([])
      setColaboradorNaoEncontrado(!user?.email)
      return
    }

    const supabase = createClient()

    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: colaboradorData, error: colErr } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('tenant_id', activeTenantId)
          .eq('email', user.email)
          .maybeSingle()

        if (colErr) throw colErr

        if (!colaboradorData) {
          setColaboradorNaoEncontrado(true)
          setTokens([])
          setLoading(false)
          return
        }

        setColaboradorNaoEncontrado(false)

        const { data: tokensData, error: tokensErr } = await supabase
          .from('avaliacao_tokens')
          .select(
            `
            token,
            usado,
            aprovado,
            nota,
            avaliacao_formularios(
              titulo,
              nota_minima,
              treinamentos(codigo, nome, data_treinamento)
            )
          `
          )
          .eq('tenant_id', activeTenantId)
          .eq('respondente_email', user.email)

        if (tokensErr) throw tokensErr

        setTokens((tokensData as unknown as AvaliacaoToken[]) ?? [])
      } catch (error) {
        console.error('Erro ao carregar avaliações:', error)
        toast.error('Não foi possível carregar as avaliações. Tente novamente.')
        setTokens([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTenantId, user?.email])

  const totalAvaliacoes = tokens.length
  const pendentes = tokens.filter((t) => !t.usado).length
  const reprovadas = tokens.filter((t) => t.usado && t.aprovado === false).length

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  const getStatusBadge = (t: AvaliacaoToken) => {
    if (!t.usado) {
      return (
        <Badge className="bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/40">
          Pendente
        </Badge>
      )
    }
    if (t.aprovado === true) {
      return (
        <Badge className="bg-green-500/10 text-green-600 border border-green-500/40">
          Aprovado
        </Badge>
      )
    }
    if (t.aprovado === false) {
      return (
        <Badge className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/40">
          Reprovado
        </Badge>
      )
    }
    return (
      <Badge className="bg-muted text-muted-foreground border border-border/60">
        Respondido
      </Badge>
    )
  }

  const handleAcao = (t: AvaliacaoToken) => {
    if (!t.usado) {
      router.push(`/avaliacao/${t.token}`)
    } else {
      router.push(`/avaliacao/${t.token}?modo=leitura`)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-sidebar h-16 flex items-center justify-between px-6 shrink-0 border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-white tracking-tight">
            TrainHub
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/40"
            onClick={() => router.push('/dashboard')}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar aos Módulos
          </Button>
          <NotificacoesSino variant="compact" />
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/40 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">{initials}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
            onClick={async () => {
              const { createClient } = await import('@/lib/supabase')
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-8 px-6 py-8">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Avaliações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Realize avaliações e acompanhe seus resultados
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </>
          ) : (
            <>
              <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00C9A7]/10 text-[#00C9A7]">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total de Avaliações
                  </span>
                  <span className="text-xl font-semibold text-foreground">
                    {totalAvaliacoes}
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#f59e0b]/10 text-[#f59e0b]">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pendentes
                  </span>
                  <span className="text-xl font-semibold text-foreground">
                    {pendentes}
                  </span>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ef4444]/10 text-[#ef4444]">
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Reprovadas
                  </span>
                  <span className="text-xl font-semibold text-foreground">
                    {reprovadas}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Lista de Avaliações</h2>
          </div>
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : colaboradorNaoEncontrado ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm max-w-md">
                Seu perfil de colaborador não foi encontrado neste tenant. Entre
                em contato com o administrador para configurar seu acesso.
              </p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm">
                Nenhuma avaliação encontrada.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-medium">Código</TableHead>
                  <TableHead className="font-medium">Treinamento</TableHead>
                  <TableHead className="font-medium">Data</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium text-center">Nota</TableHead>
                  <TableHead className="font-medium text-center w-[80px]">
                    Ação
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => {
                  const treinamento = t.avaliacao_formularios?.treinamentos
                  return (
                    <TableRow key={t.token}>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {treinamento?.codigo ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {treinamento?.nome ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(treinamento?.data_treinamento ?? null)}
                      </TableCell>
                      <TableCell>{getStatusBadge(t)}</TableCell>
                      <TableCell className="text-center">
                        {t.nota != null ? `${t.nota}%` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAcao(t)}
                                aria-label={
                                  t.usado ? 'Ver respostas' : 'Responder avaliação'
                                }
                              >
                                {t.usado ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <PenLine className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t.usado
                                ? 'Ver respostas'
                                : 'Responder avaliação'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  )
}
