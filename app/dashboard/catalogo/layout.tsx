'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [modulosAtivos, setModulosAtivos] = useState<Record<string, boolean>>({})
  const [loadingModulos, setLoadingModulos] = useState(true)

  useEffect(() => {
    const fetchModulos = async () => {
      if (!activeTenantId) {
        setModulosAtivos({})
        setLoadingModulos(false)
        return
      }
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('tenant_modulos')
          .select('modulo, ativo')
          .eq('tenant_id', activeTenantId)

        const map: Record<string, boolean> = {}
        for (const row of data ?? []) {
          map[row.modulo] = row.ativo
        }
        setModulosAtivos(map)
      } catch {
        setModulosAtivos({})
      } finally {
        setLoadingModulos(false)
      }
    }

    if (user) {
      fetchModulos()
    } else {
      setLoadingModulos(false)
    }
  }, [activeTenantId, user?.id])

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (user.isMaster()) return
    if (loadingModulos) return
    if (modulosAtivos['catalogo'] !== true) {
      toast.error(
        'O catálogo não está habilitado para sua organização. Entre em contato com o administrador.'
      )
      router.replace('/dashboard')
      return
    }
    const pode =
      user.hasPermission('ver_catalogo') || user.hasPermission('gerenciar_catalogo')
    if (!pode) {
      toast.error('Você não tem permissão para acessar o catálogo. Peça ao administrador um perfil com acesso à vitrine.')
      router.replace('/dashboard')
    }
  }, [loading, user, loadingModulos, modulosAtivos, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#03120e] p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64 bg-white/10" />
        <Skeleton className="h-64 w-full rounded-2xl bg-white/10" />
        <Skeleton className="h-8 w-full bg-white/10" />
      </div>
    )
  }

  const podePerfilCatalogo =
    user.isMaster() ||
    user.hasPermission('ver_catalogo') ||
    user.hasPermission('gerenciar_catalogo')

  if (!user.isMaster() && (loadingModulos || modulosAtivos['catalogo'] !== true)) {
    if (loadingModulos) {
      return (
        <div className="min-h-screen bg-[#03120e] p-6 space-y-4 max-w-7xl mx-auto">
          <Skeleton className="h-10 w-64 bg-white/10" />
          <Skeleton className="h-64 w-full rounded-2xl bg-white/10" />
        </div>
      )
    }
    return null
  }

  if (!user.isMaster() && !loadingModulos && modulosAtivos['catalogo'] === true && !podePerfilCatalogo) {
    return null
  }

  return <>{children}</>
}
