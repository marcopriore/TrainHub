# TrainHub — Documento de Contexto Completo
> Atualizado em 31/03/2026 — Para continuidade em nova conversa

---

## 1. VISÃO GERAL DO SISTEMA

**TrainHub** é uma plataforma LMS/XLMS SaaS multi-tenant de gestão de treinamentos corporativos.

- **Repositório:** https://github.com/marcopriore/TrainHub.git
- **Branch principal:** `main` (produção) | `develop` (desenvolvimento)
- **Deploy PRD:** https://trainhub-app.vercel.app
- **Deploy DEV:** https://trainhub-dev.vercel.app
- **Versão atual:** v2.21.0

---

## 2. STACK TECNOLÓGICA

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js App Router + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Banco/Auth | Supabase (PostgreSQL + Auth) |
| Gráficos | Recharts |
| Formulários | react-hook-form + zod |
| Excel | xlsx-js-style |
| E-mail | Resend |
| PDF | jsPDF + html2canvas |
| Deploy | Vercel |

---

## 3. AMBIENTES

### PRD (Produção)
- **URL:** https://trainhub-app.vercel.app
- **Branch Git:** `main`
- **Supabase Project ID:** xpxddigkkanucvvhjlij
- **Vercel Project:** trainhub-app

### DEV (Desenvolvimento)
- **URL:** https://trainhub-dev.vercel.app
- **Branch Git:** `develop`
- **Supabase Project ID:** [novo projeto DEV]
- **Vercel Project:** trainhub-dev

### Fluxo de trabalho
- Desenvolvimento e integração na branch `develop` (deploy DEV na Vercel).
- Promoção para produção via merge `develop` → `main` (deploy PRD).

---

## 4. VARIÁVEIS DE AMBIENTE

### `.env.local` (local)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

### Vercel PRD
NEXT_PUBLIC_SUPABASE_URL=https://xpxddigkkanucvvhjlij.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
NEXT_PUBLIC_APP_URL=https://trainhub-app.vercel.app

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` NUNCA deve ser usada no client-side — apenas em API Routes.

---

## 5. BANCO DE DADOS (SUPABASE)

### Dados de produção (PRD)
- **Tenant Master:** slug=`trainhub-master`
- **Usuário Master:** email=`marco.priore23@gmail.com`

### Estrutura completa das tabelas
```sql
-- Tenants e usuários
tenants: id, nome, slug, ativo, criado_em
perfis: id, tenant_id, nome, is_admin, criado_em
perfil_permissoes: id, perfil_id, permissao, criado_em
usuarios: id (FK auth.users), tenant_id, perfil_id, nome, email, is_master, ativo, criado_em

-- Dados do tenant
empresas_parceiras: id, tenant_id, nome, criado_em
setores: id, tenant_id, nome, criado_em
colaboradores: id, tenant_id, nome, email, setor_id, criado_em
categorias: id, tenant_id, nome, criado_em, UNIQUE(tenant_id, nome)

-- Treinamentos
treinamentos: id, tenant_id, tipo, nome, conteudo, objetivo, carga_horaria,
              empresa_parceira_id, quantidade_pessoas, data_treinamento,
              indice_satisfacao, arquivo_url, codigo, criado_em
              (NOTA: indice_aprovacao foi REMOVIDO)
treinamento_colaboradores: id, tenant_id, treinamento_id (CASCADE), colaborador_id, criado_em
treinamento_parceiros: id, treinamento_id (CASCADE), tenant_id, nome, email, criado_em

-- Catálogo (local por tenant)
catalogo_treinamentos: id, tenant_id, titulo, conteudo_programatico, objetivo,
                       carga_horaria, categoria, nivel, modalidade, imagem_url,
                       status, criado_em, atualizado_em, criado_por,
                       (+ colunas pool global: copiado_de_global_id, pool_global_consentimento,
                       pool_global_consentimento_em, pool_global_termo_versao, pool_global_linhagem_id)

-- Catálogo global (pool TrainHub — moderação Master)
catalogo_treinamentos_globais: versões publicadas / fila de linhagem
catalogo_global_submissoes: submissões pendentes de tenants (moderação)
tenant_catalogo_global_categorias: opt-in por categoria para exibir globais na vitrine do tenant

