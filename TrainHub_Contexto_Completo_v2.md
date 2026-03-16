# TrainHub — Documento de Contexto Completo
> Gerado em 15/03/2026 — Para continuidade em nova conversa

---

## 1. VISÃO GERAL DO SISTEMA

**TrainHub** é uma plataforma LMS/XLMS SaaS multi-tenant de gestão de treinamentos corporativos.

- **Repositório:** https://github.com/marcopriore/TrainHub.git
- **Branch principal:** `main` (produção) | `master` (desenvolvimento)
- **Deploy produção:** https://trainhub-app.vercel.app
- **Vercel project:** trainhub-app
- **Versão atual:** v2.17.4

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
| Deploy | Vercel |

---

## 3. VARIÁVEIS DE AMBIENTE

### `.env.local` (local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Vercel (produção)
As três variáveis acima devem estar configuradas em:
Vercel → Project Settings → Environment Variables → All Environments

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` NUNCA deve ser usada no client-side — apenas em API Routes.

---

## 4. BANCO DE DADOS (SUPABASE)

### Dados de produção
- **Tenant Master:** id=`08329d09-23a2-4c61-8aa3-a911dc99d654`, slug=`master`
- **Usuário Master:** id=`26e465c4-680f-4614-b0db-a622ab5ff575`, email=`marco.priore23@gmail.com`
- **Tenant Neo Crédito:** id=`f6386b48-2629-405f-8f6c-01dd049d6b2f`, slug=`neo-credito`

### Estrutura completa das tabelas

```sql
-- Tenants
tenants: id, nome, slug, ativo, criado_em

-- Perfis de acesso por tenant
perfis: id, tenant_id, nome, is_admin, criado_em

-- Permissões por perfil
perfil_permissoes: id, perfil_id, permissao, criado_em

-- Usuários do sistema
usuarios: id (FK auth.users), tenant_id, perfil_id, nome, email, is_master, ativo, criado_em

-- Dados do tenant
empresas_parceiras: id, tenant_id, nome, criado_em
setores: id, tenant_id, nome, criado_em
colaboradores: id, tenant_id, nome, email, setor_id, criado_em
categorias: id, tenant_id, nome, criado_em, UNIQUE(tenant_id, nome)

-- Treinamentos realizados (histórico)
treinamentos: id, tenant_id, tipo, nome, conteudo, objetivo, carga_horaria,
              empresa_parceira_id, quantidade_pessoas, data_treinamento,
              indice_satisfacao, indice_aprovacao, arquivo_url, criado_em,
              codigo (TEXT UNIQUE gerado por trigger trigger_gerar_codigo_treinamento no formato TH0001NC)
treinamento_colaboradores: id, tenant_id, treinamento_id (CASCADE), colaborador_id, criado_em

-- Catálogo de treinamentos (cadastro)
catalogo_treinamentos: id, tenant_id, titulo, conteudo_programatico, objetivo,
                       carga_horaria, categoria, nivel (basico/intermediario/avancado),
                       modalidade (presencial/online/hibrido), imagem_url,
                       status (ativo/inativo/rascunho), criado_em, atualizado_em, criado_por

-- Sequência de códigos por tenant
tenant_codigo_seq: tenant_id, ultimo_numero

-- Módulos por tenant
tenant_modulos: id, tenant_id, modulo (text), ativo (bool), criado_em, atualizado_em
                UNIQUE(tenant_id, modulo)
                Valores de modulo: 'gestao', 'trilhas' (futuros: 'catalogo', 'avaliacoes')

-- Notificações
usuario_notificacoes_config: id, usuario_id, tenant_id, notif_interna (bool, default true),
                              notif_email (bool, default false), criado_em, atualizado_em
                              UNIQUE(usuario_id)
notificacoes: id, tenant_id, usuario_id, titulo, mensagem, lida (bool, default false), criado_em

-- Templates de certificado
certificado_templates: id, tenant_id, imagem_url, campos_posicoes (JSONB), ativo, criado_em, atualizado_em
                       UNIQUE(tenant_id)

-- Pesquisas de satisfação
pesquisa_formularios: id, tenant_id, nome, descricao, ativo (bool, default true),
                      criado_em, atualizado_em
pesquisa_perguntas: id, formulario_id, tenant_id, texto, tipo (escala/multipla_escolha/texto_livre),
                    opcoes (JSONB), ordem (int), obrigatoria (bool), criado_em
