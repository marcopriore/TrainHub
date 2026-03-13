'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { Building2, Users, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { exportReportToExcel } from '@/lib/excel-utils'

const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const COR_PARCEIRO = '#3b82f6'
const COR_COLABORADOR = '#00C9A7'
const COR_SATISFACAO = '#f59e0b'
const COR_APROVACAO = '#22c55e'

interface Treinamento {
  id: string
  tipo: string
  carga_horaria: number
  data_treinamento: string
  indice_satisfacao: number | null
  indice_aprovacao: number | null
  empresa_parceira_id: string | null
  empresas_parceiras: { nome: string } | null
}

interface TreinamentoColaboradorRow {
  treinamento_id: string
  colaborador_id: string
  treinamentos: { carga_horaria: number; data_treinamento: string; indice_satisfacao: number | null; indice_aprovacao: number | null }
  colaboradores: { nome: string; setor_id: string | null; setores: { nome: string } | null }
}

function getUltimoAno() {
  const hoje = new Date()
  const fim = hoje.toISOString().slice(0, 10)
  const inicio = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10)
  return { inicio, fim }
}

function getMesesNoPeriodo(dataInicio: string, dataFim: string) {
  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  const meses: { mes: string; mesNum: number; ano: number; key: string }[] = []
  const current = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
  while (current <= fim) {
    meses.push({
      mes: `${MESES_PT[current.getMonth()]}/${String(current.getFullYear()).slice(-2)}`,
      mesNum: current.getMonth(),
      ano: current.getFullYear(),
      key: `${current.getFullYear()}-${current.getMonth()}`,
    })
    current.setMonth(current.getMonth() + 1)
  }
  return meses
}

