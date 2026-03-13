'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Shield, LayoutGrid, ClipboardList, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { type Permissao } from '@/lib/user-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { ScrollArea } from '@/components/ui/scroll-area'

const ICON_MAP = {
  LayoutGrid,
  Shield,
  ClipboardList,
  BookOpen,
} as const

const PERMISSOES_AGRUPADAS = [
  {
    grupo: 'Acesso aos Módulos',
    icone: 'LayoutGrid' as const,
    cor: '#00C9A7',
    categorias: [
      {
        categoria: null as string | null,
        permissoes: [
          { key: 'acessar_modulo_gestao' as const, label: 'Gestão de Treinamentos' },
          { key: 'acessar_modulo_trilhas' as const, label: 'Trilhas de Conhecimento' },
        ],
      },
    ],
  },
  {
    grupo: 'Administração',
    icone: 'Shield' as const,
    cor: '#8b5cf6',
    categorias: [
      {
        categoria: null as string | null,
        permissoes: [
          { key: 'gerenciar_usuarios' as const, label: 'Gerenciar Usuários' },
          { key: 'gerenciar_perfis' as const, label: 'Gerenciar Perfis de Acesso' },
        ],
      },
    ],
  },
  {
    grupo: 'Módulo: Gestão de Treinamentos',
    icone: 'ClipboardList' as const,
    cor: '#3b82f6',
    categorias: [
      {
        categoria: 'Treinamentos',
        permissoes: [
          { key: 'registrar_treinamento_parceiro' as const, label: 'Registrar (Parceiro)' },
          { key: 'registrar_treinamento_colaborador' as const, label: 'Registrar (Colaborador)' },
          { key: 'editar_treinamento' as const, label: 'Editar' },
          { key: 'excluir_treinamento' as const, label: 'Excluir' },
          { key: 'visualizar_historico' as const, label: 'Visualizar Histórico' },
        ],
      },
      {
        categoria: 'Relatórios',
        permissoes: [
          { key: 'visualizar_relatorios' as const, label: 'Visualizar Relatórios' },
          { key: 'exportar_excel' as const, label: 'Exportar Excel' },
        ],
      },
      {
        categoria: 'Colaboradores',
        permissoes: [
          { key: 'visualizar_colaboradores' as const, label: 'Visualizar' },
          { key: 'gerenciar_colaboradores' as const, label: 'Editar/Criar' },
          { key: 'importar_planilha' as const, label: 'Importar Planilha' },
        ],
      },
      {
        categoria: 'Setores',
        permissoes: [
          { key: 'visualizar_setores' as const, label: 'Visualizar' },
          { key: 'gerenciar_setores' as const, label: 'Editar/Criar' },
        ],
      },
      {
        categoria: 'Empresas Parceiras',
        permissoes: [
          { key: 'visualizar_empresas_parceiras' as const, label: 'Visualizar' },
          { key: 'gerenciar_empresas_parceiras' as const, label: 'Editar/Criar' },
        ],
      },
      {
        categoria: 'Dashboard',
        permissoes: [{ key: 'ver_dashboard_geral' as const, label: 'Ver Dashboard Geral' }],
      },
    ],
  },
  {
    grupo: 'Módulo: Trilhas de Conhecimento',
    icone: 'BookOpen' as const,
    cor: '#3b82f6',
    categorias: [
      {
        categoria: 'Trilhas',
        permissoes: [{ key: 'ver_minhas_trilhas' as const, label: 'Ver Minhas Trilhas' }],
      },
    ],
  },
]

const GRUPOS_EDITAVEIS_ADMIN = ['Acesso aos Módulos', 'Administração']

function getTodasPermissoes(): string[] {
  const keys: string[] = []
  for (const g of PERMISSOES_AGRUPADAS) {
    for (const cat of g.categorias) {
      for (const p of cat.permissoes) {
        keys.push(p.key)
      }
    }
  }
  return keys
}

const PERMISSOES_EDITAVEIS = getTodasPermissoes() as Permissao[]

interface Perfil {
  id: string
  nome: string
  is_admin: boolean
  criado_em?: string
}

