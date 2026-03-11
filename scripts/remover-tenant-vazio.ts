/**
 * Remove tenants duplicados vazios (ex: TrainHub Master sem dados)
 * Execute: npm run remover-tenant-vazio
 */

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

async function run() {
  console.log('🔍 Buscando tenants "TrainHub Master"...\n')

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, nome, slug, criado_em')
    .or('nome.eq.TrainHub Master,slug.eq.trainhub-master')
    .order('criado_em', { ascending: true })

  if (error) {
    console.error('Erro ao buscar tenants:', error.message)
    process.exit(1)
  }

  if (!tenants?.length) {
    console.log('Nenhum tenant "TrainHub Master" encontrado.')
    return
  }

  console.log(`Encontrados ${tenants.length} tenant(s):`)

  for (const t of tenants) {
    const [setores, empresas, colaboradores, treinamentos] = await Promise.all([
      supabase.from('setores').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
      supabase.from('empresas_parceiras').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
      supabase.from('colaboradores').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
      supabase.from('treinamentos').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
    ])
    const total =
      (setores.count ?? 0) + (empresas.count ?? 0) + (colaboradores.count ?? 0) + (treinamentos.count ?? 0)
    console.log(`  - ${t.nome} (${t.slug}) | id: ${t.id} | dados: ${total} registros`)
  }

  const vazios = []
  for (const t of tenants) {
    const [setores, empresas, colaboradores, treinamentos] = await Promise.all([
      supabase.from('setores').select('id').eq('tenant_id', t.id).limit(1),
      supabase.from('empresas_parceiras').select('id').eq('tenant_id', t.id).limit(1),
      supabase.from('colaboradores').select('id').eq('tenant_id', t.id).limit(1),
      supabase.from('treinamentos').select('id').eq('tenant_id', t.id).limit(1),
    ])
    const temDados =
      (setores.data?.length ?? 0) > 0 ||
      (empresas.data?.length ?? 0) > 0 ||
      (colaboradores.data?.length ?? 0) > 0 ||
      (treinamentos.data?.length ?? 0) > 0
    if (!temDados) vazios.push(t)
  }

  if (vazios.length === 0) {
    console.log('\n✓ Nenhum tenant vazio para remover.')
    return
  }

  console.log(`\n🗑️ Removendo ${vazios.length} tenant(s) vazio(s)...`)

  for (const t of vazios) {
    const { data: trIds } = await supabase.from('treinamentos').select('id').eq('tenant_id', t.id)
    const ids = (trIds ?? []).map((x) => x.id)
    if (ids.length > 0) {
      await supabase.from('treinamento_colaboradores').delete().in('treinamento_id', ids)
    }
    await supabase.from('treinamentos').delete().eq('tenant_id', t.id)
    await supabase.from('colaboradores').delete().eq('tenant_id', t.id)
    await supabase.from('empresas_parceiras').delete().eq('tenant_id', t.id)
    await supabase.from('setores').delete().eq('tenant_id', t.id)
    const { data: perfilIds } = await supabase.from('perfis').select('id').eq('tenant_id', t.id)
    const pids = (perfilIds ?? []).map((p) => p.id)
    if (pids.length > 0) {
      await supabase.from('perfil_permissoes').delete().in('perfil_id', pids)
    }
    await supabase.from('perfis').delete().eq('tenant_id', t.id)
    const { error: updUser } = await supabase
      .from('usuarios')
      .update({ tenant_id: null, perfil_id: null })
      .eq('tenant_id', t.id)
    if (updUser) {
      console.warn(`  Aviso: não foi possível desvincular usuarios do tenant ${t.id} (${updUser.message}). O tenant pode ter dependências.`)
    }
    const { error: delErr } = await supabase.from('tenants').delete().eq('id', t.id)
    if (delErr) {
      console.error(`  Erro ao remover ${t.nome} (${t.id}):`, delErr.message)
    } else {
      console.log(`  ✓ Removido: ${t.nome} (${t.slug})`)
    }
  }

  console.log('\n✅ Concluído.')
}

run().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
