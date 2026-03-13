'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Power,
  PowerOff,
  Building2,
  Pencil,
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

const tenantSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  slug: z
    .string()
    .min(1, 'Slug obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Slug: apenas letras minúsculas, números e hífens'),
  ativo: z.boolean(),
})

type TenantFormData = z.infer<typeof tenantSchema>

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function TenantsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)

  const tenantForm = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { nome: '', slug: '', ativo: true },
  })

  const nome = tenantForm.watch('nome')

  useEffect(() => {
    if (!userLoading && (!user || !user.isMaster())) {
      router.push('/dashboard')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (autoSlug && nome && sheetOpen) {
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

  useEffect(() => {
    if (user?.isMaster()) {
      fetchTenants()
    }
  }, [user?.isMaster()])

  const openNovoSheet = () => {
    tenantForm.reset({ nome: '', slug: '', ativo: true })
    setAutoSlug(true)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
  }

  const onSaveTenant = async (data: TenantFormData) => {
    try {
      const supabase = createClient()
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-foreground">Tenants</h1>
            <span className="text-muted-foreground">|</span>
            <Link
              href="/dashboard/configuracoes"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-1"
            >
              ← Configurações
            </Link>
          </div>
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
                      <Button variant="ghost" size="icon-sm" asChild aria-label="Editar tenant">
                        <Link href={`/dashboard/configuracoes/tenants/${tenant.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Link>
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

      {/* Sheet Novo Tenant */}
      <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Novo Tenant</SheetTitle>
            <SheetDescription>Cadastre uma nova organização</SheetDescription>
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
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={autoSlug} onChange={(e) => setAutoSlug(e.target.checked)} />
                Gerar slug automaticamente
              </label>
              <Label htmlFor="tenant-slug">Slug *</Label>
              <Input
                id="tenant-slug"
                {...tenantForm.register('slug')}
                placeholder="empresa-abc"
                className="font-mono"
                disabled={autoSlug}
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
    </div>
  )
}
