import type { SupabaseClient } from '@supabase/supabase-js'

export type FiltrosAuditoriaQuery = {
  busca: string
  acaoContem: string
  dataInicio: string
  dataFim: string
}

type Contagem = 'exact' | 'planned' | 'estimated'

/** Query em `auditoria_eventos` com filtros da tela; use `count` na listagem paginada, omita na exportação. */
export function auditoriaEventosFiltrados(
  supabase: SupabaseClient,
  aplicados: FiltrosAuditoriaQuery,
  count?: Contagem
) {
  let q = count
    ? supabase.from('auditoria_eventos').select('*', { count })
    : supabase.from('auditoria_eventos').select('*')

  const acaoT = aplicados.acaoContem.trim()
  if (acaoT) {
    q = q.ilike('acao', `%${acaoT.replace(/%/g, '')}%`)
  }

  const termo = aplicados.busca
    .trim()
    .replace(/[%,()*]/g, ' ')
    .trim()
  if (termo) {
    const p = `*${termo.split(/\s+/).filter(Boolean).join('*')}*`
    q = q.or(`acao.ilike.${p},entidade.ilike.${p},entidade_id.ilike.${p}`)
  }

  if (aplicados.dataInicio) {
    const start = new Date(`${aplicados.dataInicio}T00:00:00.000`)
    q = q.gte('criado_em', start.toISOString())
  }
  if (aplicados.dataFim) {
    const end = new Date(`${aplicados.dataFim}T23:59:59.999`)
    q = q.lte('criado_em', end.toISOString())
  }

  return q
}
