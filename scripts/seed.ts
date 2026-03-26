/**
 * Seed script - popula dados no tenant "TrainHub Master"
 * Execute: npm run seed          — adiciona dados faltantes (idempotente)
 * Execute: npm run seed -- --reset — remove e reinsere tudo (popula completo)
 * Requer: SUPABASE_SERVICE_ROLE_KEY no .env.local
 */

const FORCE_RESET = process.argv.includes('--reset')

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
      .select('id')
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

  const tenantId = tenant!.id

  if (FORCE_RESET) {
    console.log('🔄 Modo --reset: removendo dados existentes do tenant...')
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

  console.log('\n✅ Seed concluído com sucesso para o tenant TrainHub Master.')
}

run().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