pesquisa_tokens: id, tenant_id, treinamento_id, formulario_id, respondente_nome,
                 respondente_email, respondente_tipo (colaborador/parceiro),
                 token (TEXT UNIQUE), usado (bool, default false), criado_em, respondido_em
pesquisa_respostas: id, token_id, pergunta_id, tenant_id, valor_numerico,
                    valor_texto, opcao_selecionada, criado_em
                    UNIQUE(token_id, pergunta_id)
```

### Funções SQL
```sql
get_tenant_id() → UUID              -- retorna tenant_id do usuário logado
is_master() → BOOLEAN               -- retorna se o usuário logado é master
is_current_user_master() → BOOLEAN  -- alias usado nas migrations
is_current_user_admin() → BOOLEAN   -- verifica is_admin via JOIN usuarios+perfis (SECURITY DEFINER)
update_atualizado_em() → TRIGGER    -- atualiza coluna atualizado_em
```

### RLS (Row Level Security)
- Todas as tabelas têm RLS habilitado
- Isolamento por `tenant_id` em todas as tabelas de dados
- Master tem acesso total via `is_current_user_master()`
- Admin tem acesso via `is_current_user_admin()` (SECURITY DEFINER sem recursão)
- Páginas públicas de pesquisa: policies `USING (true)` em pesquisa_tokens, pesquisa_formularios, pesquisa_perguntas

---

## 5. AUTENTICAÇÃO

- Supabase Auth + Google OAuth + E-mail/senha
- "Confirm email" **DESATIVADO** no Supabase
- Redirect URLs configuradas:
  - `https://trainhub-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`
- Site URL: `https://trainhub-app.vercel.app`

### Rotas públicas (middleware.ts)
`/login`, `/auth/callback`, `/sem-acesso`, `/auth/reset-password`, `/pesquisa`, `/api/pesquisa`

---

## 6. ARQUITETURA MULTI-TENANT

### Contexto do usuário (`lib/user-context.tsx`)
Exporta tipos: `Tenant`, `Perfil`, `UserContextData`

Funções disponíveis via `useUser()`:
- `hasPermission(permissao: string): boolean`
- `isAdmin(): boolean`
- `isMaster(): boolean`
- `getActiveTenantId(): string`

### UserProvider (`components/user-provider.tsx`)
- Queries separadas: usuarios → tenant → perfil → permissoes
- Timeout 8s, retry 3x
- `sessionStorage` para `selectedTenant` (seletor do master)

---

## 7. ARQUITETURA DE MÓDULOS (3 CAMADAS)

```
Camada 1 — Tenant (tenant_modulos)
  → Master configura quais módulos a empresa contratou
  → Ex: Neo Crédito tem 'gestao' ativo, 'trilhas' inativo

Camada 2 — Perfil (perfil_permissoes)
  → Admin configura permissões internas por perfil
  → Não controla mais acesso a módulos (removido acessar_modulo_*)

Camada 3 — Usuário
  → Herda permissões do perfil vinculado
```

**Regra:** Se o tenant tem o módulo ativo → todos os perfis têm acesso.
Master sempre tem acesso total independente de tenant_modulos.

---

## 8. PERMISSÕES DO SISTEMA

Lista completa em `lib/user-context.tsx` (PERMISSOES):

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

### Regras de acesso
- **Master:** acesso total sempre, independente de permissões
- **Admin:** acesso total às permissões internas, mas respeita tenant_modulos
- **Perfis personalizados:** acesso conforme permissões configuradas

---

## 9. ESTRUTURA DE ROTAS COMPLETA

