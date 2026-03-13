'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useUser()

  useEffect(() => {
    if (loading || !user) return

    if (!user.isMaster() && !user.isAdmin?.()) {
      toast.error('Acesso restrito a administradores.')
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  if (loading) {
    return <>{children}</>
  }

  if (!user) {
    return <>{children}</>
  }

  if (!user.isMaster() && !user.isAdmin?.()) {
    return null
  }

  return <>{children}</>
}
