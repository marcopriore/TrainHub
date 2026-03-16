'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { BookOpen, Clock, CalendarClock, Award, Building2, Calendar, UserCircle2 } from 'lucide-react'
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

interface TreinamentoRow {
  id: string
  codigo: string
  tipo: string
  nome: string
  carga_horaria: number
  data_treinamento: string
  empresas_parceiras: { nome: string } | null
}

type TipoTreinamento = 'parceiro' | 'colaborador' | string

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
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [colaboradorNaoEncontrado, setColaboradorNaoEncontrado] = useState(false)
  const [treinamentos, setTreinamentos] = useState<TreinamentoRow[]>([])

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
            'id, codigo, tipo, nome, carga_horaria, data_treinamento, empresas_parceiras(nome)'
          )
          .eq('tenant_id', activeTenantId)
          .in('id', treinamentoIds)
          .order('data_treinamento', { ascending: false })

        if (trErr) throw trErr

        setTreinamentos(((trData ?? []) as TreinamentoRow[]) ?? [])
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

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
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
                <TableHead className="font-medium">Código</TableHead>
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Empresa Parceira</TableHead>
                <TableHead className="font-medium text-right">Carga Horária</TableHead>
                <TableHead className="font-medium">Data</TableHead>
                <TableHead className="font-medium">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treinamentos.map((t) => {
                const tipo = (t.tipo ?? 'colaborador') as TipoTreinamento
                const label = tipoLabel[tipo] ?? t.tipo
                const isColaborador = tipo === 'colaborador'
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t.codigo ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{t.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.empresas_parceiras?.nome ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {t.carga_horaria ?? 0}h
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(t.data_treinamento)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isColaborador
                            ? 'border-blue-500/40 text-blue-600 bg-blue-500/5'
                            : 'border-muted-foreground/40 text-muted-foreground bg-muted/30'
                        }
                      >
                        {label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
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
    </div>
  )
}
