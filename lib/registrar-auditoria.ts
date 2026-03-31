import type { SupabaseClient } from '@supabase/supabase-js'

/** Insert em auditoria_eventos (RLS: insert autenticado). Falhas só em console. */
export async function registrarAuditoriaCliente(
  supabase: SupabaseClient,
  params: {
    userId: string
    tenantId: string | null
    acao: string
    entidade: string
    entidadeId?: string | null
    detalhes?: Record<string, unknown> | null
    userAgent?: string | null
  }
) {
  const { error } = await supabase.from('auditoria_eventos').insert({
    ator_id: params.userId,
    tenant_id: params.tenantId,
    acao: params.acao,
    entidade: params.entidade,
    entidade_id: params.entidadeId ?? null,
    detalhes: params.detalhes ?? null,
    user_agent: params.userAgent ?? null,
  })
  if (error) console.warn('[auditoria]', error.message)
}