```
app/
├── login/page.tsx                              # Login Google + e-mail/senha
├── auth/callback/route.ts                      # OAuth callback → /dashboard
├── auth/reset-password/page.tsx                # Redefinição de senha → /dashboard
├── sem-acesso/page.tsx                         # Página de acesso negado
├── pesquisa/[token]/page.tsx                   # Página PÚBLICA de resposta de pesquisa
│
├── dashboard/
│   ├── layout.tsx                              # Layout mínimo SEM sidebar
│   ├── page.tsx                                # Home de Módulos (sem sidebar)
│   ├── perfil/page.tsx                         # Meu Perfil (sem sidebar, header próprio)
│   │
│   ├── configuracoes/                          # Configurações do Hub (sem sidebar)
│   │   ├── layout.tsx                          # Guard: Master ou Admin
│   │   ├── page.tsx                            # Hub de Configurações (cards)
│   │   ├── perfis/page.tsx                     # Perfis de Acesso e Permissões
│   │   ├── usuarios/page.tsx                   # Gestão de Usuários
│   │   └── tenants/
│   │       ├── page.tsx                        # Lista de Tenants (Master only)
│   │       └── [id]/page.tsx                   # Editar Tenant + Módulos habilitados
│   │
│   └── gestao/                                 # Módulo Gestão (COM sidebar)
│       ├── layout.tsx                          # Guard: verifica tenant_modulos['gestao']
│       ├── page.tsx                            # Dashboard Gestão
│       ├── treinamentos/novo/page.tsx          # Registrar treinamento
│       ├── historico/page.tsx                  # Histórico de treinamentos
│       ├── relatorios/page.tsx                 # Relatórios + exportação Excel
│       ├── minhas-trilhas/page.tsx             # Dashboard pessoal (Colaborador)
│       ├── catalogo/page.tsx                   # Catálogo/Treinamentos
│       ├── pesquisas/
│       │   ├── page.tsx                        # Lista de formulários de pesquisa
│       │   └── [id]/page.tsx                   # Editar formulário + ver respostas
│       └── configuracoes/
│           ├── setores/page.tsx
│           ├── empresas-parceiras/page.tsx
│           ├── colaboradores/page.tsx
│           └── categorias/page.tsx             # Categorias de treinamentos
│
└── api/
    ├── admin/
    │   ├── criar-usuario/route.ts
    │   ├── deletar-usuario/route.ts
    │   └── resetar-senha/route.ts
    └── pesquisa/
        ├── calcular-satisfacao/route.ts        # Calcula média e atualiza indice_satisfacao
        └── notificacoes/route.ts               # Dispara notificações aos colaboradores
```

---

## 10. COMPONENTES PRINCIPAIS

```
components/
├── app-shell.tsx                   # Layout principal + sidebar com permissões
│                                   # Sidebar: h-screen sticky, scroll hover, botão "Voltar aos Módulos"
├── user-provider.tsx               # Provider do contexto de usuário
├── tenant-selector.tsx             # Seletor de tenant (master only)
└── notificacoes-sino.tsx           # Sino com badge, realtime + polling 15s
                                    # Props: variant="sidebar" | "compact"
```

---

## 11. SIDEBAR DO MÓDULO GESTÃO

### mainNavItems
```typescript
Dashboard                    → /dashboard/gestao              (ver_dashboard_geral)
Minhas Trilhas               → /dashboard/gestao/minhas-trilhas (ver_minhas_trilhas, não admin/master)
Registrar Treinamento        → /dashboard/gestao/treinamentos/novo
Histórico de Treinamentos    → /dashboard/gestao/historico
Treinamentos                 → /dashboard/gestao/catalogo
Pesquisas                    → /dashboard/gestao/pesquisas
Relatórios                   → /dashboard/gestao/relatorios
```

### configNavItems (Configurações)
```typescript
Setores          → /dashboard/gestao/configuracoes/setores           (gerenciar_setores)
Empresas Parceiras → /dashboard/gestao/configuracoes/empresas-parceiras (gerenciar_empresas_parceiras)
Categorias       → /dashboard/gestao/configuracoes/categorias         (gerenciar_categorias)
```
> Nota: Colaboradores, Perfil de Acesso e Tenants foram removidos da sidebar do /gestao

---

## 12. HOME DE MÓDULOS (/dashboard)

- Header próprio: bg-sidebar, h-16
- Esquerda: logo TrainHub
- Direita: engrenagem (Master/Admin → /dashboard/configuracoes) + avatar + sino (compact) + sair
- Grid 2x2 de cards:
  1. **Gestão de Treinamentos** → teal #00C9A7, /dashboard/gestao
  2. **Trilhas de Conhecimento** → azul #3b82f6, /dashboard/gestao/minhas-trilhas
  3. **Catálogo de Treinamentos** → roxo #8b5cf6, "Em breve"
  4. **Avaliações e Certificados** → laranja #f59e0b, "Em breve"
- Cards bloqueados se tenant não tem módulo ativo
- Toast diferenciado: "não habilitado para sua organização"

---

## 13. REGRA DE ISOLAMENTO POR COLABORADOR

Aplicada em: Dashboard, Histórico, Relatórios

```
Master ou Admin → visão completa do tenant
Colaborador comum:
  1. .maybeSingle() em colaboradores por tenant_id + email
  2. Se não encontrado → exibe vazio sem erro
  3. Busca treinamento_id em treinamento_colaboradores
  4. Filtra treinamentos com .in('id', ids)
```