-- Flag global de produto (uma linha; só Master atualiza)
platform_feature_flags: id (PK fixo 'singleton'),
                        catalogo_trainings_module_enabled boolean DEFAULT false,
                        atualizado_em, atualizado_por (FK usuarios)
-- Migration: supabase/migrations/20250402120000_platform_feature_flags.sql
-- RLS: SELECT authenticated; UPDATE apenas is_current_user_master()

-- Módulos por tenant
tenant_modulos: id, tenant_id, modulo, ativo, criado_em, atualizado_em
                UNIQUE(tenant_id, modulo)
                Valores: 'gestao', 'trilhas', 'avaliacoes', 'catalogo'

-- Sequência de códigos
tenant_codigo_seq: tenant_id, ultimo_numero
-- Código gerado via trigger: TH0001NC (TH + sequencial + iniciais do slug)

-- Notificações
usuario_notificacoes_config: id, usuario_id, tenant_id, notif_interna, notif_email
notificacoes: id, tenant_id, usuario_id, titulo, mensagem, lida, criado_em

-- Pesquisas de satisfação
pesquisa_formularios: id, tenant_id, nome, descricao, ativo, criado_em, atualizado_em
pesquisa_perguntas: id, formulario_id, tenant_id, texto, tipo, opcoes (JSONB), ordem, obrigatoria, criado_em
pesquisa_tokens: id, tenant_id, treinamento_id, formulario_id, respondente_nome,
                 respondente_email, respondente_tipo, token (UNIQUE), usado, criado_em, respondido_em
pesquisa_respostas: id, token_id, pergunta_id, tenant_id, valor_numerico,
                    valor_texto, opcao_selecionada, criado_em, UNIQUE(token_id, pergunta_id)

-- Certificados
certificado_templates: id, tenant_id, imagem_url, campos_posicoes (JSONB), ativo,
            criado_em, atualizado_em, UNIQUE(tenant_id)
-- campos_posicoes: { corpo: {x, y, texto, fontSize, maxWidth}, data: {x, y, texto, fontSize, maxWidth} }

-- Avaliações
avaliacao_formularios: id, tenant_id, treinamento_id, titulo, descricao, nota_minima,
                       ativo, criado_em, atualizado_em, criado_por
avaliacao_perguntas: id, formulario_id, tenant_id, texto, tipo, opcoes (JSONB),
                     resposta_correta, peso, ordem, obrigatoria, criado_em
                     tipos: multipla_escolha, verdadeiro_falso (dissertacao/escala removidos da UI)
avaliacao_tokens: id, tenant_id, formulario_id, treinamento_id, respondente_nome,
                  respondente_email, respondente_tipo, token (UNIQUE), usado,
                  nota, aprovado, criado_em, respondido_em
avaliacao_respostas: id, token_id, pergunta_id, tenant_id, valor_texto,
                     opcao_selecionada, valor_numerico, criado_em, UNIQUE(token_id, pergunta_id)
```

### Funções SQL
```sql
get_tenant_id() → UUID
is_master() → BOOLEAN
is_current_user_master() → BOOLEAN
is_current_user_admin() → BOOLEAN (SECURITY DEFINER)
update_atualizado_em() → TRIGGER
gerar_codigo_treinamento() → TRIGGER (gera TH0001NC)
```

### Storage
- **Bucket:** `certificados` (público) — armazena arte dos certificados por tenant

---

## 6. AUTENTICAÇÃO

- Supabase Auth + E-mail/senha APENAS (Google OAuth removido da UI)
- "Confirm email" **DESATIVADO** no Supabase
- Redirect URLs configuradas:
  - PRD: `https://trainhub-app.vercel.app/auth/callback`
  - PRD: `https://trainhub-app.vercel.app/auth/reset-password`
  - DEV: `https://trainhub-dev.vercel.app/auth/callback`
  - DEV: `https://trainhub-dev.vercel.app/auth/reset-password`
  - Local: `http://localhost:3000/auth/callback`
  - Local: `http://localhost:3000/auth/reset-password`

### Rotas públicas (middleware.ts)
`/login`, `/auth/callback`, `/sem-acesso`, `/auth/reset-password`,
`/pesquisa`, `/api/pesquisa`, `/avaliacao`, `/api/avaliacao`

---

