'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'

/**
 * Controle Master em `platform_feature_flags`: quando false, o módulo Catálogo
 * (vitrine, gestão, pool global na UI, etc.) fica oculto para todos.
 */
export function useCatalogoModuloPlataforma() {
  const { user, loading: userLoading } = useUser()
  const [catalogoModuloPlataformaAtivo, setCatalogoModuloPlataformaAtivo] = useState(false)
  const [loadingCatalogoPlataforma, setLoadingCatalogoPlataforma] = useState(true)

  const refetchCatalogoPlataforma = useCallback(async () => {
    if (!user) {
      setCatalogoModuloPlataformaAtivo(false)
      setLoadingCatalogoPlataforma(false)
      return
    }
    setLoadingCatalogoPlataforma(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('platform_feature_flags')
        .select('catalogo_trainings_module_enabled')
        .eq('id', 'singleton')
        .maybeSingle()
      if (error) throw error
      setCatalogoModuloPlataformaAtivo(data?.catalogo_trainings_module_enabled === true)
    } catch {
      setCatalogoModuloPlataformaAtivo(false)
    } finally {
      setLoadingCatalogoPlataforma(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      setLoadingCatalogoPlataforma(false)
      setCatalogoModuloPlataformaAtivo(false)
      return
    }
    void refetchCatalogoPlataforma()
  }, [user, userLoading, refetchCatalogoPlataforma])

  return {
    catalogoModuloPlataformaAtivo,
    loadingCatalogoPlataforma,
    refetchCatalogoPlataforma,
  }
}
