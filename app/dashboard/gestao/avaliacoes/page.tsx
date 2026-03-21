'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Settings, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
interface AvaliacaoFormulario {
  id: string
  tenant_id: string
  treinamento_id: string
  titulo: string
  descricao: string | null
  nota_minima: number
  ativo: boolean
  criado_em: string
  treinamentos: { codigo: string; nome: string } | null
}

export default function AvaliacoesPage() {
  const { user, getActiveTenantId } = useUser()
  const canManage =
    user?.isMaster?.() ||
    user?.isAdmin?.() ||
    user?.hasPermission?.('gerenciar_avaliacoes')
  const activeTenantId = getActiveTenantId()

  const [formularios, setFormularios] = useState<AvaliacaoFormulario[]>([])
  const [perguntasCount, setPerguntasCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingFormulario, setEditingFormulario] = useState<AvaliacaoFormulario | null>(null)
  const [formularioToDelete, setFormularioToDelete] = useState<AvaliacaoFormulario | null>(null)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [notaMinima, setNotaMinima] = useState(70)
  const [submitting, setSubmitting] = useState(false)

  const [dispararDialogOpen, setDispararDialogOpen] = useState(false)
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState<AvaliacaoFormulario | null>(null)
  const [disparando, setDisparando] = useState(false)

  const supabase = createClient()

  const fetchFormularios = async () => {
    if (!activeTenantId) {
      setFormularios([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('avaliacao_formularios')
        .select('*, treinamentos(codigo, nome)')
        .eq('tenant_id', activeTenantId)
        .order('criado_em', { ascending: false })

      if (error) throw error
      const list = (data as unknown as AvaliacaoFormulario[]) ?? []
      setFormularios(list)

      if (list.length === 0) {
        setPerguntasCount({})
        return
      }

      const ids = list.map((f) => f.id)
      const { data: perguntasData } = await supabase
        .from('avaliacao_perguntas')
        .select('formulario_id')
        .in('formulario_id', ids)
      const countByForm: Record<string, number> = {}
      ids.forEach((id) => (countByForm[id] = 0))
      ;(perguntasData ?? []).forEach((p: { formulario_id: string }) => {
        countByForm[p.formulario_id] = (countByForm[p.formulario_id] ?? 0) + 1
      })
      setPerguntasCount(countByForm)
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error)
      toast.error('Não foi possível carregar as avaliações. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeTenantId || !user) return
    fetchFormularios()
  }, [activeTenantId, user?.id])

  const openEditSheet = (f: AvaliacaoFormulario) => {
    setEditingFormulario(f)
    setTitulo(f.titulo ?? '')
    setDescricao(f.descricao ?? '')
    setNotaMinima(f.nota_minima ?? 70)
    setEditSheetOpen(true)
  }

  const closeEditSheet = () => {
    setEditSheetOpen(false)
    setEditingFormulario(null)
    setTitulo('')
    setDescricao('')
    setNotaMinima(70)
  }

  const handleSaveEdit = async () => {
    if (!editingFormulario) return
    const tituloTrimmed = titulo.trim()
    if (!tituloTrimmed) {
      toast.error('Informe o título da avaliação.')
      return
    }

    const nota = Number(notaMinima)
    if (isNaN(nota) || nota < 0 || nota > 100) {
      toast.error('Nota mínima deve ser entre 0 e 100.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('avaliacao_formularios')
        .update({
          titulo: tituloTrimmed,
          descricao: descricao.trim() || null,
          nota_minima: nota,
        })
        .eq('id', editingFormulario.id)
      if (error) throw error
      toast.success('Avaliação atualizada com sucesso.')
      closeEditSheet()
      fetchFormularios()
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error)
      toast.error('Não foi possível salvar a avaliação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (f: AvaliacaoFormulario) => {
    if (!canManage) return
    const next = !f.ativo
    try {
      const { error } = await supabase
        .from('avaliacao_formularios')
        .update({ ativo: next })
        .eq('id', f.id)
      if (error) throw error
      toast.success(next ? 'Avaliação ativada.' : 'Avaliação inativada.')
      fetchFormularios()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Não foi possível atualizar o status.')
    }
  }

  const openDeleteDialog = (f: AvaliacaoFormulario) => {
    setFormularioToDelete(f)
    setDeleteDialogOpen(true)
  }

  const openDispararDialog = (f: AvaliacaoFormulario) => {
    setAvaliacaoSelecionada(f)
    setDispararDialogOpen(true)
  }

  const handleDisparar = async () => {
    if (!avaliacaoSelecionada || !activeTenantId) return
    setDisparando(true)
    try {
      const res = await fetch('/api/avaliacao/disparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treinamento_id: avaliacaoSelecionada.treinamento_id,
          tenant_id: activeTenantId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao disparar avaliação.')
        return
      }
      toast.success(
        `E-mails enviados: ${data.enviados}. Já existiam: ${data.jaExistiam}.`
      )
      setDispararDialogOpen(false)
    } catch {
      toast.error('Erro ao conectar com o servidor.')
    } finally {
      setDisparando(false)
    }
  }

  const handleDelete = async () => {
    if (!formularioToDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('avaliacao_formularios')
        .delete()
        .eq('id', formularioToDelete.id)
      if (error) throw error
      toast.success('Avaliação excluída com sucesso.')
      setDeleteDialogOpen(false)
      setFormularioToDelete(null)
      fetchFormularios()
    } catch (error) {
      console.error('Erro ao excluir avaliação:', error)
      toast.error('Não foi possível excluir a avaliação.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Avaliações</h1>
        <p className="text-muted-foreground text-sm">
          Você não tem permissão para gerenciar avaliações.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Avaliações</h1>
          <p className="text-muted-foreground text-sm mt-1">Formulários de Avaliação</p>
        </div>
        <Button asChild className="w-full sm:w-auto shrink-0 bg-[#00C9A7] hover:bg-[#00C9A7]/90">
          <Link href="/dashboard/gestao/avaliacoes/nova">
            <Plus className="w-4 h-4" />
            Nova Avaliação
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : formularios.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Nenhuma avaliação cadastrada. Clique em &quot;Nova Avaliação&quot; para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Treinamento</TableHead>
                <TableHead className="font-medium">Título</TableHead>
                <TableHead className="font-medium w-28">Nota Mínima</TableHead>
                <TableHead className="font-medium text-right w-24">Perguntas</TableHead>
                <TableHead className="font-medium w-24">Status</TableHead>
                <TableHead className="font-medium w-[220px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formularios.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    {f.treinamentos?.nome ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium">{f.titulo}</TableCell>
                  <TableCell>{f.nota_minima}%</TableCell>
                  <TableCell className="text-right">
                    {perguntasCount[f.id] ?? 0}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={f.ativo}
                      onCheckedChange={() => handleToggleStatus(f)}
                      aria-label={f.ativo ? 'Inativar' : 'Ativar'}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDispararDialog(f)}
                              className="gap-1"
                            >
                              <Send className="w-4 h-4" />
                              Disparar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Disparar avaliação por e-mail</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="sm" asChild className="gap-1">
                        <Link href={`/dashboard/gestao/avaliacoes/${f.id}`}>
                          <Settings className="w-4 h-4" />
                          Editar perguntas
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditSheet(f)}
                        className="gap-1"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(f)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet open={editSheetOpen} onOpenChange={(o) => { setEditSheetOpen(o); if (!o) closeEditSheet() }}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-serif">Editar Avaliação</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="av-titulo">Título *</Label>
              <Input
                id="av-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Avaliação de Conhecimento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="av-descricao">Descrição</Label>
              <Textarea
                id="av-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição opcional"
                className="min-h-[80px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="av-nota">Nota Mínima (%)</Label>
              <Input
                id="av-nota"
                type="number"
                min={0}
                max={100}
                value={notaMinima}
                onChange={(e) => setNotaMinima(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={closeEditSheet} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={submitting} className="bg-[#00C9A7] hover:bg-[#00C9A7]/90">
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={dispararDialogOpen} onOpenChange={setDispararDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar Avaliação por E-mail</DialogTitle>
            <DialogDescription>
              Isso irá enviar um e-mail com o link da avaliação para todos os
              participantes do treinamento que ainda não receberam.
              Participantes que já receberam não serão notificados novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded p-3 text-sm">
            <p>
              <strong>Avaliação:</strong> {avaliacaoSelecionada?.titulo}
            </p>
            <p>
              <strong>Treinamento:</strong> {avaliacaoSelecionada?.treinamentos?.nome ?? '—'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispararDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDisparar}
              disabled={disparando}
              className="bg-[#00C9A7] hover:bg-[#00C9A7]/90 text-white"
            >
              {disparando ? 'Enviando...' : 'Confirmar e Disparar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a avaliação &quot;{formularioToDelete?.titulo}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
