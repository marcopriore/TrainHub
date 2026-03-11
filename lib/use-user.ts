'use client'

import { useContext } from 'react'
import { UserContext } from '@/lib/user-context'

export function useUser() {
  const context = useContext(UserContext)
  if (context === null) {
    throw new Error('useUser deve ser usado dentro de um UserProvider')
  }
  return context
}
