'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Power,
  PowerOff,
  LayoutGrid,
  ClipboardList,
  BookOpen,
  Library,
  Award,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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

type TenantModuloKey = 'gestao' | 'trilhas' | 'catalogo' | 'avaliacoes'

const COR_GESTAO = '#00C9A7'
const COR_TRILHAS = '#3b82f6'
const COR_CATALOGO = '#8b5cf6'
const COR_AVALIACOES = '#f59e0b'

export default function TenantEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string | undefined
  const { user, loading: userLoading } = useUser()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modulos, setModulos] = useState<Record<TenantModuloKey, boolean>>({
    gestao: false,
    trilhas: false,
    catalogo: false,
    avaliacoes: false,
  })
  const [moduloSaving, setModuloSaving] = useState<string | null>(null)

  const tenantForm = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
  })

  const supabase = createClient()

  useEffect(() => {
    if (!userLoading && (!user || !user.isMaster())) {
      router.push('/dashboard')
      return
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!id) return

    const fetch = async () => {
      setLoading(true)
      try {
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('id, nome, slug, ativo, criado_em')
          .eq('id', id)
          .single()

        if (tenantErr || !tenantData) {
          toast.error('Tenant não encontrado')
          router.replace('/dashboard/configuracoes/tenants')
          return
        }

        setTenant(tenantData as Tenant)
        tenantForm.reset({
          nome: (tenantData as Tenant).nome,
          slug: (tenantData as Tenant).slug,
          ativo: (tenantData as Tenant).ativo,
        })

        const { data: modulosData, error: modulosErr } = await supabase
          .from('tenant_modulos')
          .select('modulo, ativo')
          .eq('tenant_id', id)

        if (modulosErr) throw modulosErr

        const row = (m: string) =>
          (modulosData ?? []).find((r) => r.modulo === m)?.ativo ?? false
        setModulos({
          gestao: row('gestao'),
          trilhas: row('trilhas'),
          catalogo: row('catalogo'),
          avaliacoes: row('avaliacoes'),
        })
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar tenant')
        router.replace('/dashboard/configuracoes/tenants')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [id, router, supabase])

  const onSaveTenant = async (data: TenantFormData) => {
    if (!id) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ nome: data.nome, slug: data.slug, ativo: data.ativo })
        .eq('id', id)

      if (error) {
        if (error.code === '23505') toast.error('Slug já existe. Escolha outro.')
        else toast.error(error.message)
        return
      }
      toast.success('Tenant atualizado com sucesso.')
      setTenant((prev) => (prev ? { ...prev, ...data } : null))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleTenantAtivo = async () => {
    if (!tenant) return
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ ativo: !tenant.ativo })
        .eq('id', id)

      if (error) throw error
      toast.success(tenant.ativo ? 'Tenant desativado' : 'Tenant ativado')
      setTenant((prev) => (prev ? { ...prev, ativo: !prev.ativo } : null))
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const toggleModulo = async (modulo: TenantModuloKey, ativo: boolean) => {
    if (!id) return
    setModuloSaving(modulo)
    try {
      const { error } = await supabase.from('tenant_modulos').upsert(
        {
          tenant_id: id,
          modulo,
          ativo,
        },
        { onConflict: 'tenant_id,modulo' }
      )

      if (error) throw error
      setModulos((prev) => ({
        ...prev,
        [modulo]: ativo,
      }))
      toast.success(
        ativo ? 'Módulo habilitado.' : 'Módulo desabilitado.'
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao atualizar módulo'
      )
    } finally {
      setModuloSaving(null)
    }
  }

  if (userLoading || (!user || !user.isMaster())) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  if (loading || !tenant) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/configuracoes/tenants" aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Editar Tenant
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{tenant.nome}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTenantAtivo}
          className="gap-2 shrink-0"
        >
          {tenant.ativo ? (
            <>
              <PowerOff className="w-4 h-4" />
              Desativar
            </>
          ) : (
            <>
              <Power className="w-4 h-4 text-green-600" />
              Ativar
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1 — Dados do Tenant */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">
            Dados do Tenant
          </h3>
          <form
            onSubmit={tenantForm.handleSubmit(onSaveTenant)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="tenant-nome">Nome do tenant</Label>
              <Input
                id="tenant-nome"
                {...tenantForm.register('nome')}
                placeholder="Ex: Empresa ABC"
                className="h-8 text-sm"
              />
              {tenantForm.formState.errors.nome && (
                <p className="text-sm text-destructive">
                  {tenantForm.formState.errors.nome.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug</Label>
              <Input
                id="tenant-slug"
                {...tenantForm.register('slug')}
                placeholder="empresa-abc"
                className="font-mono h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hífens
              </p>
              {tenantForm.formState.errors.slug && (
                <p className="text-sm text-destructive">
                  {tenantForm.formState.errors.slug.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </div>

        {/* Card 2 — Módulos Habilitados */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Módulos</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Defina quais módulos este tenant tem acesso
          </p>

          <div className="space-y-4">
            {/* Gestão de Treinamentos */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${COR_GESTAO}20`,
                    color: COR_GESTAO,
                  }}
                >
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    Gestão de Treinamentos
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Registro e acompanhamento de treinamentos corporativos
                  </p>
                </div>
              </div>
              <Switch
                checked={modulos.gestao}
                onCheckedChange={(checked) =>
                  toggleModulo('gestao', checked === true)
                }
                disabled={moduloSaving === 'gestao'}
              />
            </div>

            {/* Trilhas de Conhecimento */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${COR_TRILHAS}20`,
                    color: COR_TRILHAS,
                  }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    Trilhas de Conhecimento
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Acompanhamento de trilhas de aprendizado
                  </p>
                </div>
              </div>
              <Switch
                checked={modulos.trilhas}
                onCheckedChange={(checked) =>
                  toggleModulo('trilhas', checked === true)
                }
                disabled={moduloSaving === 'trilhas'}
              />
            </div>

            {/* Catálogo de Treinamentos */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${COR_CATALOGO}20`,
                    color: COR_CATALOGO,
                  }}
                >
                  <Library className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    Catálogo de Treinamentos
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vitrine de programas, preferências, favoritos e avaliações internas
                  </p>
                </div>
              </div>
              <Switch
                checked={modulos.catalogo}
                onCheckedChange={(checked) =>
                  toggleModulo('catalogo', checked === true)
                }
                disabled={moduloSaving === 'catalogo'}
              />
            </div>

            {/* Avaliações e Certificados */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${COR_AVALIACOES}20`,
                    color: COR_AVALIACOES,
                  }}
                >
                  <Award className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    Avaliações e Certificados
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Módulo de avaliações e certificados para colaboradores
                  </p>
                </div>
              </div>
              <Switch
                checked={modulos.avaliacoes}
                onCheckedChange={(checked) =>
                  toggleModulo('avaliacoes', checked === true)
                }
                disabled={moduloSaving === 'avaliacoes'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
