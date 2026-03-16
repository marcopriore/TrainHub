'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { KpiCards, type KpiData } from '@/components/dashboard/kpi-cards'
import {
  RecentActivityTable,
  type RecentActivityItem,
} from '@/components/dashboard/recent-activity'
import type { MonthlyBarData, DonutDataItem } from '@/components/dashboard/charts'

const TrainingBarChart = dynamic(
  () => import('@/components/dashboard/charts').then((m) => ({ default: m.TrainingBarChart })),
  { ssr: false, loading: () => <ChartSkeleton title="Horas de Treinamento por Mês" /> }
)

const TrainingDonutChart = dynamic(
  () => import('@/components/dashboard/charts').then((m) => ({ default: m.TrainingDonutChart })),
  { ssr: false, loading: () => <ChartSkeleton title="Treinamentos por Tipo" /> }
)

function ChartSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <h3 className="font-serif text-base font-semibold text-foreground mb-4">{title}</h3>
      <div className="h-[260px] w-full rounded-lg bg-muted animate-pulse" />
    </div>
  )
}

interface TreinamentoRow {
  id: string
  tipo: string
  nome: string
  carga_horaria: number
  data_treinamento: string
  indice_satisfacao: number | null
  indice_aprovacao: number | null
  criado_em: string
  empresas_parceiras: { nome: string } | null
}

const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function getUltimos6Meses() {
  const hoje = new Date()
  const meses: { mes: string; mesNum: number; ano: number; key: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    meses.push({
      mes: `${MESES_PT[d.getMonth()]}`,
      mesNum: d.getMonth(),
      ano: d.getFullYear(),
      key: `${d.getFullYear()}-${d.getMonth()}`,
    })
  }
  return meses
}

function processarDados(treinamentos: TreinamentoRow[]) {
  const totalHorasParceiros = treinamentos
    .filter((t) => t.tipo === 'parceiro')
    .reduce((acc, t) => acc + (t.carga_horaria ?? 0), 0)

  const totalHorasColaboradores = treinamentos
    .filter((t) => t.tipo === 'colaborador')
    .reduce((acc, t) => acc + (t.carga_horaria ?? 0), 0)

  const comSatisfacao = treinamentos.filter(
    (t) => t.indice_satisfacao != null && t.indice_satisfacao > 0
  )
  const indiceSatisfacao =
    comSatisfacao.length > 0
      ? comSatisfacao.reduce((a, t) => a + (t.indice_satisfacao ?? 0), 0) /
        comSatisfacao.length
      : null

  const comAprovacao = treinamentos.filter(
    (t) => t.indice_aprovacao != null && t.indice_aprovacao > 0
  )
  const indiceAprovacao =
    comAprovacao.length > 0
      ? comAprovacao.reduce((a, t) => a + (t.indice_aprovacao ?? 0), 0) /
        comAprovacao.length
      : null

  const kpiData: KpiData = {
    totalHorasParceiros,
    totalHorasColaboradores,
    indiceSatisfacao: indiceSatisfacao != null ? Number(indiceSatisfacao.toFixed(1)) : null,
    indiceAprovacao: indiceAprovacao != null ? Number(indiceAprovacao.toFixed(1)) : null,
  }

  const ultimos6Meses = getUltimos6Meses()
  const barData: MonthlyBarData[] = ultimos6Meses.map(({ mes, mesNum, ano }) => {
    const doMes = treinamentos.filter((t) => {
      const d = new Date(t.data_treinamento)
      return d.getMonth() === mesNum && d.getFullYear() === ano
    })
    const parceiro = doMes
      .filter((t) => t.tipo === 'parceiro')
      .reduce((a, t) => a + (t.carga_horaria ?? 0), 0)
    const colaborador = doMes
      .filter((t) => t.tipo === 'colaborador')
      .reduce((a, t) => a + (t.carga_horaria ?? 0), 0)
    return { mes, Parceiro: parceiro, Colaborador: colaborador }
  })

  const countParceiro = treinamentos.filter((t) => t.tipo === 'parceiro').length
  const countColaborador = treinamentos.filter((t) => t.tipo === 'colaborador').length
  const donutData: DonutDataItem[] = []
  if (countParceiro > 0) donutData.push({ name: 'Parceiro', value: countParceiro })
  if (countColaborador > 0)
    donutData.push({ name: 'Colaborador', value: countColaborador })

  const recentes: RecentActivityItem[] = treinamentos
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      tipo: t.tipo,
      nome: t.nome,
      empresa: t.empresas_parceiras?.nome ?? '—',
      cargaHoraria: t.carga_horaria ?? 0,
      data: t.data_treinamento,
      indiceSatisfacao: t.indice_satisfacao,
      indiceAprovacao: t.indice_aprovacao,
    }))

  return { kpiData, barData, donutData, recentes }
}

