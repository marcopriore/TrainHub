'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface EmpresaParceira {
  id: string
  nome: string
  criado_em: string
}

export default function EmpresasParceirasPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canManage = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('gerenciar_empresas_parceiras')
  const canEdit = canManage
  const [empresas, setEmpresas] = useState<EmpresaParceira[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaParceira | null>(null)
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaParceira | null>(null)
  const [nome, setNome] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard/gestao')
  }, [user, canManage, router])

  const fetchEmpresas = async () => {
    const tenantId = getActiveTenantId()
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('empresas_parceiras')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nome', { ascending: true })

      if (error) throw error
      setEmpresas(data ?? [])
    } catch (error) {
      console.error('Erro ao carregar empresas parceiras:', error)
      toast.error('Não foi possível carregar as empresas parceiras. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const activeTenantId = getActiveTenantId()
  useEffect(() => {
    if (activeTenantId) fetchEmpresas()
  }, [activeTenantId])

  const openNewDialog = () => {
    setEditingEmpresa(null)
    setNome('')
    setDialogOpen(true)
  }

  const openEditDialog = (empresa: EmpresaParceira) => {
    setEditingEmpresa(empresa)
    setNome(empresa.nome)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingEmpresa(null)
    setNome('')
  }

  const handleSave = async () => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) {
      toast.error('Informe o nome da empresa.')
      return
    }

    setSubmitting(true)
    try {
      if (editingEmpresa) {
        const { error } = await supabase
          .from('empresas_parceiras')
          .update({ nome: nomeTrimmed })
          .eq('id', editingEmpresa.id)

        if (error) throw error
        toast.success('Empresa parceira atualizada com sucesso.')
      } else {
        const tenantId = getActiveTenantId()
        if (!tenantId) {
          toast.error('Tenant não identificado.')
          setSubmitting(false)
          return
        }
        const { error } = await supabase
          .from('empresas_parceiras')
          .insert({ nome: nomeTrimmed, tenant_id: tenantId })

        if (error) throw error
        toast.success('Empresa parceira cadastrada com sucesso.')
      }
      closeDialog()
      fetchEmpresas()
    } catch (error) {
      console.error('Erro ao salvar empresa parceira:', error)
      toast.error('Não foi possível salvar a empresa parceira. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (empresa: EmpresaParceira) => {
    setEmpresaToDelete(empresa)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!empresaToDelete) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('empresas_parceiras')
        .delete()
        .eq('id', empresaToDelete.id)

      if (error) throw error
      toast.success('Empresa parceira excluída com sucesso.')
      setDeleteDialogOpen(false)
      setEmpresaToDelete(null)
      fetchEmpresas()
    } catch (error) {
      console.error('Erro ao excluir empresa parceira:', error)
      toast.error('Não foi possível excluir a empresa parceira. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Empresas Parceiras
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie as empresas parceiras cadastradas na plataforma
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNewDialog} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4" />
            Nova Empresa Parceira
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Data de Cadastro</TableHead>
                {canEdit && (
                  <TableHead className="font-medium w-[120px]">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {empresas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 3 : 2} className="text-center py-12 text-muted-foreground">
                    {canEdit ? 'Nenhuma empresa parceira cadastrada. Clique em "Nova Empresa Parceira" para começar.' : 'Nenhuma empresa parceira cadastrada.'}
                  </TableCell>
                </TableRow>
              ) : (
                empresas.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-medium">{empresa.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(empresa.criado_em)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(empresa)}
                          aria-label="Editar empresa parceira"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openDeleteDialog(empresa)}
                          aria-label="Excluir empresa parceira"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingEmpresa(null)
            setNome('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmpresa ? 'Editar Empresa Parceira' : 'Nova Empresa Parceira'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-empresa">Nome da Empresa</Label>
              <Input
                id="nome-empresa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Acme Corporation"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa parceira</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa &quot;{empresaToDelete?.nome}&quot;? Esta
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