## 7. ARQUITETURA MULTI-TENANT (3 CAMADAS)
Camada 1 — Tenant (tenant_modulos)
→ Master configura quais módulos a empresa contratou
Camada 2 — Perfil (perfil_permissoes)
→ Admin configura permissões internas por perfil
Camada 3 — Usuário
→ Herda permissões do perfil vinculado

**Regra:** Master sempre tem acesso total. Se tenant tem módulo ativo → todos os perfis têm acesso.

---

## 8. PERMISSÕES DO SISTEMA

| Permissão | Label |
|-----------|-------|
| `registrar_treinamento_parceiro` | Registrar Treinamento Parceiro |
| `registrar_treinamento_colaborador` | Registrar Treinamento Colaborador |
| `editar_treinamento` | Editar Treinamento |
| `excluir_treinamento` | Excluir Treinamento |
| `exportar_excel` | Exportar Excel |
| `importar_planilha` | Importação em massa via planilha |
| `gerenciar_colaboradores` | Editar/Criar Colaboradores |
| `gerenciar_setores` | Editar/Criar Setores |
| `gerenciar_empresas_parceiras` | Editar/Criar Empresas Parceiras |
| `gerenciar_usuarios` | Gerenciar Usuários |
| `gerenciar_perfis` | Gerenciar Perfis de Acesso |
| `ver_dashboard_geral` | Ver Dashboard Geral |
| `ver_minhas_trilhas` | Ver Minhas Trilhas |
| `visualizar_colaboradores` | Visualizar Colaboradores |
| `visualizar_setores` | Visualizar Setores |
| `visualizar_empresas_parceiras` | Visualizar Empresas Parceiras |
| `visualizar_historico` | Visualizar Histórico de Treinamentos |
| `visualizar_relatorios` | Visualizar Relatórios |
| `gerenciar_catalogo` | Gerenciar Catálogo de Treinamentos |
| `gerenciar_categorias` | Gerenciar Categorias de Treinamentos |
| `gerenciar_pesquisas` | Gerenciar Pesquisas de Satisfação |
| `gerenciar_avaliacoes` | Gerenciar Avaliações |

---

## 9. ESTRUTURA DE ROTAS COMPLETA
```
app/
├── login/page.tsx
├── auth/callback/route.ts
├── auth/reset-password/page.tsx
├── sem-acesso/page.tsx
├── pesquisa/[token]/page.tsx          # Pública - resposta de pesquisa
├── avaliacao/[token]/page.tsx         # Pública - resposta de avaliação
│
├── dashboard/
│   ├── layout.tsx
│   ├── page.tsx                       # HOME de Módulos
│   ├── perfil/page.tsx
│   │
│   ├── catalogo/                      # Vitrine (módulo catálogo do tenant + flag plataforma)
│   │   ├── layout.tsx                 # Guard: tenant_modulos.catalogo + flag plataforma
│   │   ├── page.tsx
│   │   ├── preferencias/page.tsx
│   │   └── [id]/page.tsx
│   │
│   ├── configuracoes/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Hub; card Plataforma (Master); card Catálogo global se flag on
│   │   ├── plataforma/page.tsx        # Master: toggle catalogo_trainings_module_enabled
│   │   ├── catalogo-global/page.tsx   # Master: moderação pool global (redirect se flag off)
│   │   ├── perfis/page.tsx
│   │   ├── usuarios/page.tsx
│   │   └── tenants/[id]/page.tsx      # Switch módulo catálogo tenant (oculto se flag plataforma off)
│   │
│   ├── avaliacoes/
│   │   ├── layout.tsx                 # Guard módulo avaliacoes
│   │   └── page.tsx                   # Dashboard de avaliações do colaborador
│   │
│   └── gestao/
│       ├── layout.tsx                 # Guard módulo gestao
│       ├── page.tsx
│       ├── treinamentos/novo/page.tsx
│       ├── historico/page.tsx
│       ├── relatorios/page.tsx
│       ├── minhas-trilhas/
│       │   ├── layout.tsx             # Layout sem sidebar
│       │   └── page.tsx
│       ├── catalogo/page.tsx
│       ├── avaliacoes/
│       │   ├── page.tsx
│       │   ├── nova/page.tsx
│       │   └── [id]/page.tsx
│       ├── pesquisas/
│       │   ├── page.tsx
│       │   ├── [id]/page.tsx
│       │   └── [id]/respostas/page.tsx
│       └── configuracoes/
│           ├── setores/page.tsx
│           ├── empresas-parceiras/page.tsx
│           ├── colaboradores/page.tsx
│           ├── categorias/page.tsx           # Sempre acessível (categorias locais)
│           └── opt-in-globais/page.tsx      # Bloqueado se flag plataforma off
│
└── api/
    ├── admin/
    │   ├── criar-usuario/route.ts
    │   ├── deletar-usuario/route.ts
    │   └── resetar-senha/route.ts
    ├── notificacoes/route.ts
    ├── pesquisa/
    │   ├── calcular-satisfacao/route.ts
    │   └── enviar-emails/route.ts     # Resend - disparo automático
    └── avaliacao/
        └── disparar/route.ts          # Resend - disparo manual
```