---

## 14. FLUXO DE NOTIFICAÇÕES

1. Admin registra treinamento tipo Colaborador
2. novo/page.tsx chama POST /api/notificacoes
3. API busca usuario_id via colaboradores.email → usuarios.email
4. Verifica notif_interna em usuario_notificacoes_config (default true)
5. Insere em notificacoes se notif_interna = true
6. Sino do colaborador atualiza via realtime (INSERT) ou polling 15s

---

## 15. FLUXO DE PESQUISA DE SATISFAÇÃO

1. Admin cria formulário em /gestao/pesquisas
2. Adiciona perguntas (escala 1-5, múltipla escolha, texto livre)
3. Ao registrar treinamento → modo "Via Pesquisa" → seleciona formulário
4. Após salvar: gera tokens únicos por colaborador/parceiro em pesquisa_tokens
5. Dialog exibe links: `{origin}/pesquisa/{token}`
6. Respondente acessa link público → responde sem autenticação
7. Ao enviar: insere em pesquisa_respostas + marca token como usado
8. Chama POST /api/pesquisa/calcular-satisfacao
9. API calcula média das respostas de escala: ((media-1)/4)*100
10. Atualiza indice_satisfacao no treinamento

---

## 16. TELA DE REGISTRO DE TREINAMENTO (novo/page.tsx)

### Melhorias implementadas
- Campo "Nome do Treinamento" → Select do catalogo_treinamentos (status=ativo)
- Ao selecionar: objetivo, conteúdo e carga horária preenchem automaticamente (readonly + cadeado)
- Campo Satisfação: toggle "Manual" | "Via Pesquisa"
  - Manual: Input numérico (comportamento original)
  - Via Pesquisa: Select de pesquisa_formularios (ativo=true)
- Após salvar com Via Pesquisa: gera tokens + Dialog de links

---

## 17. CONFIGURAÇÕES DO HUB (/dashboard/configuracoes)

- Visível apenas para Master e Admin
- Header: Settings ícone + "Configurações do Hub" + "← Home"
- Cards:
  - **Perfis de Acesso** → /configuracoes/perfis
  - **Usuários** → /configuracoes/usuarios
  - **Tenants** → /configuracoes/tenants (Master only)

### Perfis de Acesso — hierarquia de permissões
```
Administração (Shield, roxo)
  ☐ Gerenciar Usuários
  ☐ Gerenciar Perfis de Acesso

Módulo: Gestão de Treinamentos (ClipboardList, azul)
  Treinamentos: Registrar Parceiro, Registrar Colaborador, Editar, Excluir, Visualizar Histórico
  Relatórios: Visualizar, Exportar Excel
  Colaboradores: Visualizar, Editar/Criar, Importar Planilha
  Setores: Visualizar, Editar/Criar
  Empresas Parceiras: Visualizar, Editar/Criar
  Dashboard: Ver Dashboard Geral
  Catálogo: Gerenciar Catálogo, Gerenciar Categorias
  Pesquisas: Gerenciar Pesquisas de Satisfação

Módulo: Trilhas de Conhecimento (BookOpen, azul)
  Trilhas: Ver Minhas Trilhas
```

### Tenants/[id] — nova estrutura
- Card 1: Dados do Tenant (nome, slug)
- Card 2: Módulos habilitados (switches por módulo)
  - Gestão de Treinamentos → modulo='gestao'
  - Trilhas de Conhecimento → modulo='trilhas'
  - Catálogo, Avaliações → disabled "Em breve"
- Sem gestão de usuários (movida para /configuracoes/usuarios)

---

## 18. REGRAS DE DESENVOLVIMENTO

- **Cor destaque:** teal `#00C9A7`
- Todos os `<Select>` usam `Controller` do react-hook-form
- Campos `<Textarea>` usam `Controller` (sem forwardRef no shadcn)
- Botões de submit em Sheets/Dialogs Radix: `onClick` + `getValues()` manual
- Redirecionamentos em Client Components: `useEffect` + `router.push()` (NUNCA `redirect()` durante render)
- Hooks sempre no topo, antes de qualquer `return` condicional
- `SUPABASE_SERVICE_ROLE_KEY` NUNCA no client-side
- Usar `.maybeSingle()` em vez de `.single()` para evitar PGRST116
- Tratar erros em todas as chamadas Supabase
- Polling padrão: 15s com visibilitychange listener
- Realtime: canal com nome único por usuário/tenant
- Não quebrar funcionalidades existentes

