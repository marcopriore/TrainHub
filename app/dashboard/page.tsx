'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { KpiCards, type KpiData } from '@/components/dashboard/kpi-cards'
import {
  TrainingBarChart,
  TrainingDonutChart,
  type MonthlyBarData,
  type DonutDataItem,
} from '@/components/dashboard/charts'
import {
  RecentActivityTable,
  type RecentActivityItem,
} from '@/components/dashboard/recent-activity'

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
  const [loading, setLoading] = useState(true)
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [barData, setBarData] = useState<MonthlyBarData[]>([])
  const [donutData, setDonutData] = useState<DonutDataItem[]>([])
  const [recentes, setRecentes] = useState<RecentActivityItem[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('treinamentos')
          .select('id, tipo, nome, carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao, criado_em, empresas_parceiras(nome)')
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
        console.error('Erro ao carregar dados do dashboard:', error)
        toast.error('Não foi possível carregar os dados. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

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