---

## 10. COMPONENTES E LIBS RELEVANTES
```
components/
├── app-shell.tsx                   # Sidebar; oculta “Conteúdo global (vitrine)” se flag plataforma off
├── user-provider.tsx               # Provider do contexto + cache sessionStorage
├── tenant-selector.tsx            # Seletor de tenant (master only)
├── notificacoes-sino.tsx           # Sino com badge, realtime + polling 15s
└── treinamento-import-dialog.tsx   # Dialog de importação em massa via Excel

lib/
└── use-catalogo-modulo-plataforma.ts   # Lê platform_feature_flags (singleton); expõe estado do módulo vitrine/pool
```

`.gitignore` inclui `*.tsbuildinfo` / `tsconfig.tsbuildinfo` e pastas de build comuns para permitir `git add .` sem ruído de cache TypeScript.

---

## 11. MÓDULOS DO SISTEMA

### HOME (/dashboard)
- Grid de cards de módulos
- TenantSelector inline no header (Master only)
- Verifica `tenant_modulos` para habilitar/bloquear cards
- **Card “Catálogo de Treinamentos” (vitrine):** só aparece se `catalogo_trainings_module_enabled` estiver **true** na tabela `platform_feature_flags` (após load do hook)

### Módulo: Gestão de Treinamentos (/dashboard/gestao)
- Dashboard com métricas e gráficos
- Registrar Treinamento (Parceiro/Colaborador) com wizard de importação Excel; catálogo **local** (`catalogo_treinamentos`) no seletor **independente** da flag de plataforma
- Histórico com paginação (20/página), filtros avançados, exportação Excel
- Relatórios com infinite scroll, filtros Curso/Turma server-side
- **Treinamentos (gestão do catálogo local):** `/gestao/catalogo` — **sempre acessível** com módulo gestão ativo; template de certificado; quando a flag plataforma está **off**: ocultam-se apenas **“Importar do global”** e o bloco de **consentimento / fila para o pool global**; gravar continua preservando metadados de pool já existentes no registro se o item estiver ativo
- **Configurações → Categorias:** acessíveis com flag off (categorias **locais** para cadastros e registros)
- **Configurações → Conteúdo global (opt-in vitrine):** bloqueado (redirect) quando flag plataforma off
- Pesquisas de satisfação com disparo por e-mail (Resend)
- Avaliações com disparo por e-mail (Resend)

### Flag global do catálogo (Master — Configurações → Plataforma)
- Tabela `platform_feature_flags`, linha `id = 'singleton'`, campo `catalogo_trainings_module_enabled` (default **false** após migration)
- **Quando false (módulo “oculto” para vitrine/pool):**
  - Vitrine `/dashboard/catalogo/*` bloqueada no layout (toast + redirect)
  - Hub Configurações: card **Catálogo global** (moderação) oculto; página `catalogo-global` redireciona (Master → Plataforma; demais → hub)
  - Menu Gestão: item **Conteúdo global (vitrine)** oculto; **opt-in-globais** bloqueado no `gestao/layout`
  - **Perfis:** grupo de permissões “Módulo: Catálogo de Treinamentos” oculto no diálogo enquanto a flag estiver off (após load; durante load mostra todos para evitar flash)
  - **Tenant [id]:** switch do módulo catálogo do tenant oculto quando flag off
- **Quando true:** vitrine, pool (import, consentimento, submissões, moderação Master, opt-in), menus e permissões voltam ao comportamento completo