---

## 19. VERSÕES PUBLICADAS

| Versão | Descrição |
|--------|-----------|
| v1.0.0 | MVP: auth, dashboard, histórico, registro e edição |
| v1.1.0 | Importação em massa via planilha Excel |
| v1.2.0 | Relatórios + exportação Excel formatada |
| v1.3.0 | Deploy em produção na Vercel |
| v1.4.0 | Multi-tenant + UserProvider + login e-mail/senha + painel master |
| v2.0.0 | Gestão completa de tenants: usuários, importação em massa, reset de senha |
| v2.1.0 | Multi-tenant completo + controle de permissões por perfil |
| v2.2.0 | Minhas Trilhas + permissões granulares (parceiro/colaborador) |
| v2.3.0 | Isolamento de dados por colaborador no histórico e relatórios |
| v2.4.0 | Meu Perfil, notificações com sino, isolamento dashboard |
| v2.5.0 | Home de Módulos LMS, rotas /gestao e melhorias de navegação |
| v2.6.0 | Configurações do Hub, permissões de módulo e área de administração |
| v2.7.0 | Perfis de acesso hierárquico por módulo |
| v2.8.0 | Módulos por tenant (tenant_modulos), RLS Admin corrigido |
| v2.9.0 | Tela de Treinamentos (catálogo), Categorias e melhorias de UX |
| v2.10.0 | Pesquisas de Satisfação completas com formulário próprio e cálculo automático |
| v2.11.0 | Tela de respostas de pesquisa com tabela expansível |
| v2.11.1 | Correção botão voltar e refatoração tabela respostas |
| v2.12.0 | Código identificador de treinamento TH0001NC via trigger Supabase |
| v2.12.1 | Fix trigger gerar_codigo_treinamento reativado |
| v2.12.2 | Fix backfill de códigos existentes |
| v2.12.3 | Histórico ordenado por código decrescente |
| v2.13.0 | Relatórios: filtros Curso/Turma server-side e infinite scroll |
| v2.13.1 | Performance: cache UserProvider, Promise.all, prefetch AppShell |
| v2.13.2 | Fix import useRef em relatórios |
| v2.13.3 | Seletor de tenant inline na HOME e headers padronizados |
| v2.13.4 | Logs de erro melhorados |
| v2.14.0 | Minhas Trilhas reescrito como dashboard pessoal |
| v2.14.1 | Minhas Trilhas: botão certificado, sem sidebar, layout isolado |
| v2.14.2 | Minhas Trilhas: header próprio e colunas centralizadas |
| v2.14.3 | Headers padronizados em todas as telas |
| v2.15.0 | Perfil: alteração de senha com validação Supabase Auth |
| v2.15.1 | Login apenas e-mail/senha, Google OAuth removido da UI |
| v2.15.2 | Fix fluxo esqueci senha e URLs de redirect |
| v2.16.0 | Template de certificado por tenant com upload e preview |
| v2.16.1 | Certificado: drag-and-drop de campos e persistência |
| v2.16.2 | Certificado: caixas editáveis com variáveis e geração PDF |
| v2.16.3 | Certificado: PDF via iframe, escala proporcional, data extenso |
| v2.16.4 | Minhas Trilhas: download de certificado integrado ao template |
| v2.17.0 | Minhas Trilhas: coluna Pesquisa com status e bloqueio de certificado |
| v2.17.1 | Fix: header coluna Pesquisa e URL do token pendente |
| v2.17.2 | Fix: data com timezone e modal pesquisa sem duplicar registro |
| v2.17.3 | Fix: datas sem offset timezone em todas as telas |
| v2.17.4 | Fix: race condition no carregamento de módulos ao dar F5 |

---

## 20. ROTINA DE VERSIONAMENTO

```bash
git add .
git commit -m "feat/fix/chore: descrição"
git tag -a vX.Y.Z -m "vX.Y.Z - descrição"
git push origin main
git push origin master
git push origin vX.Y.Z
```

---

## 21. PENDÊNCIAS E PRÓXIMOS PASSOS

### 🔴 Bugs conhecidos
- Nenhum bug crítico pendente

