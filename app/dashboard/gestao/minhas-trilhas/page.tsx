'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import {
  BookOpen,
  Clock,
  CalendarClock,
  Award,
  Download,
  UserCircle2,
  GraduationCap,
  LogOut,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { gerarCertificadoPDF } from '@/app/dashboard/gestao/catalogo/page'

interface TreinamentoRow {
  id: string
  codigo: string
  tipo: string
  nome: string
  carga_horaria: number
  data_treinamento: string
   indice_satisfacao: number | null
  empresas_parceiras: { nome: string } | null
}

type TipoTreinamento = 'parceiro' | 'colaborador' | string

type PesquisaStatus = {
  status: 'respondida' | 'pendente' | 'dispensado' | 'na'
  token?: string
}

const tipoLabel: Record<TipoTreinamento, string> = {
  parceiro: 'Parceiro',
  colaborador: 'Colaborador',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function MinhasTrilhasPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [colaboradorNaoEncontrado, setColaboradorNaoEncontrado] = useState(false)
  const [treinamentos, setTreinamentos] = useState<TreinamentoRow[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [certificadoTemplate, setCertificadoTemplate] = useState<{
    imagem_url: string | null
    campos_posicoes: any
  } | null>(null)
  const [tokensByTreinamento, setTokensByTreinamento] = useState<
    Map<string, { token: string; usado: boolean }>
  >(new Map())

  useEffect(() => {
    if (!activeTenantId || !user?.email) {
      setLoading(false)
      setTreinamentos([])
      setColaboradorNaoEncontrado(!user?.email)
      return
    }

    const supabase = createClient()

    const fetchData = async () => {
      setLoading(true)
      try {
        // 1. Buscar colaborador por email + tenant
        const { data: colaboradorData, error: colErr } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('tenant_id', activeTenantId)
          .eq('email', user.email)
          .maybeSingle()

        if (colErr) {
          throw colErr
        }

        const colaboradorId = (colaboradorData as { id: string } | null)?.id ?? null

        if (!colaboradorId) {
          setColaboradorNaoEncontrado(true)
          setTreinamentos([])
          setLoading(false)
          return
        }

        setColaboradorNaoEncontrado(false)

        // 3. Buscar vínculos de treinamentos
        const { data: tcData, error: tcErr } = await supabase
          .from('treinamento_colaboradores')
          .select('treinamento_id')
          .eq('colaborador_id', colaboradorId)

        if (tcErr) throw tcErr

        const treinamentoIds =
          (tcData ?? []).map((r: { treinamento_id: string }) => r.treinamento_id) ?? []

        if (treinamentoIds.length === 0) {
          setTreinamentos([])
          setLoading(false)
          return
        }

        // 4. Buscar treinamentos vinculados
        const { data: trData, error: trErr } = await supabase
          .from('treinamentos')
          .select(
            'id, codigo, tipo, nome, carga_horaria, data_treinamento, indice_satisfacao, empresas_parceiras(nome)'
          )
          .eq('tenant_id', activeTenantId)
          .in('id', treinamentoIds)
          .order('data_treinamento', { ascending: false })

        if (trErr) throw trErr

        const treinamentosCarregados = ((trData ?? []) as TreinamentoRow[]) ?? []
        setTreinamentos(treinamentosCarregados)

        // 4b. Buscar tokens de pesquisa vinculados ao usuário para esses treinamentos
        if (treinamentosCarregados.length > 0) {
          const { data: tokensData, error: tokensErr } = await supabase
            .from('pesquisa_tokens')
            .select('treinamento_id, token, usado')
            .eq('tenant_id', activeTenantId)
            .eq('respondente_email', user.email)
            .in(
              'treinamento_id',
              treinamentosCarregados.map((t) => t.id)
            )

          if (tokensErr) {
            console.error('Erro ao carregar tokens de pesquisa:', tokensErr)
          } else {
            const map = new Map<string, { token: string; usado: boolean }>()
            ;(tokensData ?? []).forEach(
              (row: { treinamento_id: string; token: string; usado: boolean }) => {
                map.set(row.treinamento_id, { token: row.token, usado: row.usado })
              }
            )
            setTokensByTreinamento(map)
          }
        } else {
          setTokensByTreinamento(new Map())
        }

        // 5. Buscar template de certificado do tenant
        const { data: templateData, error: templateErr } = await supabase
          .from('certificado_templates')
          .select('imagem_url, campos_posicoes')
          .eq('tenant_id', activeTenantId)
          .maybeSingle()

        if (templateErr && templateErr.code !== 'PGRST116') {
          console.error('Erro ao carregar template de certificado:', templateErr)
        }

        setCertificadoTemplate(
          (templateData as { imagem_url: string | null; campos_posicoes: any } | null) ?? null
        )
      } catch (error) {
        console.error('Erro ao carregar minhas trilhas:', JSON.stringify(error, null, 2))
        if (error instanceof Error) {
          console.error('Message:', error.message, 'Stack:', error.stack)
        }
        toast.error('Não foi possível carregar seus treinamentos. Tente novamente.')
        setTreinamentos([])
        setColaboradorNaoEncontrado(false)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTenantId, user?.email])

  const { totalHoras, totalTreinamentos, ultimoTreinamentoNome, ultimoTreinamentoData } =
    useMemo(() => {
      if (treinamentos.length === 0) {
        return {
          totalHoras: 0,
          totalTreinamentos: 0,
          ultimoTreinamentoNome: null as string | null,
          ultimoTreinamentoData: null as string | null,
        }
      }
      const totalHorasCalc = treinamentos.reduce(
        (acc, t) => acc + (t.carga_horaria ?? 0),
        0
      )
      const ultimo = treinamentos[0]
      return {
        totalHoras: totalHorasCalc,
        totalTreinamentos: treinamentos.length,
        ultimoTreinamentoNome: ultimo.nome,
        ultimoTreinamentoData: ultimo.data_treinamento,
      }
    }, [treinamentos])

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  const getPesquisaStatus = (t: TreinamentoRow): PesquisaStatus => {
    if (t.indice_satisfacao !== null && t.indice_satisfacao !== 0) {
      return { status: 'dispensado' }
    }
    const tokenData = tokensByTreinamento.get(t.id)
    if (!tokenData) return { status: 'na' }
    if (tokenData.usado) return { status: 'respondida', token: tokenData.token }
    return { status: 'pendente', token: tokenData.token }
  }

  const certificadoLiberado = (t: TreinamentoRow): boolean => {
    const ps = getPesquisaStatus(t)
    return ps.status === 'respondida' || ps.status === 'dispensado' || ps.status === 'na'
  }

  const handleBaixarCertificado = async (treinamento: TreinamentoRow) => {
    if (!certificadoTemplate?.imagem_url) {
      toast.error('Template de certificado não configurado para este tenant.')
      return
    }

    setDownloadingId(treinamento.id)
    try {
      const nomeColaborador =
        (user as any)?.nome ?? (user as any)?.email ?? 'Colaborador'

      await gerarCertificadoPDF({
        templateImageUrl: certificadoTemplate.imagem_url,
        camposPosicoes: certificadoTemplate.campos_posicoes,
        nomeColaborador,
        nomeTreinamento: treinamento.nome,
        cargaHoraria: String(treinamento.carga_horaria ?? ''),
        dataConclusao: treinamento.data_treinamento ?? new Date().toISOString().split('T')[0],
      })

      toast.success('Certificado gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar certificado na tela Minhas Trilhas:', error)
      toast.error('Erro ao gerar certificado. Tente novamente.')
    } finally {
      setDownloadingId(null)
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
        {/* Header local da página */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Minhas Trilhas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe sua jornada de aprendizado
          </p>
        </div>

        {/* Seção 1 — Cards de Progresso */}
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
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total de Horas
                </span>
                <span className="text-xl font-semibold text-foreground">
                  {totalHoras}h
                </span>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00C9A7]/10 text-[#00C9A7]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Treinamentos Realizados
                </span>
                <span className="text-xl font-semibold text-foreground">
                  {totalTreinamentos}
                </span>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00C9A7]/10 text-[#00C9A7]">
                <UserCircle2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Último Treinamento
                </span>
                <span className="text-sm font-semibold text-foreground truncate">
                  {ultimoTreinamentoNome ?? '—'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ultimoTreinamentoData ? formatDate(ultimoTreinamentoData) : ''}
                </span>
              </div>
            </div>
          </>
        )}
        </div>

        {/* Seção 2 — Treinamentos Realizados */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Treinamentos Realizados</h2>
        </div>
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : colaboradorNaoEncontrado ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm max-w-md">
              Seu perfil de colaborador não foi encontrado neste tenant. Entre em contato com o
              administrador para configurar seu acesso.
            </p>
          </div>
        ) : treinamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              Nenhum treinamento realizado ainda.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium text-center">Código</TableHead>
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Empresa Parceira</TableHead>
                <TableHead className="font-medium text-center">Carga Horária</TableHead>
                <TableHead className="font-medium text-center">Data</TableHead>
                <TableHead className="font-medium text-center">Certificado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treinamentos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-center">
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.codigo ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{t.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.empresas_parceiras?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {t.carga_horaria ?? 0}h
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatDate(t.data_treinamento)}
                  </TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const ps = getPesquisaStatus(t)
                      if (ps.status === 'dispensado') {
                        return (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/40">
                            Dispensado
                          </Badge>
                        )
                      }
                      if (ps.status === 'respondida') {
                        return (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/40 gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Respondida
                          </Badge>
                        )
                      }
                      if (ps.status === 'pendente' && ps.token) {
                        return (
                          <Badge
                            className="bg-muted text-muted-foreground border border-border/60 cursor-pointer hover:bg-muted/80"
                            onClick={() => {
                              const origin =
                                typeof window !== 'undefined'
                                  ? window.location.origin
                                  : 'https://trainhub-app.vercel.app'
                              window.open(`${origin}/pesquisa/${ps.token}`, '_blank')
                            }}
                          >
                            Pendente
                          </Badge>
                        )
                      }
                      return (
                        <Badge className="bg-muted text-muted-foreground border border-border/60">
                          N/A
                        </Badge>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    {certificadoTemplate?.imagem_url && certificadoLiberado(t) ? (
                      <button
                        type="button"
                        onClick={() => handleBaixarCertificado(t)}
                        disabled={downloadingId === t.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {downloadingId === t.id ? (
                          <>
                            <span className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            Baixar
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground bg-muted cursor-not-allowed"
                        title={
                          certificadoTemplate?.imagem_url
                            ? 'Responda a pesquisa para liberar o certificado'
                            : 'Template de certificado não configurado'
                        }
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </div>

        {/* Seção 3 — Próximos Treinamentos (Em breve) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-dashed border-border/70 shadow-sm p-5 flex flex-col gap-3 opacity-70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                <CalendarClock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Próximos Treinamentos</h2>
                <p className="text-xs text-muted-foreground">
                  Em breve você poderá visualizar seus treinamentos agendados aqui.
                </p>
              </div>
            </div>
            <Badge className="bg-muted text-muted-foreground border border-border/60">
              Em breve
            </Badge>
          </div>
        </div>

          {/* Seção 4 — Certificados (Em breve) */}
        <div className="bg-card rounded-xl border border-dashed border-border/70 shadow-sm p-5 flex flex-col gap-3 opacity-70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                <Award className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Meus Certificados</h2>
                <p className="text-xs text-muted-foreground">
                  Em breve você poderá acessar e baixar seus certificados de conclusão aqui.
                </p>
              </div>
            </div>
            <Badge className="bg-muted text-muted-foreground border border-border/60">
              Em breve
            </Badge>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}