### Módulo: Catálogo — Vitrine (/dashboard/catalogo)
- Preferências do colaborador, listagem e detalhe `/[id]`; exige `tenant_modulos.catalogo` e permissões de vitrine
- **Desligada** quando `catalogo_trainings_module_enabled` é false: layout redireciona para `/dashboard` (com feedback)

### Módulo: Minhas Trilhas (/dashboard/gestao/minhas-trilhas)
- Sem sidebar (layout isolado)
- Cards: Total de Horas, Treinamentos Realizados, Último Treinamento
- Tabela com status de pesquisa e botão de certificado PDF
- Certificado bloqueado até pesquisa respondida

### Módulo: Avaliações (/dashboard/avaliacoes)
- Sem sidebar (layout isolado)
- Cards: Total, Pendentes, Reprovadas
- Tabela com status e link para responder/ver avaliação

---

## 12. FLUXOS IMPORTANTES

### Código de treinamento (TH0001NC)
- Gerado automaticamente via trigger `trigger_gerar_codigo_treinamento`
- Formato: TH + sequencial 4 dígitos + iniciais do slug do tenant
- Sequência por tenant armazenada em `tenant_codigo_seq`

### Certificado PDF
- Template configurado por tenant em `certificado_templates`
- Arte: upload PNG/JPG no Supabase Storage (bucket `certificados`)
- Editor: drag-and-drop com caixas de texto editáveis e variáveis
- Variáveis: `{{nome}}`, `{{treinamento}}`, `{{carga_horaria}}`, `{{data}}`
- Geração: `gerarCertificadoPDF()` exportada de `catalogo/page.tsx`
- Bloqueio: certificado só liberado após pesquisa respondida (ou dispensado)

### Pesquisa de Satisfação
- Criada por admin em `/gestao/pesquisas`
- Vinculada ao treinamento no momento do registro (modo "Via Pesquisa")
- Tokens gerados com `respondente_nome` e `respondente_email`
- E-mail disparado automaticamente via Resend ao salvar
- Página pública: `/pesquisa/[token]`
- Cálculo automático: `((media-1)/4)*100`

### Avaliação
- Criada por admin em `/gestao/avaliacoes/nova`
- Tipos de pergunta: `multipla_escolha`, `verdadeiro_falso`
- Disparo manual via botão "Disparar" na listagem
- Tokens gerados por participante (colaboradores + parceiros)
- Página pública: `/avaliacao/[token]`
- Cálculo: (acertos / total_com_resposta_correta) * 100
- Aprovação: nota >= nota_minima configurada no formulário

### Importação em massa (Excel)
- Aba "Treinamentos": dados do treinamento com coluna # (índice)
- Aba "Participantes": Treinamento #, Nome, E-mail
- Validação: e-mail de colaborador deve existir no sistema
- Parceiros salvos em `treinamento_parceiros`

### Pool global e flag de plataforma (operação)
- **Migration obrigatória:** `supabase/migrations/20250402120000_platform_feature_flags.sql` — insere linha `singleton` com `catalogo_trainings_module_enabled = false` por defeito
- **Master** ativa/desativa em `/dashboard/configuracoes/plataforma`; client lê via `lib/use-catalogo-modulo-plataforma.ts`
- Com flag **off**, tenants continuam a usar **gestão local**, **categorias**, **registro de treinamentos** e cópias já importadas do global; não há envio novo à fila nem UI de import/consent até reativar

---

## 13. REGRAS DE DESENVOLVIMENTO

- **Cor destaque:** teal `#00C9A7`
- Todos os `<Select>` usam `Controller` do react-hook-form
- Campos `<Textarea>` usam `Controller`
- Redirecionamentos: `useEffect` + `router.push()` (NUNCA `redirect()` durante render)
- Hooks sempre no topo, antes de qualquer `return` condicional
- `SUPABASE_SERVICE_ROLE_KEY` NUNCA no client-side
- Usar `.maybeSingle()` em vez de `.single()`
- Datas `YYYY-MM-DD`: usar `split('-')` para formatar, NUNCA `new Date()` (timezone bug)
- `modulosCarregados = Object.keys(modulosAtivos).length > 0` para evitar race condition no F5
- Cache do UserProvider: `sessionStorage` com TTL 5min (`trainhub_user_cache_v1`)
- Polling padrão: 15s com visibilitychange listener

---

## 14. VERSÕES PUBLICADAS

