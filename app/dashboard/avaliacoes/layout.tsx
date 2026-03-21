'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

// NOTA: Habilitar o módulo Avaliações no Supabase:
// INSERT INTO tenant_modulos (tenant_id, modulo, ativo) VALUES ('<tenant_id>', 'avaliacoes', true);

export default function AvaliacoesLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading, getActiveTenantId } = useUser()
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

    if (user.isMaster?.()) return
    if (loadingModulos || !modulosCarregados) return

    const hasAccess = modulosAtivos['avaliacoes'] === true

    if (!hasAccess) {
      toast.error(
        'Este módulo não está habilitado para sua organização. Entre em contato com o administrador.'
      )
      router.replace('/dashboard')
    }
  }, [loading, user, loadingModulos, modulosCarregados, modulosAtivos, router])

  if (loading || !user) {
    return <>{children}</>
  }

  if (user.isMaster?.()) {
    return <>{children}</>
  }

  if (loadingModulos) {
    return null
  }

  const hasAccess = modulosAtivos['avaliacoes'] === true

  if (!hasAccess) {
    return null
  }

  return <>{children}</>
}
