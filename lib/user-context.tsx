'use client'

import * as React from 'react'

export const PERMISSOES = [
  'registrar_treinamento',
  'editar_treinamento',
  'excluir_treinamento',
  'exportar_excel',
  'importar_planilha',
  'gerenciar_colaboradores',
  'gerenciar_setores',
  'gerenciar_empresas_parceiras',
  'gerenciar_usuarios',
] as const

export type Permissao = (typeof PERMISSOES)[number]

export interface Tenant {
  id: string
  nome: string
  slug: string
}

export interface Perfil {
  id: string
  nome: string
  is_admin: boolean
}

export interface UserContextData {
  id: string
  nome: string
  email: string
  is_master: boolean
  ativo: boolean
  tenant: Tenant | null
  perfil: Perfil | null
  permissoes: string[]
  hasPermission: (permissao: string) => boolean
  isAdmin: () => boolean
  isMaster: () => boolean
}

export interface UserContextValue {
  user: UserContextData | null
  loading: boolean
  error: string | null
}

const UserContext = React.createContext<UserContextValue | null>(null)

export { UserContext }

export function createUserWithHelpers(user: Omit<UserContextData, 'hasPermission' | 'isAdmin' | 'isMaster'>): UserContextData {
  return {
    ...user,
    hasPermission: (permissao: string) =>
      user.is_master || (user.perfil?.is_admin ?? false) || user.permissoes.includes(permissao),
    isAdmin: () => user.perfil?.is_admin ?? false,
    isMaster: () => user.is_master,
  }
}