| Versão | Descrição |
|--------|-----------|
| v1.0.0 | MVP: auth, dashboard, histórico, registro e edição |
| v1.1.0 | Importação em massa via planilha Excel |
| v1.2.0 | Relatórios + exportação Excel formatada |
| v1.3.0 | Deploy em produção na Vercel |
| v1.4.0 | Multi-tenant + UserProvider + login e-mail/senha |
| v2.0.0 | Gestão completa de tenants |
| v2.1.0 | Multi-tenant completo + controle de permissões |
| v2.2.0 | Minhas Trilhas + permissões granulares |
| v2.3.0 | Isolamento de dados por colaborador |
| v2.4.0 | Meu Perfil, notificações com sino |
| v2.5.0 | Home de Módulos LMS |
| v2.6.0 | Configurações do Hub |
| v2.7.0 | Perfis de acesso hierárquico |
| v2.8.0 | Módulos por tenant (tenant_modulos) |
| v2.9.0 | Catálogo de treinamentos e Categorias |
| v2.10.0 | Pesquisas de Satisfação completas |
| v2.11.0 | Tela de respostas de pesquisa com tabela expansível |
| v2.11.1 | Fix botão voltar e refatoração tabela respostas |
| v2.12.0 | Código identificador TH0001NC via trigger Supabase |
| v2.12.1 | Fix trigger gerar_codigo_treinamento reativado |
| v2.12.2 | Fix backfill de códigos existentes |
| v2.12.3 | Histórico ordenado por código decrescente |
| v2.13.0 | Relatórios: filtros Curso/Turma e infinite scroll |
| v2.13.1 | Performance: cache UserProvider, Promise.all, prefetch |
| v2.13.2 | Fix import useRef em relatórios |
| v2.13.3 | Seletor de tenant inline na HOME e headers padronizados |
| v2.13.4 | Logs de erro melhorados |
| v2.14.0 | Minhas Trilhas reescrito como dashboard pessoal |
| v2.14.1 | Minhas Trilhas: botão certificado, sem sidebar |
| v2.14.2 | Minhas Trilhas: header próprio e colunas centralizadas |
| v2.14.3 | Headers padronizados em todas as telas |
| v2.15.0 | Perfil: alteração de senha com validação Supabase Auth |
| v2.15.1 | Login apenas e-mail/senha, Google OAuth removido da UI |
| v2.15.2 | Fix fluxo esqueci senha e URLs de redirect |
| v2.16.0 | Template de certificado por tenant com upload e preview |
| v2.16.1 | Certificado: drag-and-drop de campos e persistência |
| v2.16.2 | Certificado: caixas editáveis com variáveis e geração PDF |
| v2.16.3 | Certificado: PDF via iframe, escala proporcional |
| v2.16.4 | Minhas Trilhas: download de certificado integrado |
| v2.17.0 | Minhas Trilhas: coluna Pesquisa e bloqueio de certificado |
| v2.17.1 | Fix: header coluna Pesquisa e URL do token pendente |
| v2.17.2 | Fix: data com timezone e modal pesquisa sem duplicar |
| v2.17.3 | Fix: datas sem offset timezone em todas as telas |
| v2.17.4 | Fix: race condition no carregamento de módulos (F5) |
| v2.17.5 | Fix: status Respondida vs Dispensado no Minhas Trilhas |
| v2.18.0 | Importação de planilha com wizard 3 etapas |
| v2.18.1 | Layout: campos em linha no formulário de registro |
| v2.18.2 | Importação em massa: aba Participantes com índice |
| v2.18.3 | Histórico: botão Ver Participantes e filtro por nome |
| v2.18.4 | Histórico: paginação 20 registros e exportação Excel |
| v2.19.0 | Módulo Avaliações: dashboard, gestão e perguntas |
| v2.19.1 | Avaliações: tela de criação com dialog de perguntas |
| v2.19.2 | Avaliações: tela pública de resposta e cálculo de nota |
| v2.19.3 | Avaliações: tipos simplificados e listagem no histórico |
| v2.19.4 | Avaliações: disparo de e-mails via Resend |
| v2.19.5 | Fix: contagem correta de e-mails enviados |
| v2.19.6 | Fix: sem modo leitura e coluna Avaliação no histórico |
| v2.19.7 | Histórico: coluna Avaliação substitui Aprovação |
| v2.20.0 | Pesquisa: disparo automático de e-mail via Resend |
| v2.20.1 | Fix: pesquisa_tokens com nome e email preenchidos |
| v2.20.2 | Fix: tenant incorreto na criação de usuário |
| v2.20.3 | Fix: e-mail duplicado com mensagem em português |
| v2.21.0 | Flag global `platform_feature_flags` (Master); kill switch vitrine/pool; gestão local de treinamentos, categorias e registro preservados; `.gitignore` para `tsbuildinfo` |

