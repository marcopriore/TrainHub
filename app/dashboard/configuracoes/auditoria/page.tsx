'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, GraduationCap, LogOut, ScrollText } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { auditoriaEventosFiltrados } from '@/lib/auditoria-query'
import { rotuloAcaoAuditoria, rotuloEntidadeAuditoria } from '@/lib/auditoria-rotulos'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const PAGE_SIZE = 25
const EXPORT_BATCH = 1000
const EXPORT_MAX_ROWS = 25_000

type AuditoriaRow = {
  id: string
  ator_id: string | null
  tenant_id: string | null
  acao: string
  entidade: string
  entidade_id: string | null
  detalhes: Record<string, unknown> | null
  criado_em: string
}

type FiltrosAuditoria = {
  busca: string
  acaoContem: string
  dataInicio: string
  dataFim: string
}

const filtrosVazios = (): FiltrosAuditoria => ({
  busca: '',
  acaoContem: '',
  dataInicio: '',
  dataFim: '',
})

export default function AuditoriaPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [rows, setRows] = useState<AuditoriaRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<FiltrosAuditoria>(filtrosVazios)
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(filtrosVazios)
  const [atorNomes, setAtorNomes] = useState<Record<string, string>>({})
  const [tenantNomes, setTenantNomes] = useState<Record<string, string>>({})
  const [detalheJson, setDetalheJson] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  const carregar = useCallback(async () => {
    if (!user?.isMaster?.()) return
    setLoading(true)
    const supabase = createClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      const q = auditoriaEventosFiltrados(supabase, aplicados, 'exact')
        .order('criado_em', { ascending: false })
        .range(from, to)

      const { data, error, count } = await q

      if (error) throw error

      const list = (data as AuditoriaRow[]) ?? []
      setRows(list)
      setTotal(count ?? 0)

      const atorIds = [...new Set(list.map((r) => r.ator_id).filter(Boolean))] as string[]
      const tenantIds = [...new Set(list.map((r) => r.tenant_id).filter(Boolean))] as string[]

      const [uRes, tRes] = await Promise.all([
        atorIds.length
          ? supabase.from('usuarios').select('id, nome').in('id', atorIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
        tenantIds.length
          ? supabase.from('tenants').select('id, nome').in('id', tenantIds)
          : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      ])

      const am: Record<string, string> = {}
      for (const u of uRes.data ?? []) am[u.id] = u.nome ?? u.id
      const tm: Record<string, string> = {}
      for (const t of tRes.data ?? []) tm[t.id] = t.nome ?? t.id
      setAtorNomes(am)
      setTenantNomes(tm)
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar a auditoria.')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [user?.id, page, aplicados])

  useEffect(() => {
    if (userLoading || !user) return
    if (!user.isMaster?.()) {
      router.replace('/dashboard/configuracoes')
      return
    }
    void carregar()
  }, [user, userLoading, router, carregar])

  const aplicarFiltros = () => {
    setPage(0)
    setAplicados({ ...draft })
  }

  const limparFiltros = () => {
    const z = filtrosVazios()
    setDraft(z)
    setAplicados(z)
    setPage(0)
  }

  const formatarData = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    } catch {
      return iso
    }
  }

  const exportarExcel = async () => {
    if (!user?.isMaster?.() || total <= 0) return
    setExportando(true)
    const supabase = createClient()
    try {
      const todas: AuditoriaRow[] = []
      let offset = 0
      while (offset < EXPORT_MAX_ROWS) {
        const { data, error } = await auditoriaEventosFiltrados(supabase, aplicados)
          .order('criado_em', { ascending: false })
          .range(offset, offset + EXPORT_BATCH - 1)
        if (error) throw error
        const batch = (data as AuditoriaRow[]) ?? []
        todas.push(...batch)
        if (batch.length < EXPORT_BATCH) break
        offset += EXPORT_BATCH
      }
      if (todas.length >= EXPORT_MAX_ROWS) {
        toast.warning(
          `Exportação limitada a ${EXPORT_MAX_ROWS.toLocaleString('pt-BR')} linhas. Aplique filtros mais restritos para menos dados.`
        )
      }

      const atorIds = [...new Set(todas.map((r) => r.ator_id).filter(Boolean))] as string[]
      const tenantIds = [...new Set(todas.map((r) => r.tenant_id).filter(Boolean))] as string[]
      const am: Record<string, string> = {}
      const tm: Record<string, string> = {}
      const chunk = 200
      for (let i = 0; i < atorIds.length; i += chunk) {
        const slice = atorIds.slice(i, i + chunk)
        const { data } = await supabase.from('usuarios').select('id, nome').in('id', slice)
        for (const u of data ?? []) am[u.id] = u.nome ?? u.id
      }
      for (let i = 0; i < tenantIds.length; i += chunk) {
        const slice = tenantIds.slice(i, i + chunk)
        const { data } = await supabase.from('tenants').select('id, nome').in('id', slice)
        for (const t of data ?? []) tm[t.id] = t.nome ?? t.id
      }

      const XLSX = await import('xlsx')
      const linhas = todas.map((r) => ({
        'Data e hora': formatarData(r.criado_em),
        Descrição: rotuloAcaoAuditoria(r.acao),
        'Ação (código)': r.acao,
        Entidade: rotuloEntidadeAuditoria(r.entidade),
        'Tabela': r.entidade,
        'ID registro': r.entidade_id ?? '',
        Organização: r.tenant_id ? (tm[r.tenant_id] ?? r.tenant_id) : '',
        Executor: r.ator_id ? (am[r.ator_id] ?? r.ator_id) : '',
        Detalhes: r.detalhes ? JSON.stringify(r.detalhes) : '',
      }))
      const ws = XLSX.utils.json_to_sheet(linhas)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Auditoria')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_')
      XLSX.writeFile(wb, `auditoria_trainhub_${stamp}.xlsx`)
      toast.success(`Planilha com ${todas.length} evento(s) gerada.`)
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível exportar a auditoria.')
    } finally {
      setExportando(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-10 w-64" />
      </div>
    )
  }

  if (!user.isMaster?.()) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar h-16 flex items-center justify-between px-6 border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-white tracking-tight hidden sm:inline">
            TrainHub
          </span>
          <Link
            href="/dashboard/configuracoes"
            className="ml-1 sm:ml-4 inline-flex items-center gap-1 text-sm text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/40 px-2 py-1 rounded-md transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Configurações</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/perfil"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">{initials}</span>
            </div>
          </Link>
          <NotificacoesSino variant="compact" />
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#64748b1a', color: '#64748b' }}
          >
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Log de auditoria</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Inclui <strong className="text-foreground font-medium">login</strong>, alterações em dados
              (treinamentos, categorias, setores, empresas, catálogo, templates, pesquisas, avaliações,
              respostas, etc.) via triggers no banco, além de{' '}
              <strong className="text-foreground font-medium">importação de planilha</strong> agregada.
              Somente Master visualiza.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 lg:items-end">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Buscar (ação, entidade ou ID)</Label>
              <Input
                placeholder="Ex.: reprovar, submissao, uuid…"
                value={draft.busca}
                onChange={(e) => setDraft((d) => ({ ...d, busca: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-52">
              <Label className="text-xs text-muted-foreground">Ação contém</Label>
              <Input
                placeholder="login, insert_, update_treinamentos…"
                value={draft.acaoContem}
                onChange={(e) => setDraft((d) => ({ ...d, acaoContem: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-40">
              <Label className="text-xs text-muted-foreground">De (data)</Label>
              <Input
                type="date"
                value={draft.dataInicio}
                onChange={(e) => setDraft((d) => ({ ...d, dataInicio: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-40">
              <Label className="text-xs text-muted-foreground">Até (data)</Label>
              <Input
                type="date"
                value={draft.dataFim}
                onChange={(e) => setDraft((d) => ({ ...d, dataFim: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="bg-[#00C9A7] hover:bg-[#00C9A7]/90" onClick={aplicarFiltros}>
                Aplicar filtros
              </Button>
              <Button type="button" variant="outline" onClick={limparFiltros}>
                Limpar
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={total <= 0 || loading || exportando}
                onClick={() => void exportarExcel()}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {exportando ? 'Exportando…' : 'Exportar Excel'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">
              Nenhum evento encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Quando</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead className="hidden md:table-cell">ID entidade</TableHead>
                    <TableHead className="hidden lg:table-cell">Tenant</TableHead>
                    <TableHead className="hidden lg:table-cell">Executor</TableHead>
                    <TableHead className="text-right w-[100px]">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatarData(r.criado_em)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px]">
                        <span className="line-clamp-2 text-sm" title={r.acao}>
                          {rotuloAcaoAuditoria(r.acao)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate block" title={r.acao}>
                          {r.acao}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span title={r.entidade}>{rotuloEntidadeAuditoria(r.entidade)}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs max-w-[140px] truncate">
                        {r.entidade_id ?? '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {r.tenant_id
                          ? (tenantNomes[r.tenant_id] ?? `${r.tenant_id.slice(0, 8)}…`)
                          : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {r.ator_id
                          ? (atorNomes[r.ator_id] ?? `${r.ator_id.slice(0, 8)}…`)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[#00C9A7]"
                          disabled={!r.detalhes || Object.keys(r.detalhes).length === 0}
                          onClick={() =>
                            setDetalheJson(
                              r.detalhes ? JSON.stringify(r.detalhes, null, 2) : null
                            )
                          }
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!loading && total > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {total} evento(s) · Página {page + 1} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!detalheJson} onOpenChange={(o) => !o && setDetalheJson(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Detalhes do evento</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {detalheJson}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
