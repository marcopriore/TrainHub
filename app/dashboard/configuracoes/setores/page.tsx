'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
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

interface Setor {
  id: string
  nome: string
  criado_em: string
}

export default function SetoresPage() {
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null)
  const [setorToDelete, setSetorToDelete] = useState<Setor | null>(null)
  const [nome, setNome] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  const fetchSetores = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('setores')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      setSetores(data ?? [])
    } catch (error) {
      console.error('Erro ao carregar setores:', error)
      toast.error('Não foi possível carregar os setores. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSetores()
  }, [])

  const openNewDialog = () => {
    setEditingSetor(null)
    setNome('')
    setDialogOpen(true)
  }

  const openEditDialog = (setor: Setor) => {
    setEditingSetor(setor)
    setNome(setor.nome)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingSetor(null)
    setNome('')
  }

  const handleSave = async () => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) {
      toast.error('Informe o nome do setor.')
      return
    }

    setSubmitting(true)
    try {
      if (editingSetor) {
        const { error } = await supabase
          .from('setores')
          .update({ nome: nomeTrimmed })
          .eq('id', editingSetor.id)

        if (error) throw error
        toast.success('Setor atualizado com sucesso.')
      } else {
        const { error } = await supabase.from('setores').insert({ nome: nomeTrimmed })

        if (error) throw error
        toast.success('Setor cadastrado com sucesso.')
      }
      closeDialog()
      fetchSetores()
    } catch (error) {
      console.error('Erro ao salvar setor:', error)
      toast.error('Não foi possível salvar o setor. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (setor: Setor) => {
    setSetorToDelete(setor)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!setorToDelete) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('setores')
        .delete()
        .eq('id', setorToDelete.id)

      if (error) throw error
      toast.success('Setor excluído com sucesso.')
      setDeleteDialogOpen(false)
      setSetorToDelete(null)
      fetchSetores()
    } catch (error) {
      console.error('Erro ao excluir setor:', error)
      toast.error('Não foi possível excluir o setor. Tente novamente.')
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
          <h1 className="font-serif text-2xl font-bold text-foreground">Setores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os setores cadastrados na plataforma
          </p>
        </div>
        <Button onClick={openNewDialog} className="w-full sm:w-auto shrink-0">
          <Plus className="w-4 h-4" />
          Novo Setor
        </Button>
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
                <TableHead className="font-medium w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    Nenhum setor cadastrado. Clique em &quot;Novo Setor&quot; para começar.
                  </TableCell>
                </TableRow>
              ) : (
                setores.map((setor) => (
                  <TableRow key={setor.id}>
                    <TableCell className="font-medium">{setor.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(setor.criado_em)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(setor)}
                          aria-label="Editar setor"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openDeleteDialog(setor)}
                          aria-label="Excluir setor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
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
            setEditingSetor(null)
            setNome('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSetor ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-setor">Nome do Setor</Label>
              <Input
                id="nome-setor"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Recursos Humanos"
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
            <AlertDialogTitle>Excluir setor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o setor &quot;{setorToDelete?.nome}&quot;? Esta ação não pode
              ser desfeita.
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
