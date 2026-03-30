/**
 * Valida conexão com o projeto Supabase e variáveis usadas pelo TrainHub.
 * Execute: npm run validate:supabase
 *
 * Não imprime segredos. Confere se REST/PostgREST responde e se há acesso às tabelas centrais.
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  console.log('TrainHub — validação Supabase\n')

  if (!SUPABASE_URL) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL no .env.local')
    process.exit(1)
  }
  console.log('✓ NEXT_PUBLIC_SUPABASE_URL definida')

  if (!ANON) {
    console.error('❌ Falta NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local')
    process.exit(1)
  }
  console.log('✓ NEXT_PUBLIC_SUPABASE_ANON_KEY definida')

  if (!SERVICE) {
    console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY no .env.local (necessária para checagens server-side)')
    process.exit(1)
  }
  console.log('✓ SUPABASE_SERVICE_ROLE_KEY definida')

  // Health do projeto (Auth)
  try {
    const healthUrl = `${SUPABASE_URL}/auth/v1/health`
    const h = await fetch(healthUrl, { headers: { apikey: ANON } })
    if (h.ok) {
      console.log('✓ Auth health (/auth/v1/health) respondeu OK')
    } else {
      console.warn(`⚠ Auth health: HTTP ${h.status} (pode ser normal em alguns planos/regiões)`)
    }
  } catch (e) {
    console.warn('⚠ Não foi possível consultar auth health:', e instanceof Error ? e.message : e)
    console.warn('  (se for "fetch failed": confira URL do projeto, VPN, firewall e DNS)')
  }

  const admin = createClient(SUPABASE_URL, SERVICE)

  const checks: { name: string; query: () => Promise<{ error: unknown }> }[] = [
    {
      name: 'tabela tenants (leitura)',
      query: async () => admin.from('tenants').select('id').limit(1),
    },
    {
      name: 'tabela usuarios (leitura)',
      query: async () => admin.from('usuarios').select('id').limit(1),
    },
    {
      name: 'tabela perfil_permissoes (leitura)',
      query: async () => admin.from('perfil_permissoes').select('perfil_id').limit(1),
    },
  ]

  for (const { name, query } of checks) {
    const { error } = await query()
    if (error) {
      const msg = typeof error === 'object' && error && 'message' in error ? String((error as { message: string }).message) : String(error)
      console.error(`❌ ${name}:`, msg)
      if (String(msg).includes('fetch failed')) {
        console.error('\n  Rede/CDN ou URL do Supabase inacessível a partir deste terminal.')
        console.error('  Teste no navegador: Dashboard → SQL Editor. No mesmo PC, rode de novo: npm run validate:supabase')
      }
      process.exit(1)
    }
    console.log(`✓ ${name}`)
  }

  // RPC só faz sentido com JWT de usuário; com service role o PostgREST pode aceitar ou não.
  const rpcTry = await admin.rpc('is_current_user_master' as never)
  if (rpcTry.error) {
    console.warn('⚠ RPC is_current_user_master (opcional):', rpcTry.error)
    console.warn('  Se as migrações RLS antigas foram aplicadas, a função existe; falha aqui costuma ser cenário sem auth.uid().')
  } else {
    console.log('✓ RPC is_current_user_master respondeu')
  }

  console.log('\n--- Migração RLS perfil_permissoes (20250317000000) ---')
  console.log(
    'Confirme no Supabase: SQL Editor → cole o conteúdo de supabase/migrations/20250317000000_fix_perfil_permissoes_select_rls.sql e execute.'
  )
  console.log(
    'Ou verifique em Database → Policies em `perfil_permissoes`: SELECT deve restringir ao próprio perfil ou master (não `USING (true)` para todos).'
  )

  console.log('\n✅ Validação básica concluída. Pode seguir com testes de usabilidade no app.')
}

main().catch((e) => {
  console.error('Erro inesperado:', e instanceof Error ? e.message : e)
  process.exit(1)
})
