/**
 * Versão atual dos textos legais no app. Ao alterar termos/política de privacidade de forma relevante,
 * incremente esta string; usuários com valor anterior (ou null) precisarão aceitar de novo.
 */
export const TERMOS_PLATAFORMA_VERSAO_ATUAL = '2026-03-30'

export const LEGAL_PATHS = {
  termos: '/legal/termos',
  privacidade: '/legal/privacidade',
} as const

export function usuarioTemTermosPlataformaAtuais(versaoArmazenada: string | null | undefined): boolean {
  return versaoArmazenada === TERMOS_PLATAFORMA_VERSAO_ATUAL
}
