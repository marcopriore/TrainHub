/** Versão do termo de consentimento para envio ao pool global (incremente quando o texto mudar). */
export const POOL_GLOBAL_TERMO_VERSAO = '2026-03-30'

/** Texto exibido no modal de aceite (sem PII; política detalhada pode ser link externo depois). */
export const POOL_GLOBAL_TERMO_TEXTO = `Ao marcar esta opção, você autoriza a TrainHub a incluir metadados e conteúdo programático deste treinamento (titulação, objetivos, carga horária, nível, modalidade, categoria e textos descritivos que você cadastrou) no catálogo global da plataforma, para que outros clientes possam visualizar e importar uma cópia para o ambiente deles.

Não envie dados pessoais, confidenciais ou restritos no conteúdo programático ou nos campos do catálogo. O conteúdo permanece sob sua responsabilidade.

Itens em rascunho ou inativos não entram na fila. Somente a equipe Master aprova a publicação global. Você pode deixar de marcar esta opção no cadastro local; isso não remove versões já aprovadas no global, que são tratadas pela moderação Master.`

export function termoPoolGlobalAtual(
  consentimentoNoBanco: boolean,
  versaoNoBanco: string | null | undefined
): boolean {
  return consentimentoNoBanco === true && versaoNoBanco === POOL_GLOBAL_TERMO_VERSAO
}
