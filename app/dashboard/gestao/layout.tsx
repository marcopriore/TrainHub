'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import { useCatalogoModuloPlataforma } from '@/lib/use-catalogo-modulo-plataforma'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/app-shell'

export default function GestaoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, getActiveTenantId } = useUser()
  const { catalogoModuloPlataformaAtivo, loadingCatalogoPlataforma } =
    useCatalogoModuloPlataforma()
  const activeTenantId = getActiveTenantId()

  const [modulosAtivos, setModulosAtivos] = useState<Record<string, boolean>>({})
  const [loadingModulos, setLoadingModulos] = useState(true)
  const modulosCarregados = Object.keys(modulosAtivos).length > 0

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

    if (!loadingCatalogoPlataforma && !catalogoModuloPlataformaAtivo) {
      const bloqueado = pathname?.includes('/gestao/configuracoes/opt-in-globais')
      if (bloqueado) {
        toast.error('O catálogo de treinamentos está desativado na plataforma.')
        router.replace('/dashboard/gestao')
      }
    }

    if (user.isMaster()) return
    if (loadingModulos || !modulosCarregados) return

    const isMinhasTrilhas = pathname?.includes('/minhas-trilhas')
    const moduloNecessario = isMinhasTrilhas ? 'trilhas' : 'gestao'
    const hasAccess = modulosAtivos[moduloNecessario] === true

    if (!hasAccess) {
      toast.error(
        'Este módulo não está habilitado para sua organização. Entre em contato com o administrador.'
      )
      router.replace('/dashboard')
    }
  }, [
    loading,
    user,
    loadingModulos,
    modulosCarregados,
    modulosAtivos,
    pathname,
    router,
    loadingCatalogoPlataforma,
    catalogoModuloPlataformaAtivo,
  ])

  if (loading || !user) {
    return <>{children}</>
  }

  const semSidebar = pathname?.includes('/minhas-trilhas')

  if (user.isMaster()) {
    if (semSidebar) {
      return <>{children}</>
    }
    return <AppShell>{children}</AppShell>
  }

  if (loadingModulos) {
    return null
  }

  const isMinhasTrilhas = pathname?.startsWith('/dashboard/gestao/minhas-trilhas')
  const hasAccess = isMinhasTrilhas
    ? modulosAtivos['trilhas'] === true
    : modulosAtivos['gestao'] === true

  if (!hasAccess) {
    return null
  }

  if (semSidebar) {
    return <>{children}</>
  }

  return <AppShell>{children}</AppShell>
}