### 🟡 Melhorias planejadas
- [ ] Notificações por e-mail (Resend ou SendGrid)
- [ ] Tela de perfil do usuário: editar nome e foto
- [ ] Aplicar permissão `importar_planilha` na tela de importação do histórico
- [ ] Campo "Respondente" na tela de pesquisas/[id] exibe ID truncado — melhorar para mostrar nome
- [ ] Validação de formulário mais robusta no registro de treinamento (modo Via Pesquisa)
- [ ] Conectar botão Baixar certificado com dados reais quando vier do Catálogo
- [ ] Módulo Avaliações e Certificados completo
- [ ] Trilhas de Conhecimento estruturadas

### 🟢 Funcionando 100%
- [x] Multi-tenant com RLS completo
- [x] Login apenas por e-mail/senha
- [x] Home de Módulos LMS
- [x] Painel master com seletor de tenant
- [x] Gestão completa de usuários por tenant
- [x] Importação em massa de usuários via Excel
- [x] Reset de senha por usuário
- [x] Perfis de acesso com permissões hierárquicas por módulo
- [x] Minhas Trilhas para colaboradores (dashboard pessoal reescrito)
- [x] Registrar treinamento com controle por perfil
- [x] Campo Nome via catálogo com auto-preenchimento
- [x] Isolamento de dados por colaborador (dashboard, histórico, relatórios)
- [x] Deploy em produção na Vercel
- [x] Sino de notificações com realtime
- [x] Configurações do Hub (fora do módulo Gestão)
- [x] Controle de módulos por tenant (tenant_modulos)
- [x] Catálogo de treinamentos com CRUD
- [x] Categorias de treinamentos
- [x] Pesquisas de satisfação com formulário próprio
- [x] Página pública de resposta /pesquisa/[token]
- [x] Cálculo automático do índice de satisfação
- [x] Código identificador de treinamento (TH0001NC)
- [x] Tela de respostas de pesquisa
- [x] Alteração de senha no perfil
- [x] Template e geração de certificado em PDF

---

## 22. MIGRATIONS SQL APLICADAS

### 20250313 — email em colaboradores
```sql
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS email TEXT;
```

### 20250314 — tenant_modulos
- Tabela tenant_modulos com RLS
- Função is_current_user_admin() com SECURITY DEFINER

### 20250315 — catalogo_treinamentos
- Tabela catalogo_treinamentos com RLS completo

### 20250315 — categorias
- Tabela categorias com RLS completo

### 20250315 — pesquisas
- Tabelas: pesquisa_formularios, pesquisa_perguntas, pesquisa_tokens, pesquisa_respostas
- Policies públicas (USING true) para página sem autenticação

### Policies RLS adicionadas manualmente
```sql
-- perfis: leitura e escrita para Admin
CREATE POLICY "perfis_select" ON perfis FOR SELECT USING (tenant_id = ...)
CREATE POLICY "perfis_all_admin" ON perfis FOR ALL USING (is_current_user_admin() ...)

-- perfil_permissoes: Admin pode gerenciar
CREATE POLICY "perfil_permissoes_admin_insert/delete/update"

-- pesquisa_*: acesso público para página de resposta
CREATE POLICY "pesquisa_tokens_select_public" ON pesquisa_tokens FOR SELECT USING (true)
CREATE POLICY "pesquisa_formularios_select_public" ON pesquisa_formularios FOR SELECT USING (true)
CREATE POLICY "pesquisa_perguntas_select_public" ON pesquisa_perguntas FOR SELECT USING (true)
```

---

## 23. OUTRO SISTEMA PENDENTE (DEPLOY FUTURO)

- **Backend:** Python + FastAPI
- **Frontend:** Next.js
- **Mobile:** React Native (Expo)
- **Banco:** PostgreSQL
- **Auth:** JWT
- **Deploy planejado:** Railway (FastAPI + PostgreSQL) + Vercel (Next.js) + Expo EAS (mobile)

---

## 24. PREMISSAS DE DESENVOLVIMENTO (PARA O CURSOR)

- Usar Cursor para codificação com prompts bem estruturados
- Colocar no prompt pontos de atenção que não podem ser modificados
- Sempre utilizar os padrões de cores e identidade da marca
- Sempre deixar o código otimizado e com segurança
- Sempre indicar o local do comando (Cursor, PowerShell, Navegador, Supabase SQL Editor)
- Ir passo a passo para corrigir erros imediatamente
- Não passar o código completo no prompt, apenas indicações (exceto casos específicos)
- Encapsular o prompt para copiar e colar diretamente

---

*Documento gerado automaticamente para continuidade do desenvolvimento.*
