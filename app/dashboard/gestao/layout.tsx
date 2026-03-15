'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/app-shell'

export default function GestaoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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
    if (loading || !user) return
    if (user.isMaster()) return
    if (loadingModulos) return

    const isMinhasTrilhas = pathname?.startsWith('/dashboard/gestao/minhas-trilhas')
    const hasAccess = isMinhasTrilhas
      ? modulosAtivos['trilhas'] === true
      : modulosAtivos['gestao'] === true

    if (!hasAccess) {
      toast.error('Este módulo não está habilitado para sua organização. Entre em contato com o administrador.')
      router.replace('/dashboard')
    }
  }, [loading, user, loadingModulos, modulosAtivos, pathname, router])

  if (loading || !user) {
    return <>{children}</>
  }

  if (user.isMaster()) {
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

  return <AppShell>{children}</AppShell>
}
