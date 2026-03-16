'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Settings, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Formulario {
  id: string
  tenant_id: string
  nome: string
  descricao: string | null
  ativo: boolean
  criado_em: string
}

export default function PesquisasPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canManage =
    user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('gerenciar_pesquisas')
  const activeTenantId = getActiveTenantId()

  const [formularios, setFormularios] = useState<Formulario[]>([])
  const [perguntasCount, setPerguntasCount] = useState<Record<string, number>>({})
  const [tokensCount, setTokensCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingFormulario, setEditingFormulario] = useState<Formulario | null>(null)
  const [formularioToDelete, setFormularioToDelete] = useState<Formulario | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
        .from('pesquisa_formularios')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('criado_em', { ascending: false })

      if (error) throw error
      const list = (data as Formulario[]) ?? []
      setFormularios(list)

      if (list.length === 0) {
        setPerguntasCount({})
        setTokensCount({})
        return
      }

      const ids = list.map((f) => f.id)
      const { data: perguntasData } = await supabase
        .from('pesquisa_perguntas')
        .select('formulario_id')
        .in('formulario_id', ids)
      const countByForm: Record<string, number> = {}
      ids.forEach((id) => (countByForm[id] = 0))
      ;(perguntasData ?? []).forEach((p: { formulario_id: string }) => {
        countByForm[p.formulario_id] = (countByForm[p.formulario_id] ?? 0) + 1
      })
      setPerguntasCount(countByForm)

      const { data: tokensData } = await supabase
        .from('pesquisa_tokens')
        .select('formulario_id')
        .in('formulario_id', ids)
      const tokensByForm: Record<string, number> = {}
      ids.forEach((id) => (tokensByForm[id] = 0))
      ;(tokensData ?? []).forEach((t: { formulario_id: string }) => {
        tokensByForm[t.formulario_id] = (tokensByForm[t.formulario_id] ?? 0) + 1
      })
      setTokensCount(tokensByForm)
    } catch (error) {
      console.error('Erro ao carregar formulários:', error)
      toast.error('Não foi possível carregar os formulários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeTenantId || !user) return
    fetchFormularios()
  }, [activeTenantId, user?.id])

  const openNewDialog = () => {
    setEditingFormulario(null)
    setNome('')
    setDescricao('')
    setAtivo(true)
    setDialogOpen(true)
  }

  const openEditDialog = (f: Formulario) => {
    setEditingFormulario(f)
    setNome(f.nome ?? '')
    setDescricao(f.descricao ?? '')
    setAtivo(f.ativo ?? true)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingFormulario(null)
    setNome('')
    setDescricao('')
    setAtivo(true)
  }

  const handleSave = async () => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) {
      toast.error('Informe o nome do formulário.')
      return
    }
    if (!activeTenantId) {
      toast.error('Tenant não identificado.')
      return
    }

    setSubmitting(true)
    try {
      const payload = { nome: nomeTrimmed, descricao: descricao.trim() || null, ativo }
      if (editingFormulario) {
        const { error } = await supabase
          .from('pesquisa_formularios')
          .update(payload)
          .eq('id', editingFormulario.id)
        if (error) throw error
        toast.success('Formulário atualizado com sucesso.')
      } else {
        const { error } = await supabase
          .from('pesquisa_formularios')
          .insert({ ...payload, tenant_id: activeTenantId })
        if (error) throw error
        toast.success('Formulário criado com sucesso.')
      }
      closeDialog()
      fetchFormularios()
    } catch (error) {
      console.error('Erro ao salvar formulário:', error)
      toast.error('Não foi possível salvar o formulário. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (f: Formulario) => {
    if (!canManage) return
    const next = !f.ativo
    try {
      const { error } = await supabase
        .from('pesquisa_formularios')
        .update({ ativo: next })
        .eq('id', f.id)
      if (error) throw error
      toast.success(next ? 'Formulário ativado.' : 'Formulário inativado.')
      fetchFormularios()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Não foi possível atualizar o status.')
    }
  }

  const openDeleteDialog = (f: Formulario) => {
    setFormularioToDelete(f)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!formularioToDelete) return
    const tokens = tokensCount[formularioToDelete.id] ?? 0
    if (tokens > 0) {
      toast.error('Não é possível excluir: existem respostas vinculadas a este formulário.')
      setDeleteDialogOpen(false)
      setFormularioToDelete(null)
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('pesquisa_formularios')
        .delete()
        .eq('id', formularioToDelete.id)
      if (error) throw error
      toast.success('Formulário excluído com sucesso.')
      setDeleteDialogOpen(false)
      setFormularioToDelete(null)
      fetchFormularios()
    } catch (error) {
      console.error('Erro ao excluir formulário:', error)
      toast.error('Não foi possível excluir o formulário.')
    } finally {
      setSubmitting(false)
    }
  }

  const canDelete = (f: Formulario) => (tokensCount[f.id] ?? 0) === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Pesquisas de Satisfação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Formulários de Pesquisa
          </p>
        </div>
        {canManage && (
          <Button onClick={openNewDialog} className="w-full sm:w-auto shrink-0 bg-[#00C9A7] hover:bg-[#00C9A7]/90">
            <Plus className="w-4 h-4" />
            Novo Formulário
          </Button>
        )}
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
            Nenhum formulário cadastrado. {canManage && 'Clique em "Novo Formulário" para começar.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Descrição</TableHead>
                <TableHead className="font-medium w-24">Status</TableHead>
                <TableHead className="font-medium text-right w-28">Qtd. Perguntas</TableHead>
                {(canManage) && (
                  <TableHead className="font-medium w-[200px] text-right">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {formularios.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {f.descricao ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        f.ativo
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{perguntasCount[f.id] ?? 0}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="gap-1"
                        >
                          <Link href={`/dashboard/gestao/pesquisas/${f.id}/respostas`}>
                            <BarChart2 className="w-4 h-4" />
                            Ver respostas
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="gap-1"
                        >
                          <Link href={`/dashboard/gestao/pesquisas/${f.id}`}>
                            <Settings className="w-4 h-4" />
                            Editar perguntas
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(f)}
                          className="gap-1"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </Button>
                        <Switch
                          checked={f.ativo}
                          onCheckedChange={() => handleToggleStatus(f)}
                          aria-label={f.ativo ? 'Inativar' : 'Ativar'}
                        />
                        {canDelete(f) && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(f)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingFormulario ? 'Editar Formulário' : 'Novo Formulário'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-form">Nome *</Label>
              <Input
                id="nome-form"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Pesquisa pós-treinamento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc-form">Descrição</Label>
              <Textarea
                id="desc-form"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição opcional"
                className="min-h-[80px] resize-y"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ativo-form">Ativo</Label>
              <Switch id="ativo-form" checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={submitting} className="bg-[#00C9A7] hover:bg-[#00C9A7]/90">
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o formulário &quot;{formularioToDelete?.nome}&quot;? Esta
              ação não pode ser desfeita.
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