---

## 15. PENDÊNCIAS E PRÓXIMOS PASSOS

### 🔴 Bugs conhecidos
- *(nenhum bloqueante documentado aqui; revisar a cada release)*

### ✓ Corrigido recentemente (mar/2026)
- [x] Remoção global de referências a `indice_aprovacao` no app após exclusão da coluna em `treinamentos` (Supabase). As telas de **Dashboard**, **Histórico**, **Relatórios**, importação Excel, KPIs e `scripts/seed.ts` deixam de selecionar/atualizar esse campo — fim do erro **42703 / 400** por coluna inexistente.

### 🟡 Melhorias planejadas
- [ ] Notificações por e-mail para colaboradores (toggle existe, envio não implementado)
- [ ] Aplicar permissão `importar_planilha` na tela de importação do histórico
- [ ] Segurança/LGPD: auditoria completa de RLS, API Routes e dados sensíveis
- [ ] Tela de perfil do usuário: editar nome e foto

### 🟢 Módulos futuros planejados
- [x] **Catálogo de Treinamentos** (vitrine + gestão local + pool global): entregue; controlado por `tenant_modulos.catalogo` e flag plataforma `catalogo_trainings_module_enabled`
- [ ] **Trilhas de Conhecimento** estruturadas com sequência de treinamentos
- [ ] **Próximos Treinamentos** (matrículas/agendamentos)
- [ ] Reenvio individual de avaliação por participante

### 🟢 Funcionando 100%
- [x] Multi-tenant com RLS completo
- [x] Login e-mail/senha (Google OAuth removido)
- [x] Separação DEV/PRD (Vercel + Supabase)
- [x] Código identificador TH0001NC por treinamento
- [x] Importação em massa com aba de participantes
- [x] Pesquisas de satisfação com disparo por e-mail
- [x] Avaliações com cálculo de nota e disparo por e-mail
- [x] Certificado PDF com template drag-and-drop
- [x] Minhas Trilhas com controle de pesquisa/certificado
- [x] Histórico com paginação, filtros e exportação Excel
- [x] Relatórios com infinite scroll e filtros avançados
- [x] Headers padronizados em todas as telas
- [x] Cache de performance no UserProvider
- [x] Fix de timezone em datas
- [x] Schema de treinamentos sem `indice_aprovacao`: front e seeds alinhados ao banco
- [x] Migration `20250402120000_platform_feature_flags` e hook `useCatalogoModuloPlataforma` para esconder vitrine/pool sem desligar gestão local

---

## 16. ROTINA DE VERSIONAMENTO
```bash
git add .                    # Respeita .gitignore (incl. *.tsbuildinfo, .next, .env.local)
git commit -m "feat/fix/chore: descrição"
git tag -a vX.Y.Z -m "vX.Y.Z - descrição"
git push origin develop        # deploy DEV
git push origin vX.Y.Z

# Para PRD:
git checkout main
git merge develop
git push origin main           # deploy PRD
git checkout develop
```

---

## 17. PREMISSAS DE DESENVOLVIMENTO

- Usar Cursor para codificação com prompts bem estruturados
- Colocar no prompt pontos de atenção que não podem ser modificados
- Sempre utilizar os padrões de cores e identidade da marca
- Sempre deixar o código otimizado e com segurança
- Sempre indicar o local do comando (Cursor, PowerShell, Navegador, Supabase SQL Editor)
- Ir passo a passo para corrigir erros de imediato
- Não passar o código completo no prompt, apenas indicações
- Encapsular o prompt para copiar e colar diretamente
- Manter sempre o versionamento no git com as tags

---

*Documento gerado automaticamente para continuidade do desenvolvimento.*
*Versão atual: v2.21.0 | Última atualização: 31/03/2026*
