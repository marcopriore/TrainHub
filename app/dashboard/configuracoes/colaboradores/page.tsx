'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
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
import { ImportDialog } from '@/components/import-dialog'
import { getExcelValue } from '@/lib/excel-utils'

interface Setor {
  id: string
  nome: string
}

interface Colaborador {
  id: string
  nome: string
  setor_id: string | null
  criado_em: string
  setores: { nome: string } | null
}

export default function ColaboradoresPage() {
  const { user, getActiveTenantId } = useUser()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null)
  const [colaboradorToDelete, setColaboradorToDelete] = useState<Colaborador | null>(null)
  const [nome, setNome] = useState('')
  const [setorId, setSetorId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const supabase = createClient()

  const fetchColaboradores = async () => {
    const tenantId = getActiveTenantId()
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*, setores(nome)')
        .eq('tenant_id', tenantId)
        .order('nome', { ascending: true })

      if (error) throw error
      setColaboradores((data as Colaborador[]) ?? [])
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error)
      toast.error('Não foi possível carregar os colaboradores. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSetores = async () => {
    const tenantId = getActiveTenantId()
    if (!tenantId) return
    try {
      const { data, error } = await supabase
        .from('setores')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .order('nome', { ascending: true })

      if (error) throw error
      setSetores(data ?? [])
    } catch (error) {
      console.error('Erro ao carregar setores:', error)
      toast.error('Não foi possível carregar os setores.')
    }
  }

  const activeTenantId = getActiveTenantId()
  useEffect(() => {
    if (activeTenantId) {
      fetchColaboradores()
      fetchSetores()
    }
  }, [activeTenantId])

  const openNewDialog = () => {
    setEditingColaborador(null)
    setNome('')
    setSetorId('')
    setDialogOpen(true)
  }

  const openEditDialog = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador)
    setNome(colaborador.nome)
    setSetorId(colaborador.setor_id ?? '')
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingColaborador(null)
    setNome('')
    setSetorId('')
  }

  const handleSave = async () => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) {
      toast.error('Informe o nome do colaborador.')
      return
    }
    if (!setorId) {
      toast.error('Selecione o setor.')
      return
    }

    setSubmitting(true)
    try {
      if (editingColaborador) {
        const { error } = await supabase
          .from('colaboradores')
          .update({ nome: nomeTrimmed, setor_id: setorId })
          .eq('id', editingColaborador.id)

        if (error) throw error
        toast.success('Colaborador atualizado com sucesso.')
      } else {
        const tenantId = getActiveTenantId()
        if (!tenantId) {
          toast.error('Tenant não identificado.')
          setSubmitting(false)
          return
        }
        const { error } = await supabase
          .from('colaboradores')
          .insert({ nome: nomeTrimmed, setor_id: setorId, tenant_id: tenantId })

        if (error) throw error
        toast.success('Colaborador cadastrado com sucesso.')
      }
      closeDialog()
      fetchColaboradores()
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error)
      toast.error('Não foi possível salvar o colaborador. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (colaborador: Colaborador) => {
    setColaboradorToDelete(colaborador)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!colaboradorToDelete) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('colaboradores')
        .delete()
        .eq('id', colaboradorToDelete.id)

      if (error) throw error
      toast.success('Colaborador excluído com sucesso.')
      setDeleteDialogOpen(false)
      setColaboradorToDelete(null)
      fetchColaboradores()
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error)
      toast.error('Não foi possível excluir o colaborador. Tente novamente.')
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

  const getSetorNome = (colaborador: Colaborador) => {
    return colaborador.setores?.nome ?? '—'
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os colaboradores cadastrados na plataforma
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Importar Planilha
          </Button>
          <Button onClick={openNewDialog} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4" />
            Novo Colaborador
          </Button>
        </div>
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
                <TableHead className="font-medium">Setor</TableHead>
                <TableHead className="font-medium">Data de Cadastro</TableHead>
                <TableHead className="font-medium w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    Nenhum colaborador cadastrado. Clique em &quot;Novo Colaborador&quot; para
                    começar.
                  </TableCell>
                </TableRow>
              ) : (
                colaboradores.map((colaborador) => (
                  <TableRow key={colaborador.id}>
                    <TableCell className="font-medium">{colaborador.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getSetorNome(colaborador)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(colaborador.criado_em)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(colaborador)}
                          aria-label="Editar colaborador"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openDeleteDialog(colaborador)}
                          aria-label="Excluir colaborador"
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
            setEditingColaborador(null)
            setNome('')
            setSetorId('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingColaborador ? 'Editar Colaborador' : 'Novo Colaborador'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome-colaborador">Nome do Colaborador</Label>
              <Input
                id="nome-colaborador"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João Silva"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Select value={setorId || undefined} onValueChange={setSetorId} required>
                <SelectTrigger id="setor" className="w-full">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.id}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importar Colaboradores"
        templateHeaders={['Nome', 'Setor']}
        templateFilename="template_colaboradores.xlsx"
        templateTitle="TrainHub — Template de Importação: Colaboradores"
        sampleRow={{ Nome: 'João Silva', Setor: 'TI' }}
        columns={[
          { key: 'nome', label: 'Nome' },
          { key: 'setor', label: 'Setor' },
        ]}
        onValidateAndImport={async (rows) => {
          const errors: string[] = []
          const setoresMap = new Map(setores.map((s) => [s.nome.toLowerCase(), s]))
          const nomesExistentes = new Set(colaboradores.map((c) => c.nome.toLowerCase()))
          const validData: Record<string, unknown>[] = []

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            const linha = i + 2
            const nome = String(getExcelValue(row, 'nome') ?? '').trim()
            const setorNome = String(getExcelValue(row, 'setor') ?? '').trim()

            if (!nome) {
              errors.push(`Linha ${linha}: Campo 'nome' obrigatório`)
              continue
            }
            if (!setorNome) {
              errors.push(`Linha ${linha}: Campo 'setor' obrigatório`)
              continue
            }
            const setor = setoresMap.get(setorNome.toLowerCase())
            if (!setor) {
              errors.push(`Linha ${linha}: Setor "${setorNome}" não encontrado. Cadastre o setor antes de importar.`)
              continue
            }
            if (nomesExistentes.has(nome.toLowerCase())) {
              errors.push(`Linha ${linha}: Colaborador "${nome}" já existe no sistema`)
              continue
            }
            nomesExistentes.add(nome.toLowerCase())
            validData.push({ nome, setor_id: setor.id, setor: setorNome })
          }

          if (errors.length > 0) {
            return { valid: false, errors }
          }
          return { valid: true, errors: [], data: validData }
        }}
        onConfirmImport={async (data) => {
          const tenantId = getActiveTenantId()
          if (!tenantId) throw new Error('Tenant não identificado')
          const toInsert = data.map((row) => ({
            nome: row.nome,
            setor_id: row.setor_id,
            tenant_id: tenantId,
          }))
          const { error } = await supabase.from('colaboradores').insert(toInsert)
          if (error) throw error
        }}
        onSuccess={() => {
          toast.success('Colaboradores importados com sucesso.')
          fetchColaboradores()
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o colaborador &quot;{colaboradorToDelete?.nome}&quot;?
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