export default function DashboardPage() {
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()
  const [loading, setLoading] = useState(true)
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [barData, setBarData] = useState<MonthlyBarData[]>([])
  const [donutData, setDonutData] = useState<DonutDataItem[]>([])
  const [recentes, setRecentes] = useState<RecentActivityItem[]>([])

  useEffect(() => {
    if (!activeTenantId) {
      setKpiData(null)
      setBarData([])
      setDonutData([])
      setRecentes([])
      setLoading(false)
      return
    }

    const supabase = createClient()

    const fetchData = async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        if (user?.isMaster?.() || user?.isAdmin?.()) {
          const { data, error } = await supabase
            .from('treinamentos')
            .select('id, tipo, nome, carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao, criado_em, empresas_parceiras(nome)')
            .eq('tenant_id', activeTenantId)
            .order('criado_em', { ascending: false })

          if (error) throw error

          const rows = (data ?? []) as unknown as TreinamentoRow[]
          const { kpiData: kpi, barData: bar, donutData: donut, recentes: rec } =
            processarDados(rows)

          setKpiData(kpi)
          setBarData(bar)
          setDonutData(donut)
          setRecentes(rec)
          return
        }

        const userEmail = user?.email
        if (!userEmail) {
          setKpiData(null)
          setBarData([])
          setDonutData([])
          setRecentes([])
          setLoading(false)
          return
        }

        const { data: colData, error: colErr } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('tenant_id', activeTenantId)
          .eq('email', userEmail)
          .maybeSingle()

        if (!colData) {
          setKpiData(null)
          setBarData([])
          setDonutData([])
          setRecentes([])
          setLoading(false)
          return
        }

        if (colErr) {
          throw colErr
        }

        const colaboradorId = (colData as { id: string }).id
        const { data: tcData, error: tcErr } = await supabase
          .from('treinamento_colaboradores')
          .select('treinamento_id')
          .eq('colaborador_id', colaboradorId)

        if (tcErr) throw tcErr
        const ids = (tcData ?? []).map((r: { treinamento_id: string }) => r.treinamento_id)
        if (ids.length === 0) {
          setKpiData(null)
          setBarData([])
          setDonutData([])
          setRecentes([])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('treinamentos')
          .select('id, tipo, nome, carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao, criado_em, empresas_parceiras(nome)')
          .in('id', ids)
          .order('criado_em', { ascending: false })

        if (error) throw error

        const rows = (data ?? []) as unknown as TreinamentoRow[]
        const { kpiData: kpi, barData: bar, donutData: donut, recentes: rec } =
          processarDados(rows)

        setKpiData(kpi)
        setBarData(bar)
        setDonutData(donut)
        setRecentes(rec)
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', JSON.stringify(error, null, 2))
        if (error instanceof Error) console.error('Message:', error.message, 'Stack:', error.stack)
        toast.error('Não foi possível carregar os dados. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }

    let pollId: ReturnType<typeof setInterval> | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = () => {
      channel = supabase
        .channel('treinamentos-dashboard')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'treinamentos',
            filter: `tenant_id=eq.${activeTenantId}`,
          },
          () => fetchData(true)
        )
        .subscribe()

      pollId = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchData(true)
        }
      }, 15_000)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    fetchData().then(setupRealtime)

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (pollId) clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeTenantId, user?.id])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral dos treinamentos —{' '}
          {new Date().toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      <KpiCards data={kpiData} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TrainingBarChart data={barData} loading={loading} />
        </div>
        <div className="lg:col-span-1">
          <TrainingDonutChart data={donutData} loading={loading} />
        </div>
      </div>

      <RecentActivityTable data={recentes} loading={loading} />
    </div>
  )
}
