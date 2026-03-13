'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { BookOpen, Clock, CheckCircle, Calendar } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-cards'
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
  tipo: string
  nome: string
  carga_horaria: number
  data_treinamento: string
  indice_satisfacao: number | null
  indice_aprovacao: number | null
  empresas_parceiras: { nome: string } | null
}

const tipoConfig: Record<string, string> = {
  parceiro: 'bg-blue-500/10 text-blue-600',
  colaborador: 'bg-[#00C9A7]/10 text-[#00C9A7]',
}

const tipoLabel: Record<string, string> = {
  parceiro: 'Parceiro',
  colaborador: 'Colaborador',
}

function formatDate(dateStr: string) {
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
  const [colaboradorId, setColaboradorId] = useState<string | null>(null)
  const [treinamentos, setTreinamentos] = useState<TreinamentoRow[]>([])

  const canView = user?.hasPermission?.('ver_minhas_trilhas')
  const isAdminOrMaster = user?.isAdmin?.() || user?.isMaster?.()

  useEffect(() => {
    if (!user || (!canView && !isAdminOrMaster)) {
      router.replace('/dashboard/gestao')
      return
    }
  }, [user, canView, isAdminOrMaster, router])

  useEffect(() => {
    if (!activeTenantId || !user?.email) {
      setLoading(false)
      setTreinamentos([])
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

        const colId = (colaboradorData as { id: string } | null)?.id ?? null
        setColaboradorId(colId)

        if (!colId) {
          setTreinamentos([])
          setLoading(false)
          return
        }

        const { data: tcData, error: tcErr } = await supabase
          .from('treinamento_colaboradores')
          .select('treinamento_id')
          .eq('colaborador_id', colId)

        if (tcErr) throw tcErr

        const treinamentoIds = (tcData ?? []).map((r: { treinamento_id: string }) => r.treinamento_id)
        if (treinamentoIds.length === 0) {
          setTreinamentos([])
          setLoading(false)
          return
        }

        const { data: trData, error: trErr } = await supabase
          .from('treinamentos')
          .select('id, tipo, nome, carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao, empresas_parceiras(nome)')
          .eq('tenant_id', activeTenantId)
          .in('id', treinamentoIds)
          .order('data_treinamento', { ascending: false })

        if (trErr) throw trErr
        setTreinamentos((trData as TreinamentoRow[]) ?? [])
      } catch (err) {
        console.error('Erro ao carregar minhas trilhas:', err)
        toast.error('Não foi possível carregar seus treinamentos. Tente novamente.')
        setTreinamentos([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTenantId, user?.email])

  const totalTreinamentos = treinamentos.length
  const cargaHorariaTotal = treinamentos.reduce((acc, t) => acc + (t.carga_horaria ?? 0), 0)
  const comAprovacao = treinamentos.filter(
    (t) => t.indice_aprovacao != null && t.indice_aprovacao > 0
  )
  const indiceAprovacao =
    comAprovacao.length > 0
      ? comAprovacao.reduce((a, t) => a + (t.indice_aprovacao ?? 0), 0) / comAprovacao.length
      : null
  const ultimoTreinamento =
    treinamentos.length > 0
      ? treinamentos.reduce((latest, t) =>
          t.data_treinamento > latest ? t.data_treinamento : latest
        , treinamentos[0]!.data_treinamento)
      : null

  if (!user || (!canView && !isAdminOrMaster)) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Minhas Trilhas do Conhecimento
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Olá, {user.nome}! Veja seu progresso.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </>
        ) : (
          <>
            <KpiCard
              title="Total de Treinamentos"
              value={totalTreinamentos}
              subtitle="treinamentos realizados"
              icon={<BookOpen className="w-6 h-6" />}
              color="teal"
            />
            <KpiCard
              title="Carga Horária Total"
              value={cargaHorariaTotal.toLocaleString('pt-BR')}
              subtitle="horas"
              icon={<Clock className="w-6 h-6" />}
              color="blue"
            />
            <KpiCard
              title="Índice de Aprovação"
              value={indiceAprovacao != null && indiceAprovacao > 0 ? indiceAprovacao.toFixed(1) : '—'}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
              isPercent={indiceAprovacao != null && indiceAprovacao > 0}
              progress={indiceAprovacao ?? 0}
            />
            <KpiCard
              title="Último Treinamento"
              value={ultimoTreinamento ? formatDate(ultimoTreinamento) : '—'}
              icon={<Calendar className="w-6 h-6" />}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Histórico de Treinamentos</h2>
        </div>
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : treinamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              {!colaboradorId
                ? 'Seu perfil ainda não está vinculado a um colaborador. Entre em contato com o administrador.'
                : 'Nenhum treinamento registrado para você ainda.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Data</TableHead>
                <TableHead className="font-medium">Nome do Treinamento</TableHead>
                <TableHead className="font-medium">Tipo</TableHead>
                <TableHead className="font-medium">C. H.</TableHead>
                <TableHead className="font-medium">Aprovação</TableHead>
                <TableHead className="font-medium">Satisfação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treinamentos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(t.data_treinamento)}
                  </TableCell>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={tipoConfig[t.tipo] ?? tipoConfig.colaborador}
                    >
                      {tipoLabel[t.tipo] ?? t.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.carga_horaria}h</TableCell>
                  <TableCell>
                    {t.indice_aprovacao != null ? (
                      <span className="text-green-600 font-medium">
                        {t.indice_aprovacao}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.indice_satisfacao != null ? (
                      <span className="text-amber-600 font-medium">
                        {t.indice_satisfacao}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