export default function PerfisPage() {
  const { getActiveTenantId, user } = useUser()
  const activeTenantId = getActiveTenantId()
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [permissoesPorPerfil, setPermissoesPorPerfil] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingPerfil, setEditingPerfil] = useState<Perfil | null>(null)
  const [perfilToDelete, setPerfilToDelete] = useState<Perfil | null>(null)
  const [nome, setNome] = useState('')
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  const fetchPerfis = async () => {
    if (!activeTenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, is_admin, criado_em')
        .eq('tenant_id', activeTenantId)
        .order('nome', { ascending: true })

      if (error) throw error
      setPerfis((data as Perfil[]) ?? [])

      const permMap: Record<string, string[]> = {}
      for (const p of data ?? []) {
        const { data: permData } = await supabase
          .from('perfil_permissoes')
          .select('permissao')
          .eq('perfil_id', p.id)
        permMap[p.id] = (permData ?? []).map((r: { permissao: string }) => r.permissao)
      }
      setPermissoesPorPerfil(permMap)
    } catch (error) {
      console.error('Erro ao carregar perfis:', error)
      toast.error('Não foi possível carregar os perfis.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTenantId) fetchPerfis()
  }, [activeTenantId])

  const openNewDialog = () => {
    setEditingPerfil(null)
    setNome('')
    setPermissoesSelecionadas(new Set())
    setDialogOpen(true)
  }

  const openEditDialog = (perfil: Perfil) => {
    setEditingPerfil(perfil)
    setNome(perfil.nome)
    setPermissoesSelecionadas(
      new Set(permissoesPorPerfil[perfil.id] ?? [])
    )
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingPerfil(null)
    setNome('')
  }

  const togglePermissao = (perm: string) => {
    setPermissoesSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  const getPermissoesDoGrupo = (grupo: (typeof PERMISSOES_AGRUPADAS)[number]) => {
    const keys: string[] = []
    for (const cat of grupo.categorias) {
      for (const p of cat.permissoes) keys.push(p.key)
    }
    return keys
  }

  const toggleGrupo = (grupo: (typeof PERMISSOES_AGRUPADAS)[number]) => {
    const keys = getPermissoesDoGrupo(grupo)
    const todasMarcadas = keys.every((k) => permissoesSelecionadas.has(k))
    setPermissoesSelecionadas((prev) => {
      const next = new Set(prev)
      if (todasMarcadas) keys.forEach((k) => next.delete(k))
      else keys.forEach((k) => next.add(k))
      return next
    })
  }

  const getGrupoCheckState = (grupo: (typeof PERMISSOES_AGRUPADAS)[number]) => {
    const keys = getPermissoesDoGrupo(grupo)
    const marcadas = keys.filter((k) => permissoesSelecionadas.has(k)).length
    if (marcadas === 0) return false
    if (marcadas === keys.length) return true
    return 'indeterminate'
  }

  const handleSave = async () => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) {
      toast.error('Informe o nome do perfil.')
      return
    }

    if (!activeTenantId) {
      toast.error('Tenant não identificado.')
      return
    }

    setSubmitting(true)
    try {
      if (editingPerfil) {
        const { error: updErr } = await supabase
          .from('perfis')
          .update({ nome: nomeTrimmed })
          .eq('id', editingPerfil.id)

        if (updErr) throw updErr

        await supabase
          .from('perfil_permissoes')
          .delete()
          .eq('perfil_id', editingPerfil.id)

        if (permissoesSelecionadas.size > 0) {
          const rows = Array.from(permissoesSelecionadas).map((permissao) => ({
            perfil_id: editingPerfil.id,
            permissao,
          }))
          const { error: insErr } = await supabase
            .from('perfil_permissoes')
            .insert(rows)
          if (insErr) throw insErr
        }

        toast.success('Perfil atualizado com sucesso.')
      } else {
        const { data: novoPerfil, error: insErr } = await supabase
          .from('perfis')
          .insert({
            tenant_id: activeTenantId,
            nome: nomeTrimmed,
            is_admin: false,
          })
          .select('id')
          .single()

        if (insErr) throw insErr
        if (!novoPerfil?.id) throw new Error('Falha ao criar perfil')

        if (permissoesSelecionadas.size > 0) {
          const rows = Array.from(permissoesSelecionadas).map((permissao) => ({
            perfil_id: novoPerfil.id,
            permissao,
          }))
          const { error: permErr } = await supabase
            .from('perfil_permissoes')
            .insert(rows)
          if (permErr) throw permErr
        }

        toast.success('Perfil criado com sucesso.')
      }
      closeDialog()
      fetchPerfis()
    } catch (error) {
      console.error('Erro ao salvar perfil:', error)
      toast.error('Não foi possível salvar o perfil.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (perfil: Perfil) => {
    setPerfilToDelete(perfil)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!perfilToDelete) return

    if (perfilToDelete.is_admin) {
      toast.error('Não é possível excluir o perfil Admin.')
      setDeleteDialogOpen(false)
      setPerfilToDelete(null)
      return
    }

    setSubmitting(true)
    try {
      await supabase
        .from('perfil_permissoes')
        .delete()
        .eq('perfil_id', perfilToDelete.id)

      const { error } = await supabase
        .from('perfis')
        .delete()
        .eq('id', perfilToDelete.id)

      if (error) throw error
      toast.success('Perfil excluído com sucesso.')
      setDeleteDialogOpen(false)
      setPerfilToDelete(null)
      fetchPerfis()
    } catch (error) {
      console.error('Erro ao excluir perfil:', error)
      toast.error('Não foi possível excluir o perfil.')
    } finally {
      setSubmitting(false)
    }
  }

  const getPermissoesLabel = (perfil: Perfil) => {
    if (perfil.is_admin) return 'Todas (Admin)'
    const perms = permissoesPorPerfil[perfil.id] ?? []
    return perms.length > 0 ? perms.length + ' permissões' : 'Nenhuma'
  }

  if (!activeTenantId) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-foreground">Perfil de Acesso</h1>
            <span className="text-muted-foreground">|</span>
            <Link
              href="/dashboard/configuracoes"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1"
            >
              ← Configurações
            </Link>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Selecione um tenant para gerenciar os perfis de acesso
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-12 text-center text-muted-foreground">
          Selecione um tenant no menu lateral para continuar.
        </div>
      </div>
    )
  }

  const canManage = user?.isMaster()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-foreground">Perfil de Acesso</h1>
            <span className="text-muted-foreground">|</span>
            <Link
              href="/dashboard/configuracoes"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1"
            >
              ← Configurações
            </Link>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Crie perfis e defina o que cada um pode fazer na plataforma
          </p>
        </div>
        {canManage && (
          <Button onClick={openNewDialog} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4" />
            Novo Perfil
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-[200px] w-full rounded-xl" />
      ) : perfis.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Nenhum perfil cadastrado. Crie um perfil para atribuir permissões aos usuários.
          </p>
          {canManage && (
            <Button onClick={openNewDialog}>
              <Plus className="w-4 h-4" />
              Novo Perfil
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Permissões</TableHead>
                {canManage && (
                  <TableHead className="font-medium text-right w-24">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perfis.map((perfil) => (
                <TableRow key={perfil.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {perfil.is_admin && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                          Admin
                        </span>
                      )}
                      <span className="font-medium">{perfil.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {getPermissoesLabel(perfil)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {!perfil.is_admin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(perfil)}
                            aria-label="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(perfil)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPerfil ? 'Editar Perfil' : 'Novo Perfil'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do perfil</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Operador, Visualizador"
                disabled={editingPerfil?.is_admin}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissões</Label>
              {editingPerfil?.is_admin && (
                <p className="text-xs text-muted-foreground mb-3">
                  Perfis Admin têm acesso completo às permissões internas.
                  Configure apenas o acesso aos módulos acima.
                </p>
              )}
              <ScrollArea className="h-[340px] rounded-md border border-border p-3">
                <div className="space-y-1">
                  {PERMISSOES_AGRUPADAS.map((grupo) => {
                    const Icone = ICON_MAP[grupo.icone]
                    const isGrupoEditavelAdmin =
                      editingPerfil?.is_admin &&
                      GRUPOS_EDITAVEIS_ADMIN.includes(grupo.grupo)
                    const isGrupoDisabled =
                      editingPerfil?.is_admin &&
                      !GRUPOS_EDITAVEIS_ADMIN.includes(grupo.grupo)

                    return (
                      <div
                        key={grupo.grupo}
                        className={`border-l-2 pl-4 mb-4 ${
                          isGrupoDisabled ? 'opacity-50' : ''
                        }`}
                        style={{ borderLeftColor: grupo.cor }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: `${grupo.cor}20`,
                              color: grupo.cor,
                            }}
                          >
                            <Icone className="w-3.5 h-3.5" />
                          </div>
                          <p className="font-semibold text-foreground text-sm">
                            {grupo.grupo}
                          </p>
                        </div>
                        <div className="border-t border-border/60 pt-2">
                          {!isGrupoDisabled && (
                            <div className="flex items-center gap-2 mb-2">
                              <Checkbox
                                id={`sel-${grupo.grupo}`}
                                checked={getGrupoCheckState(grupo)}
                                onCheckedChange={() => toggleGrupo(grupo)}
                                disabled={editingPerfil?.is_admin}
                              />
                              <label
                                htmlFor={`sel-${grupo.grupo}`}
                                className="text-xs text-muted-foreground cursor-pointer"
                              >
                                Selecionar todos
                              </label>
                            </div>
                          )}
                          {grupo.categorias.map((cat, cIdx) => (
                            <div
                              key={cat.categoria ?? `cat-${cIdx}`}
                              className={cat.categoria ? 'mt-3' : ''}
                            >
                              {cat.categoria && (
                                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                                  {cat.categoria}
                                </p>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                {cat.permissoes.map((p) => (
                                  <div
                                    key={p.key}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      id={p.key}
                                      checked={permissoesSelecionadas.has(
                                        p.key
                                      )}
                                      onCheckedChange={() =>
                                        togglePermissao(p.key)
                                      }
                                      disabled={
                                        editingPerfil?.is_admin &&
                                        !GRUPOS_EDITAVEIS_ADMIN.includes(
                                          grupo.grupo
                                        )
                                      }
                                    />
                                    <label
                                      htmlFor={p.key}
                                      className="text-sm leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                      {p.label}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
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
            <AlertDialogTitle>Excluir perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil &quot;{perfilToDelete?.nome}&quot;?
              Usuários com este perfil ficarão sem permissões definidas.
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
