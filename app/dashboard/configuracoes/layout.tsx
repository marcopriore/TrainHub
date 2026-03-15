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
    if (loading) return
    if (!user) {
      router.replace('/dashboard')
      return
    }
    if (!user.isMaster() && !user.isAdmin?.()) {
      toast.error('Acesso restrito a administradores.')
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  if (loading) return null
  if (!user) return null
  if (!user.isMaster() && !user.isAdmin?.()) return null

  return <>{children}</>
}
