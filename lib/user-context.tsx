'use client'

import * as React from 'react'

export const PERMISSOES = [
  'visualizar_colaboradores',
  'editar_colaboradores',
  'visualizar_setores',
  'editar_setores',
  'visualizar_empresas_parceiras',
  'editar_empresas_parceiras',
  'visualizar_historico',
  'registrar_treinamento_parceiro',
  'registrar_treinamento_colaborador',
  'editar_treinamento',
  'excluir_treinamento',
  'importar_planilha',
  'visualizar_relatorios',
  'exportar_excel',
  'gerenciar_usuarios',
  'gerenciar_perfis',
  // Legado (mapeiam para múltiplas permissões)
  'gerenciar_colaboradores',
  'gerenciar_setores',
  'gerenciar_empresas_parceiras',
  'ver_dashboard_geral',
  'ver_minhas_trilhas',
  'gerenciar_catalogo',
  'gerenciar_categorias',
  'gerenciar_pesquisas',
  'gerenciar_avaliacoes',
] as const

export const PERMISSOES_LABELS: Record<string, string> = {
  visualizar_colaboradores: 'Visualizar Colaboradores',
  editar_colaboradores: 'Editar/Criar Colaboradores',
  visualizar_setores: 'Visualizar Setores',
  editar_setores: 'Editar/Criar Setores',
  visualizar_empresas_parceiras: 'Visualizar Empresas Parceiras',
  editar_empresas_parceiras: 'Editar/Criar Empresas Parceiras',
  visualizar_historico: 'Visualizar Histórico de Treinamentos',
  registrar_treinamento_parceiro: 'Registrar Treinamento Parceiro',
  registrar_treinamento_colaborador: 'Registrar Treinamento Colaborador',
  editar_treinamento: 'Editar Treinamento',
  excluir_treinamento: 'Excluir Treinamento',
  importar_planilha: 'Importação em massa via planilha',
  visualizar_relatorios: 'Visualizar Relatórios',
  exportar_excel: 'Exportar para Excel',
  gerenciar_usuarios: 'Gerenciar Usuários',
  gerenciar_perfis: 'Gerenciar Perfis de Acesso',
  ver_dashboard_geral: 'Ver Dashboard Geral',
  ver_minhas_trilhas: 'Ver Minhas Trilhas',
  gerenciar_catalogo: 'Gerenciar Catálogo de Treinamentos',
  gerenciar_categorias: 'Gerenciar Categorias de Treinamentos',
  gerenciar_pesquisas: 'Gerenciar Pesquisas de Satisfação',
  gerenciar_avaliacoes: 'Gerenciar Avaliações',
}

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
  selectedTenantId: string | null
  selectedTenant: Tenant | null
  setSelectedTenant: (tenant: Tenant | null) => void
  getActiveTenantId: () => string | null
}

const UserContext = React.createContext<UserContextValue | null>(null)

export { UserContext }

const LEGACY_MAP: Record<string, string[]> = {
  gerenciar_colaboradores: ['visualizar_colaboradores', 'editar_colaboradores'],
  gerenciar_setores: ['visualizar_setores', 'editar_setores'],
  gerenciar_empresas_parceiras: ['visualizar_empresas_parceiras', 'editar_empresas_parceiras'],
}

export function createUserWithHelpers(user: Omit<UserContextData, 'hasPermission' | 'isAdmin' | 'isMaster'>): UserContextData {
  const hasPermission = (permissao: string) => {
    if (user.is_master || (user.perfil?.is_admin ?? false)) return true
    if (user.permissoes.includes(permissao)) return true
    for (const [legacy, permList] of Object.entries(LEGACY_MAP)) {
      if (permList.includes(permissao) && user.permissoes.includes(legacy)) return true
    }
    return false
  }
  return {
    ...user,
    hasPermission,
    isAdmin: () => user.perfil?.is_admin ?? false,
    isMaster: () => user.is_master,
  }
}

export function getActiveTenantId(
  user: UserContextData | null,
  selectedTenantId: string | null
): string | null {
  if (!user) return null
  if (user.is_master) return selectedTenantId ?? user.tenant?.id ?? null
  return user.tenant?.id ?? null
}