export default function RelatoriosPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canView = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('visualizar_relatorios')
  const canExport = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('exportar_excel')
  const activeTenantId = getActiveTenantId()
  const { inicio: defaultInicio, fim: defaultFim } = getUltimoAno()
  const [dataInicio, setDataInicio] = useState(defaultInicio)
  const [dataFim, setDataFim] = useState(defaultFim)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [appliedFilters, setAppliedFilters] = useState({ dataInicio: defaultInicio, dataFim: defaultFim, filtroTipo: 'todos' })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([])
  const [tcData, setTcData] = useState<TreinamentoColaboradorRow[]>([])
  const supabase = createClient()

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      if (!activeTenantId) {
        setTreinamentos([])
        setTcData([])
        setLoading(false)
        return
      }
      if (user?.isMaster() || user?.isAdmin?.()) {
        let query = supabase
          .from('treinamentos')
          .select('id, tipo, carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao, empresa_parceira_id, empresas_parceiras(nome)')
          .eq('tenant_id', activeTenantId)
          .gte('data_treinamento', appliedFilters.dataInicio)
          .lte('data_treinamento', appliedFilters.dataFim)

        if (appliedFilters.filtroTipo !== 'todos') {
          query = query.eq('tipo', appliedFilters.filtroTipo)
        }

        const { data: trData, error: trErr } = await query.order('data_treinamento', { ascending: true })
        if (trErr) throw trErr
        setTreinamentos((trData as Treinamento[]) ?? [])

        const { data: tcRes, error: tcErr } = await supabase
          .from('treinamento_colaboradores')
          .select(`
            treinamento_id,
            colaborador_id,
            treinamentos(carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao),
            colaboradores(nome, setor_id, setores(nome))
          `)
        if (tcErr) throw tcErr

        const tcList = (tcRes as TreinamentoColaboradorRow[]) ?? []
        const trIds = new Set((trData as Treinamento[])?.map((t) => t.id) ?? [])
        const filtered = tcList.filter((tc) => trIds.has(tc.treinamento_id))
        setTcData(filtered)
        return
      }

      const userEmail = user?.email
      if (!userEmail) {
        setTreinamentos([])
        setTcData([])
        return
      }

      const { data: colData, error: colError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('tenant_id', activeTenantId)
        .eq('email', userEmail)
        .single()
      if (colError || !colData) {
        setTreinamentos([])
        setTcData([])
        return
      }

      const colaboradorId = (colData as { id: string }).id
      const { data: tcIdsRes, error: tcIdsErr } = await supabase
        .from('treinamento_colaboradores')
        .select('treinamento_id')
        .eq('colaborador_id', colaboradorId)
      if (tcIdsErr) throw tcIdsErr
      const ids = (tcIdsRes ?? []).map((r: { treinamento_id: string }) => r.treinamento_id)
      if (ids.length === 0) {
        setTreinamentos([])
        setTcData([])
        return
      }

      let query = supabase
        .from('treinamentos')
        .select('id, tipo, carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao, empresa_parceira_id, empresas_parceiras(nome)')
        .in('id', ids)
        .gte('data_treinamento', appliedFilters.dataInicio)
        .lte('data_treinamento', appliedFilters.dataFim)
      if (appliedFilters.filtroTipo !== 'todos') {
        query = query.eq('tipo', appliedFilters.filtroTipo)
      }
      const { data: trData, error: trErr } = await query.order('data_treinamento', { ascending: true })
      if (trErr) throw trErr
      setTreinamentos((trData as Treinamento[]) ?? [])

      const trIds = new Set((trData as Treinamento[])?.map((t) => t.id) ?? [])
      const { data: tcRes, error: tcErr } = await supabase
        .from('treinamento_colaboradores')
        .select(`
          treinamento_id,
          colaborador_id,
          treinamentos(carga_horaria, data_treinamento, indice_satisfacao, indice_aprovacao),
          colaboradores(nome, setor_id, setores(nome))
        `)
        .eq('colaborador_id', colaboradorId)
        .in('treinamento_id', Array.from(trIds))
      if (tcErr) throw tcErr
      setTcData((tcRes as TreinamentoColaboradorRow[]) ?? [])
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error)
      toast.error('Não foi possível carregar os dados. Tente novamente.')
      setTreinamentos([])
      setTcData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard')
  }, [user, canView, router])

  useEffect(() => {
    if (!activeTenantId) {
      setTreinamentos([])
      setTcData([])
      setLoading(false)
      return
    }

    fetchData()

    const channel = supabase
      .channel('treinamentos-relatorios')
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

    const pollMs = 15_000
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true)
      }
    }, pollMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [appliedFilters, activeTenantId])

  const handleAplicarFiltros = () => {
    setAppliedFilters({ dataInicio, dataFim, filtroTipo })
  }

  const handleLimparFiltros = () => {
    const { inicio, fim } = getUltimoAno()
    setDataInicio(inicio)
    setDataFim(fim)
    setFiltroTipo('todos')
    setAppliedFilters({ dataInicio: inicio, dataFim: fim, filtroTipo: 'todos' })
  }

  const meses = useMemo(
    () => getMesesNoPeriodo(appliedFilters.dataInicio, appliedFilters.dataFim),
    [appliedFilters.dataInicio, appliedFilters.dataFim]
  )

  const horasPorPeriodo = useMemo(() => {
    return meses.map(({ mes, mesNum, ano }) => {
      const doMes = treinamentos.filter((t) => {
        const d = new Date(t.data_treinamento)
        return d.getMonth() === mesNum && d.getFullYear() === ano
      })
      const parceiro = doMes.filter((t) => t.tipo === 'parceiro').reduce((a, t) => a + (t.carga_horaria ?? 0), 0)
      const colaborador = doMes.filter((t) => t.tipo === 'colaborador').reduce((a, t) => a + (t.carga_horaria ?? 0), 0)
      return { mes, Parceiro: parceiro, Colaborador: colaborador }
    })
  }, [treinamentos, meses])

  const horasPorEmpresa = useMemo(() => {
    const map = new Map<string, { horas: number; qtd: number }>()
    for (const t of treinamentos) {
      const nome = t.empresas_parceiras?.nome ?? 'Sem empresa'
      const cur = map.get(nome) ?? { horas: 0, qtd: 0 }
      cur.horas += t.carga_horaria ?? 0
      cur.qtd += 1
      map.set(nome, cur)
    }
    return Array.from(map.entries())
      .map(([empresa, v]) => ({ empresa, totalHoras: v.horas, qtdTreinamentos: v.qtd }))
      .sort((a, b) => b.totalHoras - a.totalHoras)
  }, [treinamentos])

  const horasPorSetor = useMemo(() => {
    const map = new Map<string, { horas: number; treinamentosIds: Set<string> }>()
    for (const tc of tcData) {
      const setorNome = tc.colaboradores?.setores?.nome ?? 'Sem setor'
      const carga = tc.treinamentos?.carga_horaria ?? 0
      const tid = tc.treinamento_id
      const cur = map.get(setorNome) ?? { horas: 0, treinamentosIds: new Set<string>() }
      if (!cur.treinamentosIds.has(tid)) {
        cur.treinamentosIds.add(tid)
        cur.horas += carga
      }
      map.set(setorNome, cur)
    }
    return Array.from(map.entries())
      .map(([setor, v]) => ({ setor, totalHoras: v.horas, qtdTreinamentos: v.treinamentosIds.size }))
      .sort((a, b) => b.totalHoras - a.totalHoras)
  }, [tcData])

  const indicesPorMes = useMemo(() => {
    return meses.map(({ mes, mesNum, ano }) => {
      const doMes = treinamentos.filter((t) => {
        const d = new Date(t.data_treinamento)
        return d.getMonth() === mesNum && d.getFullYear() === ano
      })
      const comSat = doMes.filter((t) => t.indice_satisfacao != null)
      const comAprov = doMes.filter((t) => t.indice_aprovacao != null)
      const mediaSat = comSat.length
        ? comSat.reduce((a, t) => a + (t.indice_satisfacao ?? 0), 0) / comSat.length
        : null
      const mediaAprov = comAprov.length
        ? comAprov.reduce((a, t) => a + (t.indice_aprovacao ?? 0), 0) / comAprov.length
        : null
      return {
        mes,
        mediaSatisfacao: mediaSat != null ? Number(mediaSat.toFixed(1)) : null,
        mediaAprovacao: mediaAprov != null ? Number(mediaAprov.toFixed(1)) : null,
      }
    })
  }, [treinamentos, meses])

  const rankingColaboradores = useMemo(() => {
    const map = new Map<string, { nome: string; setor: string; horas: number; qtd: number }>()
    for (const tc of tcData) {
      const id = tc.colaborador_id
      const nome = tc.colaboradores?.nome ?? '—'
      const setor = tc.colaboradores?.setores?.nome ?? '—'
      const carga = tc.treinamentos?.carga_horaria ?? 0
      const cur = map.get(id) ?? { nome, setor, horas: 0, qtd: 0 }
      cur.horas += carga
      cur.qtd += 1
      map.set(id, cur)
    }
    return Array.from(map.entries())
      .map(([_, v]) => v)
      .sort((a, b) => b.horas - a.horas)
      .map((r, i) => ({ posicao: i + 1, ...r }))
  }, [tcData])

  const rankingEmpresas = useMemo(() => {
    const map = new Map<string, { qtd: number; horas: number; sat: number[]; aprov: number[] }>()
    for (const t of treinamentos) {
      const nome = t.empresas_parceiras?.nome ?? 'Sem empresa'
      const cur = map.get(nome) ?? { qtd: 0, horas: 0, sat: [], aprov: [] }
      cur.qtd += 1
      cur.horas += t.carga_horaria ?? 0
      if (t.indice_satisfacao != null) cur.sat.push(t.indice_satisfacao)
      if (t.indice_aprovacao != null) cur.aprov.push(t.indice_aprovacao)
      map.set(nome, cur)
    }
    return Array.from(map.entries())
      .map(([empresa, v]) => ({
        posicao: 0,
        empresa,
        qtdTreinamentos: v.qtd,
        totalHoras: v.horas,
        mediaSatisfacao: v.sat.length ? Number((v.sat.reduce((a, b) => a + b, 0) / v.sat.length).toFixed(1)) : null,
        mediaAprovacao: v.aprov.length ? Number((v.aprov.reduce((a, b) => a + b, 0) / v.aprov.length).toFixed(1)) : null,
      }))
      .sort((a, b) => b.totalHoras - a.totalHoras)
      .map((r, i) => ({ ...r, posicao: i + 1 }))
  }, [treinamentos])

  const handleExportarExcel = () => {
    setExporting(true)
    try {
      const horasPeriodoData = horasPorPeriodo.map((r) => ({
        mes: r.mes,
        horasParceiro: r.Parceiro,
        horasColaborador: r.Colaborador,
      }))
      const horasEmpresaData = horasPorEmpresa.map((r) => ({
        empresa: r.empresa,
        totalHoras: r.totalHoras,
        qtdTreinamentos: r.qtdTreinamentos,
      }))
      const horasSetorData = horasPorSetor.map((r) => ({
        setor: r.setor,
        totalHoras: r.totalHoras,
        qtdTreinamentos: r.qtdTreinamentos,
      }))
      const indicesData = indicesPorMes.map((r) => ({
        mes: r.mes,
        mediaSatisfacao: r.mediaSatisfacao ?? '',
        mediaAprovacao: r.mediaAprovacao ?? '',
      }))
      const rankingColabData = rankingColaboradores.map((r) => ({
        posicao: r.posicao,
        nome: r.nome,
        setor: r.setor,
        qtdTreinamentos: r.qtd,
        totalHoras: r.horas,
      }))
      const rankingEmpData = rankingEmpresas.map((r) => ({
        posicao: r.posicao,
        empresa: r.empresa,
        qtdTreinamentos: r.qtdTreinamentos,
        totalHoras: r.totalHoras,
        mediaSatisfacao: r.mediaSatisfacao ?? '',
        mediaAprovacao: r.mediaAprovacao ?? '',
      }))
      exportReportToExcel([
        {
          name: 'Horas por Período',
          data: horasPeriodoData,
          headerLabels: { mes: 'Mês', horasParceiro: 'Horas Parceiro', horasColaborador: 'Horas Colaborador' },
        },
        {
          name: 'Horas por Empresa',
          data: horasEmpresaData,
          headerLabels: { empresa: 'Empresa Parceira', totalHoras: 'Total de Horas', qtdTreinamentos: 'Qtd. Treinamentos' },
        },
        {
          name: 'Horas por Setor',
          data: horasSetorData,
          headerLabels: { setor: 'Setor', totalHoras: 'Total de Horas', qtdTreinamentos: 'Qtd. Treinamentos' },
        },
        {
          name: 'Índices por Mês',
          data: indicesData,
          headerLabels: { mes: 'Mês', mediaSatisfacao: 'Média Satisfação (%)', mediaAprovacao: 'Média Aprovação (%)' },
        },
        {
          name: 'Ranking Colaboradores',
          data: rankingColabData,
          headerLabels: {
            posicao: 'Posição',
            nome: 'Nome',
            setor: 'Setor',
            qtdTreinamentos: 'Qtd. Treinamentos',
            totalHoras: 'Total de Horas',
          },
        },
        {
          name: 'Ranking Empresas',
          data: rankingEmpData,
          headerLabels: {
            posicao: 'Posição',
            empresa: 'Empresa Parceira',
            qtdTreinamentos: 'Qtd. Treinamentos',
            totalHoras: 'Total de Horas',
            mediaSatisfacao: 'Média Satisfação (%)',
            mediaAprovacao: 'Média Aprovação (%)',
          },
        },
      ])
      toast.success('Relatório exportado com sucesso.')
    } catch (error) {
      console.error('Erro ao exportar:', error)
      toast.error('Não foi possível exportar o relatório.')
    } finally {
      setExporting(false)
    }
  }

  const emptyState = (
    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm rounded-lg border border-dashed border-border">
      Nenhum dado para o período e filtros selecionados
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análise consolidada dos treinamentos
          </p>
        </div>
        {canExport && (
          <Button
            variant="outline"
            onClick={handleExportarExcel}
            disabled={exporting || loading}
            className="gap-2 shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Exportando...' : 'Exportar para Excel'}
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Data Início</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Data Fim</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="parceiro">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Parceiro
                  </span>
                </SelectItem>
                <SelectItem value="colaborador">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Colaborador
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAplicarFiltros}>Aplicar Filtros</Button>
          <Button variant="outline" onClick={handleLimparFiltros}>
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Seção 1: Horas por Período */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-serif text-base font-semibold text-foreground mb-4">
          Horas de Treinamento por Período
        </h3>
        {loading ? (
          <Skeleton className="h-[260px] w-full rounded-lg" />
        ) : horasPorPeriodo.length === 0 ? (
          emptyState
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={horasPorPeriodo} barSize={10} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="Parceiro" fill={COR_PARCEIRO} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Colaborador" fill={COR_COLABORADOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Seção 2 e 3: Horas por Empresa e por Setor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">
            Horas por Empresa Parceira
          </h3>
          {loading ? (
            <Skeleton className="h-[260px] w-full rounded-lg" />
          ) : horasPorEmpresa.length === 0 ? (
            emptyState
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={horasPorEmpresa} layout="vertical" margin={{ left: 20 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="empresa" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                  formatter={(v: number) => [`${v} horas`, 'Total']}
                />
                <Bar dataKey="totalHoras" fill={COR_PARCEIRO} radius={[0, 4, 4, 0]} name="Horas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">
            Horas por Setor
          </h3>
          {loading ? (
            <Skeleton className="h-[260px] w-full rounded-lg" />
          ) : horasPorSetor.length === 0 ? (
            emptyState
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={horasPorSetor} layout="vertical" margin={{ left: 20 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="setor" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                  formatter={(v: number) => [`${v} horas`, 'Total']}
                />
                <Bar dataKey="totalHoras" fill={COR_COLABORADOR} radius={[0, 4, 4, 0]} name="Horas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Seção 4: Índices ao Longo do Tempo */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-serif text-base font-semibold text-foreground mb-4">
          Índices ao Longo do Tempo
        </h3>
        {loading ? (
          <Skeleton className="h-[260px] w-full rounded-lg" />
        ) : indicesPorMes.length === 0 ? (
          emptyState
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={indicesPorMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="mediaSatisfacao" stroke={COR_SATISFACAO} strokeWidth={2} dot={{ r: 4 }} name="Satisfação %" />
              <Line type="monotone" dataKey="mediaAprovacao" stroke={COR_APROVACAO} strokeWidth={2} dot={{ r: 4 }} name="Aprovação %" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Seção 5: Ranking Colaboradores */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <h3 className="font-serif text-base font-semibold text-foreground p-5 pb-0">
          Ranking de Colaboradores Mais Treinados
        </h3>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ) : rankingColaboradores.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Nenhum dado para o período e filtros selecionados
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium w-16">Posição</TableHead>
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Setor</TableHead>
                <TableHead className="font-medium text-right">Qtd. Treinamentos</TableHead>
                <TableHead className="font-medium text-right">Total de Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingColaboradores.map((r) => (
                <TableRow key={r.posicao}>
                  <TableCell className="font-medium">{r.posicao}º</TableCell>
                  <TableCell>{r.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{r.setor}</TableCell>
                  <TableCell className="text-right">{r.qtd}</TableCell>
                  <TableCell className="text-right font-medium">{r.horas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Seção 6: Ranking Empresas */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <h3 className="font-serif text-base font-semibold text-foreground p-5 pb-0">
          Ranking de Empresas Parceiras
        </h3>
        {loading ? (
          <div className="p-5">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ) : rankingEmpresas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Nenhum dado para o período e filtros selecionados
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium w-16">Posição</TableHead>
                <TableHead className="font-medium">Empresa</TableHead>
                <TableHead className="font-medium text-right">Qtd. Treinamentos</TableHead>
                <TableHead className="font-medium text-right">Total de Horas</TableHead>
                <TableHead className="font-medium text-right">Média Satisfação</TableHead>
                <TableHead className="font-medium text-right">Média Aprovação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingEmpresas.map((r) => (
                <TableRow key={r.posicao}>
                  <TableCell className="font-medium">{r.posicao}º</TableCell>
                  <TableCell>{r.empresa}</TableCell>
                  <TableCell className="text-right">{r.qtdTreinamentos}</TableCell>
                  <TableCell className="text-right font-medium">{r.totalHoras}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.mediaSatisfacao != null ? `${r.mediaSatisfacao}%` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.mediaAprovacao != null ? `${r.mediaAprovacao}%` : '—'}
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
