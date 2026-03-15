'use client'

import { useEffect, useState, useMemo } from 'react'
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

interface Categoria {
  id: string
  nome: string
  tenant_id: string
}

export default function CategoriasPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canManage =
    user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('gerenciar_categorias')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null)
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(null)
  const [nome, setNome] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard/gestao')
  }, [user, canManage, router])

  const fetchCategorias = async () => {
    const tenantId = getActiveTenantId()
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nome', { ascending: true })

      if (error) throw error
      setCategorias((data as Categoria[]) ?? [])
    } catch (error) {
      console.error('Erro ao carregar categorias:', error)
      toast.error('Não foi possível carregar as categorias. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const activeTenantId = getActiveTenantId()
  useEffect(() => {
    if (activeTenantId) fetchCategorias()
  }, [activeTenantId])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return categorias
    const q = searchQuery.trim().toLowerCase()
    return categorias.filter((c) => c.nome?.toLowerCase().includes(q))
  }, [categorias, searchQuery])

  const openNewDialog = () => {
    setEditingCategoria(null)
    setNome('')
    setDialogOpen(true)
  }

  const openEditDialog = (categoria: Categoria) => {
    setEditingCategoria(categoria)
    setNome(categoria.nome)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingCategoria(null)
    setNome('')
  }

  const handleSave = async () => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) {
      toast.error('Informe o nome da categoria.')
      return
    }

    const tenantId = getActiveTenantId()
    if (!editingCategoria && !tenantId) {
      toast.error('Tenant não identificado.')
      return
    }

    setSubmitting(true)
    try {
      if (editingCategoria) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome: nomeTrimmed })
          .eq('id', editingCategoria.id)

        if (error) throw error
        toast.success('Categoria atualizada com sucesso.')
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert({ nome: nomeTrimmed, tenant_id: tenantId as string })

        if (error) throw error
        toast.success('Categoria cadastrada com sucesso.')
      }
      closeDialog()
      fetchCategorias()
    } catch (error) {
      console.error('Erro ao salvar categoria:', error)
      toast.error('Não foi possível salvar a categoria. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (categoria: Categoria) => {
    setCategoriaToDelete(categoria)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!categoriaToDelete) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('categorias')
        .delete()
        .eq('id', categoriaToDelete.id)

      if (error) throw error
      toast.success('Categoria excluída com sucesso.')
      setDeleteDialogOpen(false)
      setCategoriaToDelete(null)
      fetchCategorias()
    } catch (error) {
      console.error('Erro ao excluir categoria:', error)
      toast.error('Não foi possível excluir a categoria. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Categorias</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie as categorias de treinamentos do tenant
          </p>
        </div>
        {canManage && (
          <Button onClick={openNewDialog} className="w-full sm:w-auto shrink-0 bg-[#00C9A7] hover:bg-[#00C9A7]/90">
            <Plus className="w-4 h-4" />
            Nova Categoria
          </Button>
        )}
      </div>

      {canManage && categorias.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <Input
            placeholder="Buscar por nome"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}

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
                {canManage && (
                  <TableHead className="font-medium w-[120px]">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 2 : 1}
                    className="text-center py-12 text-muted-foreground"
                  >
                    {canManage
                      ? searchQuery.trim()
                        ? 'Nenhuma categoria encontrada para a busca.'
                        : 'Nenhuma categoria cadastrada. Clique em "Nova Categoria" para começar.'
                      : 'Nenhuma categoria cadastrada.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((categoria) => (
                  <TableRow key={categoria.id}>
                    <TableCell className="font-medium">{categoria.nome}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(categoria)}
                            aria-label="Editar categoria"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(categoria)}
                            aria-label="Excluir categoria"
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
            setEditingCategoria(null)
            setNome('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-categoria">Nome da Categoria</Label>
              <Input
                id="nome-categoria"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Tecnologia, Gestão"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
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
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria &quot;{categoriaToDelete?.nome}&quot;? Esta
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
