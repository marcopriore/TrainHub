'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'

export default function GestaoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useUser()

  useEffect(() => {
    if (loading || !user) return

    if (user.isMaster()) return

    const isMinhasTrilhas = pathname?.startsWith('/dashboard/gestao/minhas-trilhas')
    const requiredPerm = isMinhasTrilhas ? 'acessar_modulo_trilhas' : 'acessar_modulo_gestao'
    const hasAccess = user.hasPermission(requiredPerm)

    if (!hasAccess) {
      toast.error('Você não tem permissão para acessar este módulo.')
      router.replace('/dashboard')
    }
  }, [loading, user, pathname, router])

  if (loading) {
    return <>{children}</>
  }

  if (!user) {
    return <>{children}</>
  }

  if (user.isMaster()) {
    return <AppShell>{children}</AppShell>
  }

  const isMinhasTrilhas = pathname?.startsWith('/dashboard/gestao/minhas-trilhas')
  const requiredPerm = isMinhasTrilhas ? 'acessar_modulo_trilhas' : 'acessar_modulo_gestao'
  const hasAccess = user.hasPermission(requiredPerm)

  if (!hasAccess) {
    return null
  }

  return <AppShell>{children}</AppShell>
}
