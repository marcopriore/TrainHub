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
  const colab1 = colaboradores?.[0]?.id
  const colab2 = colaboradores?.[1]?.id

  if (!empresaTi?.id) {
    console.log('Aviso: Nenhuma empresa parceira disponível. Pulando treinamentos.')
  } else {
    const baseTrParceiro = {
      tipo: 'parceiro' as const,
      nome: '',
      conteudo: '',
      objetivo: '',
      carga_horaria: 0,
      empresa_parceira_id: empresaTi.id,
      quantidade_pessoas: 0,
      data_treinamento: '',
      indice_satisfacao: 0,
      tenant_id: tenantId,
    }

    const treinamentosParceiro = [
      {
        ...baseTrParceiro,
        nome: 'Segurança do Trabalho',
        conteudo: 'NRs aplicáveis, EPIs, análise de riscos.',
        objetivo: 'Capacitar em normas de segurança.',
        carga_horaria: 8,
        quantidade_pessoas: 15,
        data_treinamento: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        indice_satisfacao: 92,
        empresa_parceira_id: empresaTi.id,
        tenant_id: tenantId,
      },
      {
        ...baseTrParceiro,
        nome: 'Gestão de Projetos Ágeis',
        conteudo: 'Scrum, Kanban, cerimônias.',
        objetivo: 'Introduzir metodologias ágeis.',
        carga_horaria: 16,
        empresa_parceira_id: empresaRh?.id ?? empresaTi.id,
        quantidade_pessoas: 20,
        data_treinamento: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        indice_satisfacao: 88,
        tenant_id: tenantId,
      },
    ]

    const { data: trExistentes } = await supabase
      .from('treinamentos')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)

    const temTreinamentos = (trExistentes?.length ?? 0) > 0

    if (!temTreinamentos) {
      for (const t of treinamentosParceiro) {
        const payload: Record<string, unknown> = { ...t }
        const { data: tr, error: trErr } = await supabase
          .from('treinamentos')
          .insert(payload)
          .select('id')
          .single()

        if (trErr) {
          console.warn('Erro ao inserir treinamento:', trErr.message)
        } else {
          console.log('✓ Treinamento inserido:', t.nome)
        }
      }

      if (colab1 && colab2) {
        const treinColab: Record<string, unknown> = {
          tipo: 'colaborador',
          nome: 'Comunicação Interna',
          conteudo: 'Redação corporativa, feedback, reuniões.',
          objetivo: 'Melhorar a comunicação interna.',
          carga_horaria: 4,
          empresa_parceira_id: empresaTi.id,
          data_treinamento: new Date().toISOString().slice(0, 10),
          indice_satisfacao: 85,
          tenant_id: tenantId,
        }
        const { data: trColab, error: trColabErr } = await supabase
          .from('treinamentos')
          .insert(treinColab)
          .select('id')
          .single()

        if (trColabErr) {
          const { data: tr2, error: tr2Err } = await supabase
            .from('treinamentos')
            .insert(treinColab)
            .select('id')
            .single()
          if (!tr2Err && tr2) {
            await supabase.from('treinamento_colaboradores').insert([
              { treinamento_id: tr2.id, colaborador_id: colab1 },
              { treinamento_id: tr2.id, colaborador_id: colab2 },
            ])
            console.log('✓ Treinamento inserido: Comunicação Interna')
          } else if (tr2Err) {
            console.warn('Erro ao inserir treinamento colaborador:', tr2Err.message)
          }
        } else if (trColab) {
          await supabase.from('treinamento_colaboradores').insert([
            { treinamento_id: trColab.id, colaborador_id: colab1 },
            { treinamento_id: trColab.id, colaborador_id: colab2 },
          ])
          console.log('✓ Treinamento inserido: Comunicação Interna')
        }
      }
    } else {
      console.log('✓ Treinamentos já existem, pulando.')
    }
  }

  console.log('\n✅ Seed concluído com sucesso para o tenant TrainHub Master.')
}

run().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
