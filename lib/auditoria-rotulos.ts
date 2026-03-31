/** Nomes amigáveis para tabelas registradas na auditoria (chave = nome da tabela em snake_case). */
const ENTIDADE_POR_TABELA: Record<string, string> = {
  tenants: 'organização',
  usuarios: 'usuário',
  perfis: 'perfil',
  perfil_permissoes: 'permissões do perfil',
  tenant_modulos: 'módulos da organização',
  setores: 'setor',
  categorias: 'categoria',
  empresas_parceiras: 'empresa parceira',
  colaboradores: 'colaborador',
  treinamentos: 'treinamento',
  treinamento_colaboradores: 'vínculo treinamento com colaborador',
  treinamento_parceiros: 'vínculo treinamento com parceiro',
  catalogo_treinamentos: 'item do catálogo',
  certificado_templates: 'template de certificado',
  pesquisa_formularios: 'formulário de pesquisa',
  pesquisa_perguntas: 'pergunta de pesquisa',
  pesquisa_tokens: 'token de pesquisa',
  pesquisa_respostas: 'resposta de pesquisa',
  avaliacao_formularios: 'formulário de avaliação',
  avaliacao_perguntas: 'pergunta de avaliação',
  avaliacao_tokens: 'token de avaliação',
  avaliacao_respostas: 'resposta de avaliação',
  usuario_catalogo_preferencias: 'preferências de catálogo',
  catalogo_favoritos: 'favorito no catálogo',
  catalogo_avaliacoes: 'avaliação no catálogo',
  tenant_catalogo_global_categorias: 'opt-in catálogo global',
  catalogo_global_submissoes: 'submissão ao catálogo global',
  catalogo_treinamentos_globais: 'treinamento global',
  platform_feature_flags: 'flag da plataforma',
  notificacoes: 'notificação',
  usuario_notificacoes_config: 'configuração de notificações',
}

const ACAO_EXATA: Record<string, string> = {
  login: 'Login no sistema',
  importacao_planilha_excel: 'Importação de planilha Excel',
}

const VERBO_CRUD: Record<string, string> = {
  insert: 'Criou',
  update: 'Alterou',
  delete: 'Excluiu',
}

const CRUD_PREFIX = /^(insert|update|delete)_(.+)$/i

export function rotuloEntidadeAuditoria(entidadeTabela: string): string {
  const v = ENTIDADE_POR_TABELA[entidadeTabela]
  if (v) return v.charAt(0).toUpperCase() + v.slice(1)
  return entidadeTabela.replace(/_/g, ' ')
}

export function rotuloAcaoAuditoria(acao: string): string {
  const exata = ACAO_EXATA[acao]
  if (exata) return exata

  const m = acao.match(CRUD_PREFIX)
  if (m) {
    const op = m[1].toLowerCase()
    const tabela = m[2]
    const verbo = VERBO_CRUD[op] ?? op
    const ent = ENTIDADE_POR_TABELA[tabela] ?? tabela.replace(/_/g, ' ')
    const entCapitalizada = ent.charAt(0).toUpperCase() + ent.slice(1)
    return `${verbo} ${entCapitalizada}`
  }

  return acao.replace(/_/g, ' ')
}
