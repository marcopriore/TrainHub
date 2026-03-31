'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check, X, GraduationCap, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { useCatalogoModuloPlataforma } from '@/lib/use-catalogo-modulo-plataforma'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type SubmissaoRow = {
  id: string
  tenant_id: string
  catalogo_local_id: string
  linhagem_id: string
  versao: number
  titulo: string
  conteudo_programatico: string | null
  objetivo: string | null
  carga_horaria: number | null
  categoria: string | null
  nivel: string | null
  modalidade: string | null
  imagem_url: string | null
  status: string
  criado_em: string
}

type GlobalPublicadoRow = {
  id: string
  linhagem_id: string
  versao: number
  titulo: string
  categoria: string | null
  origem_tenant_id: string | null
  aprovado_em: string | null
  criado_em: string
}

export default function CatalogoGlobalModeracaoPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { catalogoModuloPlataformaAtivo, loadingCatalogoPlataforma } =
    useCatalogoModuloPlataforma()
  const [rows, setRows] = useState<SubmissaoRow[]>([])
  const [publicados, setPublicados] = useState<GlobalPublicadoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<SubmissaoRow | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState('')
  const [depublishTarget, setDepublishTarget] = useState<GlobalPublicadoRow | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    if (!user?.isMaster?.()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [subRes, pubRes] = await Promise.all([
        supabase
          .from('catalogo_global_submissoes')
          .select('*')
          .eq('status', 'pendente')
          .order('criado_em', { ascending: true }),
        supabase
          .from('catalogo_treinamentos_globais')
          .select(
            'id, linhagem_id, versao, titulo, categoria, origem_tenant_id, aprovado_em, criado_em'
          )
          .eq('status', 'publicado')
          .order('titulo', { ascending: true }),
      ])

      if (subRes.error) throw subRes.error
      if (pubRes.error) throw pubRes.error
      setRows((subRes.data as SubmissaoRow[]) ?? [])
      setPublicados((pubRes.data as GlobalPublicadoRow[]) ?? [])
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar os dados.')
      setRows([])
      setPublicados([])
    } finally {
      setLoading(false)
    }
  }, [user?.isMaster])

  useEffect(() => {
    if (!userLoading && user?.isMaster?.()) load()
    if (!userLoading && !user?.isMaster?.()) setLoading(false)
  }, [userLoading, user?.isMaster, load])

  useEffect(() => {
    if (userLoading || loadingCatalogoPlataforma) return
    if (catalogoModuloPlataformaAtivo) return
    toast.info('O módulo Catálogo de Treinamentos está desativado na plataforma.')
    if (user?.isMaster?.()) {
      router.replace('/dashboard/configuracoes/plataforma')
    } else {
      router.replace('/dashboard/configuracoes')
    }
  }, [
    userLoading,
    loadingCatalogoPlataforma,
    catalogoModuloPlataformaAtivo,
    user?.isMaster,
    router,
  ])

  const aprovar = async (sub: SubmissaoRow) => {
    if (!user?.id) return
    setActionId(sub.id)
    const agora = new Date().toISOString()
    try {
      const { error: depublishErr } = await supabase
        .from('catalogo_treinamentos_globais')
        .update({
          status: 'despublicado',
          despublicado_por: user.id,
          despublicado_em: agora,
        })
        .eq('linhagem_id', sub.linhagem_id)
        .eq('status', 'publicado')

      if (depublishErr) throw depublishErr

      const { error: insErr } = await supabase.from('catalogo_treinamentos_globais').insert({
        linhagem_id: sub.linhagem_id,
        versao: sub.versao,
        titulo: sub.titulo,
        conteudo_programatico: sub.conteudo_programatico,
        objetivo: sub.objetivo,
        carga_horaria: sub.carga_horaria,
        categoria: sub.categoria,
        nivel: sub.nivel,
        modalidade: sub.modalidade,
        imagem_url: sub.imagem_url,
        status: 'publicado',
        origem_tenant_id: sub.tenant_id,
        origem_catalogo_id: sub.catalogo_local_id,
        submissao_id: sub.id,
        aprovado_por: user.id,
        aprovado_em: agora,
      })

      if (insErr) throw insErr

      const { error: upSub } = await supabase
        .from('catalogo_global_submissoes')
        .update({
          status: 'aprovado',
          revisado_por: user.id,
          revisado_em: agora,
        })
        .eq('id', sub.id)

      if (upSub) throw upSub

      await supabase.from('auditoria_eventos').insert({
        ator_id: user.id,
        tenant_id: sub.tenant_id,
        acao: 'aprovar_catalogo_global',
        entidade: 'catalogo_global_submissao',
        entidade_id: sub.id,
        detalhes: { linhagem_id: sub.linhagem_id, versao: sub.versao, titulo: sub.titulo },
      })

      toast.success('Publicado no catálogo global.')
      await load()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível aprovar. Verifique os dados ou tente de novo.')
    } finally {
      setActionId(null)
    }
  }

  const confirmarReprovar = async () => {
    if (!rejectTarget || !user?.id) return
    const m = rejectMotivo.trim()
    if (!m) {
      toast.error('Informe o motivo da reprovação.')
      return
    }
    setActionId(rejectTarget.id)
    const agora = new Date().toISOString()
    try {
      const { error } = await supabase
        .from('catalogo_global_submissoes')
        .update({
          status: 'reprovado',
          revisado_por: user.id,
          revisado_em: agora,
          motivo_reprovacao: m,
        })
        .eq('id', rejectTarget.id)

      if (error) throw error

      await supabase.from('auditoria_eventos').insert({
        ator_id: user.id,
        tenant_id: rejectTarget.tenant_id,
        acao: 'reprovar_catalogo_global',
        entidade: 'catalogo_global_submissao',
        entidade_id: rejectTarget.id,
        detalhes: { motivo: m },
      })

      toast.success('Submissão reprovada.')
      setRejectOpen(false)
      setRejectTarget(null)
      setRejectMotivo('')
      await load()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível reprovar.')
    } finally {
      setActionId(null)
    }
  }

  const confirmarDespublicar = async () => {
    if (!depublishTarget || !user?.id) return
    setActionId(`depub-${depublishTarget.id}`)
    const agora = new Date().toISOString()
    try {
      const { error } = await supabase
        .from('catalogo_treinamentos_globais')
        .update({
          status: 'despublicado',
          despublicado_por: user.id,
          despublicado_em: agora,
        })
        .eq('id', depublishTarget.id)
        .eq('status', 'publicado')

      if (error) throw error

      await supabase.from('auditoria_eventos').insert({
        ator_id: user.id,
        tenant_id: depublishTarget.origem_tenant_id,
        acao: 'despublicar_catalogo_global',
        entidade: 'catalogo_treinamentos_globais',
        entidade_id: depublishTarget.id,
        detalhes: {
          titulo: depublishTarget.titulo,
          linhagem_id: depublishTarget.linhagem_id,
          versao: depublishTarget.versao,
        },
      })

      toast.success('Item retirado do catálogo global.')
      setDepublishTarget(null)
      await load()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível despublicar.')
    } finally {
      setActionId(null)
    }
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-10 w-64" />
      </div>
    )
  }

  if (!user?.isMaster?.()) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar h-16 flex items-center justify-between px-6 border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-white tracking-tight">TrainHub</span>
          <Link
            href="/dashboard/configuracoes"
            className="ml-4 inline-flex items-center gap-1 text-sm text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/40 px-2 py-1 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Configurações
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-serif text-2xl font-bold text-foreground">Catálogo global — moderação</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Fila de itens ativos enviados pelos tenants com consentimento. Publicar substitui versões
          anteriores do mesmo programa (mesma linhagem) na vitrine global.
        </p>

        <div className="mt-8 rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">Nenhuma submissão pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.titulo}</TableCell>
                    <TableCell>{r.categoria ?? '—'}</TableCell>
                    <TableCell>{r.versao}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.criado_em).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                        disabled={actionId !== null}
                        onClick={() => aprovar(r)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionId !== null}
                        onClick={() => {
                          setRejectTarget(r)
                          setRejectMotivo('')
                          setRejectOpen(true)
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reprovar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <h2 className="font-serif text-xl font-bold text-foreground mt-12 mb-1">
          Publicados no global agora
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Itens visíveis na vitrine (para tenants com opt-in na categoria). Use para retirar um programa
          imediatamente, sem nova submissão.
        </p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : publicados.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">Nenhum treinamento publicado no global no momento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead className="hidden lg:table-cell">Linhagem</TableHead>
                  <TableHead className="hidden md:table-cell">Aprovado em</TableHead>
                  <TableHead className="text-right w-[140px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publicados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-[14rem]">
                      <span className="line-clamp-2">{p.titulo}</span>
                    </TableCell>
                    <TableCell>{p.categoria ?? '—'}</TableCell>
                    <TableCell>{p.versao}</TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                      {p.linhagem_id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {p.aprovado_em
                        ? new Date(p.aprovado_em).toLocaleString('pt-BR')
                        : new Date(p.criado_em).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={actionId !== null}
                        onClick={() => setDepublishTarget(p)}
                      >
                        <EyeOff className="w-4 h-4 mr-1" />
                        Despublicar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      <AlertDialog
        open={depublishTarget !== null}
        onOpenChange={(open) => !open && setDepublishTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar do catálogo global?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">{depublishTarget?.titulo}</strong> deixará de aparecer
                  nas vitrines dos clientes (conforme opt-in por categoria). Cópias já importadas no catálogo
                  local dos tenants <strong className="text-foreground">não</strong> são apagadas.
                </p>
                <p>Versão {depublishTarget?.versao} · linhagem {depublishTarget?.linhagem_id.slice(0, 8)}…</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionId !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionId !== null}
              onClick={(e) => {
                e.preventDefault()
                void confirmarDespublicar()
              }}
            >
              Confirmar despublicação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar submissão</DialogTitle>
            <DialogDescription>O tenant verá o status reprovado; descreva o motivo com clareza.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
              placeholder="Ex.: categoria incorreta, texto com dados pessoais..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={actionId !== null} onClick={confirmarReprovar}>
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
