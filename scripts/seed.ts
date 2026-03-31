/**
 * Seed script - popula dados no tenant "TrainHub Master"
 * Execute: npm run seed          — adiciona dados faltantes (idempotente)
 * Execute: npm run seed -- --reset — remove e reinsere tudo (popula completo)
 * Requer: SUPABASE_SERVICE_ROLE_KEY no .env.local
 */

const FORCE_RESET = process.argv.includes('--reset')

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          let value = trimmed.slice(eq + 1).trim()
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          process.env[key] = value
        }
      }
    }
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Erro: Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const TENANT_SLUG = 'trainhub-master'
const TENANT_NOME = 'TrainHub Master'

async function run() {
  console.log('🌱 Iniciando seed para tenant TrainHub Master...\n')

  let { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, nome, slug')
    .eq('slug', TENANT_SLUG)
    .single()

  if (tenantError || !tenant) {
    console.log('Tenant não encontrado. Criando tenant "TrainHub Master"...')
    const { data: newTenant, error: createError } = await supabase
      .from('tenants')
      .insert({
        nome: TENANT_NOME,
        slug: TENANT_SLUG,
        ativo: true,
      })
      .select('id, nome, slug')
      .single()

    if (createError) {
      console.error('Erro ao criar tenant:', createError.message)
      process.exit(1)
    }
    tenant = newTenant
    console.log('✓ Tenant criado:', tenant!.id)

    const { data: perfil } = await supabase
      .from('perfis')
      .select('id')
      .eq('tenant_id', tenant!.id)
      .single()

    if (!perfil) {
      const { error: perfilErr } = await supabase.from('perfis').insert({
        tenant_id: tenant!.id,
        nome: 'Admin',
        is_admin: true,
      })
      if (perfilErr) console.warn('Aviso: perfil Admin pode já existir:', perfilErr.message)
    }
  } else {
    console.log('✓ Tenant encontrado:', tenant.nome, '(' + tenant.id + ')')
  }

  const tenantRow = tenant as { id: string; nome: string; slug: string }
  if (tenantRow.slug !== TENANT_SLUG) {
    console.error(
      `Seed abortado: o tenant retornado não é o TrainHub Master (slug esperado: ${TENANT_SLUG}).`
    )
    process.exit(1)
  }
  if (tenantRow.nome.trim() !== TENANT_NOME) {
    console.warn(
      `Aviso: nome do tenant é "${tenantRow.nome}" (esperado: "${TENANT_NOME}"). O slug confere; dados serão gravados neste ID.`
    )
  }
  console.log(
    '→ Seed exclusivo do tenant TrainHub Master (slug trainhub-master). Nenhum outro cliente (ex.: Neo Crédito) é alterado.\n'
  )

  const tenantId = tenantRow.id

  {
    const { data: modsExistentes } = await supabase
      .from('tenant_modulos')
      .select('modulo')
      .eq('tenant_id', tenantId)
    const mods = new Set((modsExistentes ?? []).map((r: { modulo: string }) => r.modulo))
    if (!mods.has('catalogo')) {
      const { error: modErr } = await supabase.from('tenant_modulos').insert({
        tenant_id: tenantId,
        modulo: 'catalogo',
        ativo: true,
      })
      if (modErr && !String(modErr.message).toLowerCase().includes('duplicate')) {
        console.warn('Aviso: módulo catálogo:', modErr.message)
      } else if (!modErr) {
        console.log('✓ Módulo catálogo habilitado para o tenant.')
      }
    }
  }

  if (FORCE_RESET) {
    console.log('🔄 Modo --reset: removendo dados existentes do tenant...')
    await supabase.from('catalogo_treinamentos').delete().eq('tenant_id', tenantId)
    const { data: trIds } = await supabase.from('treinamentos').select('id').eq('tenant_id', tenantId)
    const ids = (trIds ?? []).map((t) => t.id)
    if (ids.length > 0) {
      await supabase.from('treinamento_colaboradores').delete().in('treinamento_id', ids)
    }
    await supabase.from('treinamentos').delete().eq('tenant_id', tenantId)
    await supabase.from('colaboradores').delete().eq('tenant_id', tenantId)
    await supabase.from('empresas_parceiras').delete().eq('tenant_id', tenantId)
    await supabase.from('setores').delete().eq('tenant_id', tenantId)
    console.log('✓ Dados removidos.\n')
  }

  const setoresData = [
    { nome: 'TI', tenant_id: tenantId },
    { nome: 'Recursos Humanos', tenant_id: tenantId },
    { nome: 'Financeiro', tenant_id: tenantId },
    { nome: 'Comercial', tenant_id: tenantId },
    { nome: 'Operações', tenant_id: tenantId },
  ]

  const { data: setoresExistentes } = await supabase
    .from('setores')
    .select('id, nome')
    .eq('tenant_id', tenantId)

  const setoresNomes = new Set((setoresExistentes ?? []).map((s) => s.nome))
  const setoresToInsert = setoresData.filter((s) => !setoresNomes.has(s.nome))

  if (setoresToInsert.length > 0) {
    const { data: insertedSetores, error: setoresErr } = await supabase
      .from('setores')
      .insert(setoresToInsert)
      .select('id, nome')

    if (setoresErr) {
      console.error('Erro ao inserir setores:', setoresErr.message)
    } else {
      console.log('✓ Setores inseridos:', insertedSetores!.map((s) => s.nome).join(', '))
    }
  } else {
    console.log('✓ Setores já existem, pulando.')
  }

  const { data: setores } = await supabase
    .from('setores')
    .select('id, nome')
    .eq('tenant_id', tenantId)
  const setoresMap = new Map((setores ?? []).map((s) => [s.nome.toLowerCase(), s.id]))

  const empresasData = [
    { nome: 'Consultoria ABC', tenant_id: tenantId },
    { nome: 'Tech Solutions', tenant_id: tenantId },
    { nome: 'Academia Corporativa XYZ', tenant_id: tenantId },
  ]

  const { data: empresasExistentes } = await supabase
    .from('empresas_parceiras')
    .select('id, nome')
    .eq('tenant_id', tenantId)

  const empresasNomes = new Set((empresasExistentes ?? []).map((e) => e.nome))
  const empresasToInsert = empresasData.filter((e) => !empresasNomes.has(e.nome))

  if (empresasToInsert.length > 0) {
    const { data: insertedEmpresas, error: empresasErr } = await supabase
      .from('empresas_parceiras')
      .insert(empresasToInsert)
      .select('id, nome')

    if (empresasErr) {
      console.error('Erro ao inserir empresas parceiras:', empresasErr.message)
    } else {
      console.log('✓ Empresas parceiras inseridas:', insertedEmpresas!.map((e) => e.nome).join(', '))
    }
  } else {
    console.log('✓ Empresas parceiras já existem, pulando.')
  }

  const { data: empresas } = await supabase
    .from('empresas_parceiras')
    .select('id, nome')
    .eq('tenant_id', tenantId)
  const empresaTi = (empresas ?? []).find((e) => e.nome.includes('Tech')) ?? (empresas ?? [])[0]
  const empresaRh = (empresas ?? []).find((e) => e.nome.includes('ABC')) ?? (empresas ?? [])[0]

  const setorTiId = setoresMap.get('ti')
  const setorRhId = setoresMap.get('recursos humanos')

  const colaboradoresData = [
    { nome: 'Ana Silva', setor_id: setorRhId ?? null, tenant_id: tenantId },
    { nome: 'Bruno Santos', setor_id: setorTiId ?? null, tenant_id: tenantId },
    { nome: 'Carla Oliveira', setor_id: setorTiId ?? null, tenant_id: tenantId },
    { nome: 'Diego Costa', setor_id: setorRhId ?? null, tenant_id: tenantId },
    { nome: 'Elena Ferreira', setor_id: setorTiId ?? null, tenant_id: tenantId },
  ]

  const { data: colabExistentes } = await supabase
    .from('colaboradores')
    .select('id, nome')
    .eq('tenant_id', tenantId)

  const colabNomes = new Set((colabExistentes ?? []).map((c) => c.nome.toLowerCase()))
  const colabToInsert = colaboradoresData.filter((c) => !colabNomes.has(c.nome.toLowerCase()))

  if (colabToInsert.length > 0) {
    const { data: insertedColab, error: colabErr } = await supabase
      .from('colaboradores')
      .insert(colabToInsert)
      .select('id, nome')

    if (colabErr) {
      console.error('Erro ao inserir colaboradores:', colabErr.message)
    } else {
      console.log('✓ Colaboradores inseridos:', insertedColab!.map((c) => c.nome).join(', '))
    }
  } else {
    console.log('✓ Colaboradores já existem, pulando.')
  }

  const { data: colaboradores } = await supabase
    .from('colaboradores')
    .select('id, nome')
    .eq('tenant_id', tenantId)

  if (!empresaTi?.id) {
    console.log('Aviso: Nenhuma empresa parceira disponível. Pulando treinamentos.')
  } else {
    const empresasIds = (empresas ?? []).map((e) => e.id)
    const empresaFallback = empresaTi.id

    const toDateOnly = (date: Date) => date.toISOString().slice(0, 10)
    const meses: Date[] = []
    for (let i = 11; i >= 0; i--) {
      meses.push(new Date(new Date().getFullYear(), new Date().getMonth() - i, 10))
    }

    const temasParceiro = [
      'Segurança do Trabalho',
      'Liderança e Gestão de Equipes',
      'Excel Avançado para Negócios',
      'Gestão de Projetos Ágeis',
      'Atendimento ao Cliente',
      'Compliance e LGPD',
    ]
    const temasColaborador = [
      'Comunicação Interna',
      'Produtividade e Organização',
      'Boas Práticas de Atendimento',
      'Ferramentas Digitais do Dia a Dia',
      'Segurança da Informação',
      'Trabalho em Equipe',
    ]

    const treinamentosSeed: Array<Record<string, unknown>> = []
    const vinculosDesejados: Array<{ key: string; colaboradores: string[] }> = []

    meses.forEach((baseDate, idx) => {
      const mesTag = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`
      const empresaA = empresasIds[idx % (empresasIds.length || 1)] ?? empresaFallback
      const empresaB = empresasIds[(idx + 1) % (empresasIds.length || 1)] ?? empresaFallback

      const parceiroData = toDateOnly(new Date(baseDate.getFullYear(), baseDate.getMonth(), 10))
      const parceiroNome = `${temasParceiro[idx % temasParceiro.length]} — Parceiros ${mesTag}`
      treinamentosSeed.push({
        tipo: 'parceiro',
        nome: parceiroNome,
        conteudo: `Treinamento parceiro do mês ${mesTag} com foco prático e estudo de casos.`,
        objetivo: 'Desenvolver competências de execução e padronização operacional.',
        carga_horaria: 6 + (idx % 5) * 2,
        empresa_parceira_id: empresaA,
        quantidade_pessoas: 12 + (idx % 10),
        data_treinamento: parceiroData,
        indice_satisfacao: 78 + (idx % 20),
        tenant_id: tenantId,
      })

      const colaboradorData = toDateOnly(new Date(baseDate.getFullYear(), baseDate.getMonth(), 24))
      const colaboradorNome = `${temasColaborador[idx % temasColaborador.length]} — Colaboradores ${mesTag}`
      treinamentosSeed.push({
        tipo: 'colaborador',
        nome: colaboradorNome,
        conteudo: `Trilha colaborador do mês ${mesTag}, com exercícios práticos e simulações.`,
        objetivo: 'Elevar produtividade, qualidade de entrega e colaboração entre áreas.',
        carga_horaria: 4 + (idx % 4) * 2,
        empresa_parceira_id: empresaB,
        quantidade_pessoas: null,
        data_treinamento: colaboradorData,
        indice_satisfacao: 74 + (idx % 24),
        tenant_id: tenantId,
      })

      const cols = (colaboradores ?? []).map((c) => c.id)
      if (cols.length > 0) {
        const qtd = Math.min(3 + (idx % 2), cols.length)
        const selecionados = Array.from({ length: qtd }, (_, n) => cols[(idx + n) % cols.length]!)
        vinculosDesejados.push({
          key: `colaborador|${colaboradorNome.toLowerCase()}|${colaboradorData}`,
          colaboradores: selecionados,
        })
      }
    })

    const { data: trExistentes } = await supabase
      .from('treinamentos')
      .select('id, nome, data_treinamento, tipo')
      .eq('tenant_id', tenantId)

    const existentesMap = new Map(
      (trExistentes ?? []).map((t) => [`${t.tipo}|${t.nome.toLowerCase()}|${t.data_treinamento}`, t.id as string])
    )

    const novos = treinamentosSeed.filter((t) => {
      const key = `${t.tipo}|${String(t.nome).toLowerCase()}|${t.data_treinamento}`
      return !existentesMap.has(key)
    })

    let inseridos = 0
    if (novos.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from('treinamentos')
        .insert(novos)
        .select('id, nome, data_treinamento, tipo')

      if (insertErr) {
        console.error('Erro ao inserir treinamentos:', insertErr.message)
      } else {
        inseridos = inserted?.length ?? 0
        for (const t of inserted ?? []) {
          const key = `${t.tipo}|${t.nome.toLowerCase()}|${t.data_treinamento}`
          existentesMap.set(key, t.id as string)
        }
      }
    }

    let vinculosInseridos = 0
    for (const v of vinculosDesejados) {
      const treinamentoId = existentesMap.get(v.key)
      if (!treinamentoId || v.colaboradores.length === 0) continue

      const { data: vinculosExistentes } = await supabase
        .from('treinamento_colaboradores')
        .select('colaborador_id')
        .eq('treinamento_id', treinamentoId)

      const existentes = new Set((vinculosExistentes ?? []).map((x) => x.colaborador_id as string))
      const rows = v.colaboradores
        .filter((colaboradorId) => !existentes.has(colaboradorId))
        .map((colaboradorId) => ({
          treinamento_id: treinamentoId,
          colaborador_id: colaboradorId,
          tenant_id: tenantId,
        }))

      if (rows.length > 0) {
        const { error: vincErr } = await supabase.from('treinamento_colaboradores').insert(rows)
        if (vincErr) {
          console.warn(`Aviso: erro ao vincular colaboradores no treinamento ${treinamentoId}:`, vincErr.message)
        } else {
          vinculosInseridos += rows.length
        }
      }
    }

    console.log(`✓ Treinamentos no seed: ${treinamentosSeed.length} planejados`)
    console.log(`✓ Treinamentos inseridos nesta execução: ${inseridos}`)
    console.log(`✓ Vínculos colaborador x treinamento inseridos: ${vinculosInseridos}`)
  }

  {
    const nomesCategorias = ['Soft Skills', 'Tecnologia', 'Compliance', 'Gestão']
    for (const nome of nomesCategorias) {
      const { data: cEx } = await supabase
        .from('categorias')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('nome', nome)
        .maybeSingle()
      if (!cEx) {
        const { error: cErr } = await supabase.from('categorias').insert({ nome, tenant_id: tenantId })
        if (cErr) console.warn('Aviso: categoria', nome, cErr.message)
        else console.log('✓ Categoria criada:', nome)
      }
    }

    /* ~15 itens; imagens via Unsplash CDN (demos). Licença Unsplash: unsplash.com/license */
    const catalogoSeed: Array<Record<string, unknown>> = [
      {
        tenant_id: tenantId,
        titulo: 'Excel Avançado para Negócios',
        categoria: 'Tecnologia',
        nivel: 'avancado',
        modalidade: 'presencial',
        carga_horaria: 16,
        objetivo: 'Dominar recursos avançados para análise de dados no trabalho.',
        conteudo_programatico: 'Tabelas dinâmicas, Power Query, dashboards e automação básica com macros.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'LGPD na Prática',
        categoria: 'Compliance',
        nivel: 'basico',
        modalidade: 'online',
        carga_horaria: 8,
        objetivo: 'Entender e aplicar a LGPD no dia a dia da empresa.',
        conteudo_programatico: 'Bases legais, DPIA, direitos do titular, DPO e boas práticas internas.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Liderança e Gestão',
        categoria: 'Gestão',
        nivel: 'intermediario',
        modalidade: 'hibrido',
        carga_horaria: 24,
        objetivo: 'Desenvolver habilidades de liderança, feedback e alinhamento de metas.',
        conteudo_programatico: 'Estilos de liderança, delegação, 1:1s e gestão de times híbridos.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Comunicação e Colaboração',
        categoria: 'Soft Skills',
        nivel: 'basico',
        modalidade: 'online',
        carga_horaria: 6,
        objetivo: 'Melhorar comunicação assertiva e trabalho em equipe.',
        conteudo_programatico: 'Escuta ativa, reuniões eficazes, feedback e resolução de conflitos.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Python para Automação de Rotinas',
        categoria: 'Tecnologia',
        nivel: 'intermediario',
        modalidade: 'online',
        carga_horaria: 20,
        objetivo: 'Automatizar tarefas repetitivas com scripts Python no ambiente corporativo.',
        conteudo_programatico: 'Sintaxe, arquivos, APIs, pandas básico e agendamento de jobs.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Segurança da Informação NIST',
        categoria: 'Compliance',
        nivel: 'intermediario',
        modalidade: 'hibrido',
        carga_horaria: 12,
        objetivo: 'Reduzir riscos cibernéticos com práticas alinhadas ao NIST CSF.',
        conteudo_programatico: 'Identificar, proteger, detectar, responder e recuperar incidentes.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Scrum e Gestão Ágil',
        categoria: 'Gestão',
        nivel: 'basico',
        modalidade: 'presencial',
        carga_horaria: 16,
        objetivo: 'Aplicar Scrum para entregas iterativas e transparência com stakeholders.',
        conteudo_programatico: 'Papéis, eventos, artefatos, métricas e facilitação de cerimônias.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Inteligência Emocional no Trabalho',
        categoria: 'Soft Skills',
        nivel: 'intermediario',
        modalidade: 'online',
        carga_horaria: 8,
        objetivo: 'Regular emoções, empatia e relacionamentos profissionais.',
        conteudo_programatico: 'Autoconsciência, automotivação, empatia e habilidades sociais.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Power BI e Storytelling com Dados',
        categoria: 'Tecnologia',
        nivel: 'intermediario',
        modalidade: 'hibrido',
        carga_horaria: 18,
        objetivo: 'Construir dashboards e narrativas que apoiam decisões de negócio.',
        conteudo_programatico: 'Modelagem, DAX introdutório, visualizações e publicação no serviço.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Prevenção à Lavagem de Dinheiro (PLD)',
        categoria: 'Compliance',
        nivel: 'avancado',
        modalidade: 'presencial',
        carga_horaria: 12,
        objetivo: 'Conhecer obrigações PLD/FT e fluxos de reporte à UIF.',
        conteudo_programatico: 'CDD, KYC, monitoramento de transações e cultura de compliance.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Negociação e Influência',
        categoria: 'Soft Skills',
        nivel: 'avancado',
        modalidade: 'presencial',
        carga_horaria: 14,
        objetivo: 'Fechar acordos com preparação, alternativas e valor mútuo.',
        conteudo_programatico: 'BATNA, escuta ativa, objeções e negociações multiparte.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Gestão de Tempo e Alta Performance',
        categoria: 'Gestão',
        nivel: 'basico',
        modalidade: 'online',
        carga_horaria: 4,
        objetivo: 'Priorizar o que importa e reduzir desperdício de atenção.',
        conteudo_programatico: 'Matriz Eisenhower, blocos de foco, e-mail e reuniões enxutas.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'UX Writing e Acessibilidade Digital',
        categoria: 'Tecnologia',
        nivel: 'basico',
        modalidade: 'online',
        carga_horaria: 10,
        objetivo: 'Escrever interfaces claras e inclusivas (WCAG).',
        conteudo_programatico: 'Tom de voz, microcopy, testes com leitores de tela e linguagem simples.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1586717791821-3f44a5638e48?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Ética, Conduta e Canal de Denúncias',
        categoria: 'Compliance',
        nivel: 'basico',
        modalidade: 'online',
        carga_horaria: 6,
        objetivo: 'Fortalecer cultura ética e uso responsável do canal de denúncias.',
        conteudo_programatico: 'Código de conduta, conflitos de interesse, presentes e antifraude.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80&auto=format&fit=crop',
      },
      {
        tenant_id: tenantId,
        titulo: 'Facilitação de Workshops e Design Sprint',
        categoria: 'Soft Skills',
        nivel: 'intermediario',
        modalidade: 'presencial',
        carga_horaria: 16,
        objetivo: 'Conduzir dinâmicas colaborativas com método e segurança de grupo.',
        conteudo_programatico: 'Check-in, divergência, decisão, prototipagem rápida e retrospectivas.',
        status: 'ativo',
        imagem_url:
          'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80&auto=format&fit=crop',
      },
    ]

    const { data: catRows } = await supabase
      .from('catalogo_treinamentos')
      .select('titulo')
      .eq('tenant_id', tenantId)
    const titulosCat = new Set((catRows ?? []).map((r) => String(r.titulo).trim().toLowerCase()))

    let catInseridos = 0
    for (const row of catalogoSeed) {
      const t = String(row.titulo).trim().toLowerCase()
      if (titulosCat.has(t)) continue
      const { error: insErr } = await supabase.from('catalogo_treinamentos').insert(row)
      if (insErr) {
        console.warn('Aviso: catálogo', row.titulo, insErr.message)
      } else {
        titulosCat.add(t)
        catInseridos += 1
        console.log('✓ Catálogo (ativo):', row.titulo)
      }
    }
    if (catInseridos === 0 && catalogoSeed.length > 0) {
      console.log('✓ Nenhum título novo no catálogo; sincronizando imagens e textos dos existentes.')
    }

    for (const row of catalogoSeed) {
      const titulo = String(row.titulo)
      const imagem_url = row.imagem_url as string | undefined
      if (!imagem_url) continue
      const { error: updErr } = await supabase
        .from('catalogo_treinamentos')
        .update({
          imagem_url,
          objetivo: row.objetivo,
          conteudo_programatico: row.conteudo_programatico,
          categoria: row.categoria,
          nivel: row.nivel,
          modalidade: row.modalidade,
          carga_horaria: row.carga_horaria,
          status: row.status,
        })
        .eq('tenant_id', tenantId)
        .eq('titulo', titulo)
      if (updErr) {
        console.warn('Aviso: atualizar catálogo', titulo, updErr.message)
      }
    }
    console.log('✓ Catálogo: 15 programas seed; imagens Unsplash aplicadas por título (re-run seguro).')
  }

  /* Demo pool global: opt-in por categoria, itens publicados no global, fila de moderação (pendentes).
   * A tela Master só lista submissões status=pendente (reprovadas ficam só no banco para auditoria). */
  {
    const POOL_TERMO_VERSAO = '2026-03-30'
    const { data: masterRow } = await supabase
      .from('usuarios')
      .select('id')
      .eq('is_master', true)
      .limit(1)
      .maybeSingle()
    const masterId = (masterRow as { id: string } | null)?.id ?? null

    for (const nome of ['Gestão', 'Soft Skills', 'Tecnologia'] as const) {
      const { error: optErr } = await supabase.from('tenant_catalogo_global_categorias').upsert(
        {
          tenant_id: tenantId,
          categoria: nome,
          opt_in: true,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,categoria' }
      )
      if (optErr) console.warn('Aviso: opt-in vitrine (', nome, '):', optErr.message)
      else console.log('✓ Opt-in vitrine global:', nome)
    }

    const demoGlobals = [
      {
        titulo: '[DEMO GLOBAL] Fundamentos de OKR',
        categoria: 'Gestão',
        nivel: 'basico' as const,
        modalidade: 'online' as const,
        carga_horaria: 8,
        objetivo: 'Alinhar times com objetivos e resultados mensuráveis.',
        conteudo_programatico:
          'Ciclos de OKR, definição de resultados-chave, cadência de revisão e erros comuns.',
        imagem_url:
          'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80&auto=format&fit=crop',
      },
      {
        titulo: '[DEMO GLOBAL] Feedback 1:1 eficaz',
        categoria: 'Soft Skills',
        nivel: 'intermediario' as const,
        modalidade: 'hibrido' as const,
        carga_horaria: 6,
        objetivo: 'Conduzir conversas 1:1 com clareza, escuta e acordos.',
        conteudo_programatico:
          'Preparação, escuta ativa, registro de compromissos e acompanhamento.',
        imagem_url:
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80&auto=format&fit=crop',
      },
      {
        titulo: '[DEMO GLOBAL] Git e fluxo de branches',
        categoria: 'Tecnologia',
        nivel: 'basico' as const,
        modalidade: 'online' as const,
        carga_horaria: 10,
        objetivo: 'Versionar código com Git em equipe com boas práticas.',
        conteudo_programatico: 'Commits, branches, merge/rebase, pull requests e resolução de conflitos.',
        imagem_url:
          'https://images.unsplash.com/photo-1618401471417-9228d258f40f?w=1200&q=80&auto=format&fit=crop',
      },
    ]

    for (const g of demoGlobals) {
      const { data: exists } = await supabase
        .from('catalogo_treinamentos_globais')
        .select('id')
        .eq('titulo', g.titulo)
        .maybeSingle()
      if (exists) continue

      const linhagemId = randomUUID()
      const { error: gErr } = await supabase.from('catalogo_treinamentos_globais').insert({
        linhagem_id: linhagemId,
        versao: 1,
        titulo: g.titulo,
        conteudo_programatico: g.conteudo_programatico,
        objetivo: g.objetivo,
        carga_horaria: g.carga_horaria,
        categoria: g.categoria,
        nivel: g.nivel,
        modalidade: g.modalidade,
        imagem_url: g.imagem_url,
        status: 'publicado',
        origem_tenant_id: tenantId,
        aprovado_em: new Date().toISOString(),
        aprovado_por: masterId,
      })
      if (gErr) console.warn('Aviso: inserir demo global', g.titulo, gErr.message)
      else console.log('✓ Catálogo global publicado (demo):', g.titulo)
    }

    async function ensureDemoSubmissao(opts: {
      tituloCatalogo: string
      categoria: string
      status: 'pendente' | 'reprovado'
      motivoReprovacao?: string
    }) {
      let localId: string | null = null
      const { data: loc } = await supabase
        .from('catalogo_treinamentos')
        .select('id, pool_global_linhagem_id')
        .eq('tenant_id', tenantId)
        .eq('titulo', opts.tituloCatalogo)
        .maybeSingle()

      if (loc) {
        localId = loc.id
        if (!loc.pool_global_linhagem_id) {
          await supabase
            .from('catalogo_treinamentos')
            .update({ pool_global_linhagem_id: localId })
            .eq('id', localId)
        }
      } else {
        const { data: ins, error: insErr } = await supabase
          .from('catalogo_treinamentos')
          .insert({
            tenant_id: tenantId,
            titulo: opts.tituloCatalogo,
            categoria: opts.categoria,
            nivel: 'basico',
            modalidade: 'online',
            carga_horaria: 4,
            objetivo: 'Registro de demonstração do fluxo pool global (seed).',
            conteudo_programatico: 'Texto sintético para testes; pode editar ou excluir após validar o fluxo.',
            status: 'ativo',
            pool_global_consentimento: true,
            pool_global_consentimento_em: new Date().toISOString(),
            pool_global_termo_versao: POOL_TERMO_VERSAO,
          })
          .select('id')
          .single()
        if (insErr || !ins) {
          console.warn('Aviso: demo fila — catálogo', opts.tituloCatalogo, insErr?.message)
          return
        }
        localId = ins.id
        await supabase
          .from('catalogo_treinamentos')
          .update({ pool_global_linhagem_id: localId })
          .eq('id', localId)
      }

      if (!localId) return

      const { data: subRow } = await supabase
        .from('catalogo_global_submissoes')
        .select('id')
        .eq('catalogo_local_id', localId)
        .maybeSingle()
      if (subRow) return

      const payload = {
        tenant_id: tenantId,
        catalogo_local_id: localId,
        linhagem_id: localId,
        versao: 1,
        titulo: opts.tituloCatalogo,
        conteudo_programatico: 'Conteúdo demo moderação.',
        objetivo: 'Objetivo demo moderação.',
        carga_horaria: 4,
        categoria: opts.categoria,
        nivel: 'basico',
        modalidade: 'online',
        imagem_url: null as string | null,
        status: opts.status,
        revisado_por: opts.status === 'reprovado' ? masterId : null,
        revisado_em: opts.status === 'reprovado' ? new Date().toISOString() : null,
        motivo_reprovacao: opts.status === 'reprovado' ? opts.motivoReprovacao ?? 'Reprovado (seed).' : null,
      }
      const { error: sErr } = await supabase.from('catalogo_global_submissoes').insert(payload)
      if (sErr) console.warn('Aviso: demo submissão', opts.tituloCatalogo, sErr.message)
      else if (opts.status === 'pendente')
        console.log('✓ Fila Master (pendente):', opts.tituloCatalogo)
      else console.log('✓ Histórico fila (reprovado, não aparece na lista Master):', opts.tituloCatalogo)
    }

    await ensureDemoSubmissao({
      tituloCatalogo: '[POOL DEMO] Moderação — Pendente A',
      categoria: 'Gestão',
      status: 'pendente',
    })
    await ensureDemoSubmissao({
      tituloCatalogo: '[POOL DEMO] Moderação — Pendente B',
      categoria: 'Soft Skills',
      status: 'pendente',
    })
    await ensureDemoSubmissao({
      tituloCatalogo: '[POOL DEMO] Moderação — Reprovado (histórico)',
      categoria: 'Tecnologia',
      status: 'reprovado',
      motivoReprovacao: 'Exemplo de reprovação gerada pelo seed (conteúdo fictício).',
    })

    console.log(
      '✓ Pool global demo: 3 títulos no catálogo global + 2 pendentes na fila Master + 1 reprovado (só no banco).'
    )
  }

  console.log('\n✅ Seed concluído com sucesso para o tenant TrainHub Master.')
}

run().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
