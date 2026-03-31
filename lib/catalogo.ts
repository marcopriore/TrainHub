export type CatalogoNivel = 'basico' | 'intermediario' | 'avancado'
export type CatalogoModalidade = 'presencial' | 'online' | 'hibrido'

export type CatalogoItem = {
  id: string
  tenant_id: string
  titulo: string
  conteudo_programatico: string | null
  objetivo: string | null
  carga_horaria: number | null
  categoria: string | null
  nivel: CatalogoNivel | null
  modalidade: CatalogoModalidade | null
  imagem_url: string | null
  status: string
  criado_em: string
  atualizado_em?: string
  /** Conteúdo aprovado no pool global (vitrine); link usa /dashboard/catalogo/global/[id] */
  origem_global?: boolean
}

export type UsuarioCatalogoPreferencias = {
  id: string
  usuario_id: string
  tenant_id: string
  categorias: string[]
  niveis: string[]
  modalidades: string[]
  atualizado_em: string
}

export const NIVEL_LABEL: Record<string, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

export const MODALIDADE_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrido: 'Híbrido',
}

export function preferenciasPreenchidas(p: UsuarioCatalogoPreferencias | null): boolean {
  if (!p) return false
  return (
    (p.categorias?.length ?? 0) > 0 ||
    (p.niveis?.length ?? 0) > 0 ||
    (p.modalidades?.length ?? 0) > 0
  )
}

/**
 * Se o usuário escolheu categorias, só entram treinamentos cuja `categoria` no catálogo
 * coincide exatamente com uma delas (ex.: "Gestão" ≠ "Soft Skills" — não há mapeamento automático).
 */
export function itemInPreferredCategories(
  item: CatalogoItem,
  prefs: UsuarioCatalogoPreferencias | null
): boolean {
  const escolhidas = prefs?.categorias?.filter(Boolean) ?? []
  if (escolhidas.length === 0) return true
  const cat = (item.categoria ?? '').trim()
  if (!cat) return false
  return escolhidas.includes(cat)
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/\W+/)
    .filter((w) => w.length > 2)
}

/** Pontuação simples (sem ML): preferências + histórico de títulos + favoritos. */
export function pontuacaoRecomendacao(
  item: CatalogoItem,
  prefs: UsuarioCatalogoPreferencias | null,
  titulosHistoricoTreinamentos: string[],
  idsFavoritos: Set<string>
): number {
  let score = 0

  if (idsFavoritos.has(item.id)) score += 1.5

  if (prefs && preferenciasPreenchidas(prefs)) {
    const cat = (item.categoria ?? '').trim()
    if (cat && prefs.categorias?.includes(cat)) score += 4

    const niv = item.nivel ?? ''
    if (niv && prefs.niveis?.includes(niv)) score += 2.5

    const mod = item.modalidade ?? ''
    if (mod && prefs.modalidades?.includes(mod)) score += 2.5
  }

  const titleTokens = new Set(tokenize(item.titulo))
  for (const nome of titulosHistoricoTreinamentos) {
    for (const w of tokenize(nome)) {
      if (titleTokens.has(w)) score += 0.6
    }
  }

  if (item.imagem_url) score += 0.3

  const ch = item.carga_horaria ?? 0
  if (ch > 0 && ch <= 4) score += 0.5

  return score
}

export function titulosCatalogoJaRealizados(
  itens: CatalogoItem[],
  titulosHistorico: string[]
): Set<string> {
  const done = new Set<string>()
  const histLower = new Set(titulosHistorico.map((t) => t.trim().toLowerCase()))
  for (const it of itens) {
    if (histLower.has(it.titulo.trim().toLowerCase())) {
      done.add(it.id)
    }
  }
  return done
}
