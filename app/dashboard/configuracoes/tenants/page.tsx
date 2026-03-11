'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Pencil,
  Power,
  PowerOff,
  Building2,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

interface Tenant {
  id: string
  nome: string
  slug: string
  ativo: boolean
  criado_em: string
}

interface Perfil {
  id: string
  nome: string
}

interface Usuario {
  id: string
  nome: string
  email: string
  ativo: boolean
  perfis: { nome: string } | null
}

const tenantSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  slug: z
    .string()
    .min(1, 'Slug obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Slug: apenas letras minúsculas, números e hífens'),
  ativo: z.boolean(),
})

const addUserSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().min(1, 'E-mail obrigatório').email('E-mail inválido'),
  perfil_id: z.string().min(1, 'Selecione o perfil'),
})

type TenantFormData = z.infer<typeof tenantSchema>
type AddUserFormData = z.infer<typeof addUserSchema>

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateTempPassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function TenantsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState<'novo' | string | null>(null)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [autoSlug, setAutoSlug] = useState(true)

  const tenantForm = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { nome: '', slug: '', ativo: true },
  })
  const addUserForm = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { nome: '', email: '', perfil_id: '' },
  })

  const nome = tenantForm.watch('nome')

  useEffect(() => {
    if (!userLoading && (!user || !user.isMaster())) {
      router.push('/dashboard')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (autoSlug && nome && sheetOpen === 'novo') {
      tenantForm.setValue('slug', slugify(nome))
    }
  }, [nome, autoSlug, sheetOpen, tenantForm])

  const fetchTenants = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tenants')
        .select('id, nome, slug, ativo, criado_em')
        .order('criado_em', { ascending: false })

      if (error) throw error
      setTenants((data as Tenant[]) ?? [])
    } catch {
      toast.error('Erro ao carregar tenants')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsuarios = async (tenantId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, ativo, perfis(nome)')
        .eq('tenant_id', tenantId)
        .order('nome')

      if (error) throw error
      setUsuarios((data as Usuario[]) ?? [])
    } catch {
      setUsuarios([])
    }
  }

  const fetchPerfis = async (tenantId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .order('nome')

      if (error) throw error
      setPerfis((data as Perfil[]) ?? [])
    } catch {
      setPerfis([])
    }
  }

  useEffect(() => {
    if (user?.isMaster()) {
      fetchTenants()
    }
  }, [user?.isMaster()])

  useEffect(() => {
    if (sheetOpen && sheetOpen !== 'novo') {
      fetchUsuarios(sheetOpen)
      fetchPerfis(sheetOpen)
    }
  }, [sheetOpen])

  const openNovoSheet = () => {
    setEditingTenant(null)
    tenantForm.reset({ nome: '', slug: '', ativo: true })
    setAutoSlug(true)
    setSheetOpen('novo')
  }

  const openEditarSheet = (tenant: Tenant) => {
    setEditingTenant(tenant)
    tenantForm.reset({
      nome: tenant.nome,
      slug: tenant.slug,
      ativo: tenant.ativo,
    })
    setAutoSlug(false)
    setSheetOpen(tenant.id)
  }

  const closeSheet = () => {
    setSheetOpen(null)
    setEditingTenant(null)
    setAddUserOpen(false)
    setTempPassword(null)
  }

  const onSaveTenant = async (data: TenantFormData) => {
    try {
      const supabase = createClient()
      if (editingTenant) {
        const { error } = await supabase
          .from('tenants')
          .update({ nome: data.nome, slug: data.slug, ativo: data.ativo })
          .eq('id', editingTenant.id)

        if (error) {
          if (error.code === '23505') toast.error('Slug já existe. Escolha outro.')
          else toast.error(error.message)
          return
        }
        toast.success('Tenant atualizado com sucesso.')
      } else {
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({ nome: data.nome, slug: data.slug, ativo: data.ativo })
          .select('id')
          .single()

        if (tenantError) {
          if (tenantError.code === '23505') toast.error('Slug já existe. Escolha outro.')
          else toast.error(tenantError.message)
          return
        }
        if (!tenant) {
          toast.error('Erro ao criar tenant')
          return
        }
        const { error: perfilError } = await supabase.from('perfis').insert({
          tenant_id: tenant.id,
          nome: 'Admin',
          is_admin: true,
        })
        if (perfilError) {
          toast.error('Tenant criado, mas erro ao criar perfil padrão.')
        } else {
          toast.success('Tenant criado com sucesso.')
        }
      }
      closeSheet()
      fetchTenants()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  const toggleTenantAtivo = async (tenant: Tenant) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('tenants')
        .update({ ativo: !tenant.ativo })
        .eq('id', tenant.id)

      if (error) throw error
      toast.success(tenant.ativo ? 'Tenant desativado' : 'Tenant ativado')
      fetchTenants()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const onAddUser = async (data: AddUserFormData) => {
    if (!sheetOpen || sheetOpen === 'novo') return
    try {
      const senha = generateTempPassword()
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: senha,
        options: {
          data: { full_name: data.nome },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard`,
        },
      })

      if (authError) {
        toast.error(authError.message)
        return
      }
      const userId = authData.user?.id
      if (!userId) {
        toast.error('Erro ao criar usuário')
        return
      }

      const { error: usuarioError } = await supabase.from('usuarios').insert({
        id: userId,
        tenant_id: sheetOpen,
        perfil_id: data.perfil_id,
        nome: data.nome,
        email: data.email,
        is_master: false,
        ativo: true,
      })

      if (usuarioError) {
        toast.error('Usuário criado no Auth, mas erro ao vincular ao tenant.')
        return
      }

      setTempPassword(senha)
      toast.success('Usuário criado. Anote a senha temporária.')
      addUserForm.reset({ nome: '', email: '', perfil_id: '' })
      fetchUsuarios(sheetOpen)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário')
    }
  }

  const toggleUsuarioAtivo = async (u: Usuario) => {
    if (!sheetOpen || sheetOpen === 'novo') return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo: !u.ativo })
        .eq('id', u.id)

      if (error) throw error
      toast.success(u.ativo ? 'Usuário desativado' : 'Usuário ativado')
      fetchUsuarios(sheetOpen)
    } catch {
      toast.error('Erro ao atualizar usuário')
    }
  }

  if (userLoading || (!user || !user.isMaster())) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  const total = tenants.length
  const ativos = tenants.filter((t) => t.ativo).length
  const inativos = total - ativos

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os tenants (clientes) do TrainHub
          </p>
        </div>
        <Button onClick={openNovoSheet} className="w-full sm:w-auto shrink-0">
          <Plus className="w-4 h-4" />
          Novo Tenant
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold">{total}</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants Ativos</CardTitle>
            <Power className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold text-green-600">{ativos}</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants Inativos</CardTitle>
            <PowerOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-16" /> : <span className="text-2xl font-bold text-muted-foreground">{inativos}</span>}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum tenant cadastrado</p>
            <Button onClick={openNovoSheet} className="mt-4">
              Criar primeiro tenant
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Nome</TableHead>
                <TableHead className="font-medium">Slug</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium">Data de criação</TableHead>
                <TableHead className="font-medium w-[160px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.nome}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-sm">{tenant.slug}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.ativo ? 'default' : 'secondary'}>
                      {tenant.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(tenant.criado_em)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditarSheet(tenant)} aria-label="Editar tenant">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={tenant.ativo ? 'Desativar' : 'Ativar'}
                        onClick={() => toggleTenantAtivo(tenant)}
                      >
                        {tenant.ativo ? <PowerOff className="w-4 h-4 text-muted-foreground" /> : <Power className="w-4 h-4 text-green-600" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Sheet Novo / Editar Tenant */}
      <Sheet open={!!sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTenant ? 'Editar Tenant' : 'Novo Tenant'}</SheetTitle>
            <SheetDescription>
              {editingTenant ? 'Atualize os dados do tenant' : 'Cadastre uma nova organização'}
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={tenantForm.handleSubmit(onSaveTenant)}
            className="flex flex-col gap-6 py-6"
          >
            <div className="space-y-2">
              <Label htmlFor="tenant-nome">Nome da empresa *</Label>
              <Input id="tenant-nome" {...tenantForm.register('nome')} placeholder="Ex: Empresa ABC" />
              {tenantForm.formState.errors.nome && (
                <p className="text-sm text-destructive">{tenantForm.formState.errors.nome.message}</p>
              )}
            </div>
            <div className="space-y-2">
              {!editingTenant && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
                  Gerar slug automaticamente
                </label>
              )}
              <Label htmlFor="tenant-slug">Slug *</Label>
              <Input
                id="tenant-slug"
                {...tenantForm.register('slug')}
                placeholder="empresa-abc"
                className="font-mono"
                disabled={!editingTenant && autoSlug}
              />
              <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens</p>
              {tenantForm.formState.errors.slug && (
                <p className="text-sm text-destructive">{tenantForm.formState.errors.slug.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={tenantForm.watch('ativo') ? 'ativo' : 'inativo'}
                onValueChange={(v) => tenantForm.setValue('ativo', v === 'ativo')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingTenant && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-semibold">Usuários do tenant</h3>
                <Button type="button" size="sm" className="w-full" onClick={() => setAddUserOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Usuário
                </Button>
                {usuarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum usuário cadastrado</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="py-2">Nome</TableHead>
                          <TableHead className="py-2">E-mail</TableHead>
                          <TableHead className="py-2">Perfil</TableHead>
                          <TableHead className="py-2">Status</TableHead>
                          <TableHead className="py-2 w-[80px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usuarios.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="py-2 text-sm">{u.nome}</TableCell>
                            <TableCell className="py-2 text-sm">{u.email}</TableCell>
                            <TableCell className="py-2 text-sm">{u.perfis?.nome ?? '—'}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant={u.ativo ? 'default' : 'secondary'} className="text-xs">
                                {u.ativo ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => toggleUsuarioAtivo(u)}
                                title={u.ativo ? 'Desativar' : 'Ativar'}
                              >
                                {u.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            <SheetFooter>
              <Button type="button" variant="outline" onClick={closeSheet}>
                Cancelar
              </Button>
              <Button type="submit" disabled={tenantForm.formState.isSubmitting}>
                {tenantForm.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Dialog Adicionar Usuário */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          {tempPassword && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Senha temporária (anote):</p>
              <p className="font-mono mt-1 break-all">{tempPassword}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setTempPassword(null)
                  setAddUserOpen(false)
                }}
              >
                Fechar
              </Button>
            </div>
          )}
          <form onSubmit={addUserForm.handleSubmit(onAddUser)} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input {...addUserForm.register('nome')} placeholder="Nome completo" />
              {addUserForm.formState.errors.nome && (
                <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.nome.message}</p>
              )}
            </div>
            <div>
              <Label>E-mail</Label>
              <Input {...addUserForm.register('email')} type="email" placeholder="email@exemplo.com" />
              {addUserForm.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label>Perfil</Label>
              <Select
                value={addUserForm.watch('perfil_id')}
                onValueChange={(v) => addUserForm.setValue('perfil_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addUserForm.formState.errors.perfil_id && (
                <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.perfil_id.message}</p>
              )}
            </div>
            <Button type="submit" disabled={addUserForm.formState.isSubmitting}>
              {addUserForm.formState.isSubmitting ? 'Criando...' : 'Criar usuário'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
