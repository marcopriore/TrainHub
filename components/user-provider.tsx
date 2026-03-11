'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { UserContext, createUserWithHelpers, type UserContextValue } from '@/lib/user-context'

const DEBUG_USER_PROVIDER = false

const PUBLIC_PATHS = ['/login', '/auth/callback', '/sem-acesso']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))
}

interface UsuarioRow {
  id: string
  nome: string
  email: string
  is_master: boolean
  ativo: boolean
  tenant_id: string | null
  perfil_id: string | null
}

interface TenantRow {
  id: string
  nome: string
  slug: string
}

interface PerfilRow {
  id: string
  nome: string
  is_admin: boolean
}

const QUERY_TIMEOUT_MS = 8000

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = React.useMemo(() => createClient(), [])
  const [value, setValue] = React.useState<UserContextValue>({
    user: null,
    loading: true,
    error: null,
  })
  const [tentativas, setTentativas] = React.useState(0)
  const redirectingRef = React.useRef(false)
  const tentativasRef = React.useRef(0)

  React.useEffect(() => {
    const MAX_TENTATIVAS = 3
    const RETRY_DELAY_MS = 2000

    const scheduleRetry = (userId: string) => {
      if (tentativasRef.current >= MAX_TENTATIVAS) return
      if (DEBUG_USER_PROVIDER) console.log(`Tentativa ${tentativasRef.current} falhou. Reagendando em ${RETRY_DELAY_MS}ms...`)
      setTimeout(() => {
        fetchUser(userId)
      }, RETRY_DELAY_MS)
    }

    const maybeRedirect = () => {
      if (!isPublicPath(pathname ?? '') && !redirectingRef.current && tentativasRef.current >= 2) {
        redirectingRef.current = true
        if (DEBUG_USER_PROVIDER) console.log('Redirecionando para /sem-acesso (tentativas esgotadas)')
        router.replace('/sem-acesso')
      }
    }

    const fetchUser = async (userId: string) => {
      if (DEBUG_USER_PROVIDER) console.log('Buscando dados do usuário:', userId, 'tentativa:', tentativasRef.current + 1)
      try {
        const usuariosPromise = supabase
          .from('usuarios')
          .select('*')
          .eq('id', userId)
          .single()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
        )
        const usuariosResult = (await Promise.race([
          usuariosPromise,
          timeoutPromise,
        ])) as { data: UsuarioRow | null; error: { message?: string } | null }
        const { data: usuario, error: userError } = usuariosResult

        if (DEBUG_USER_PROVIDER) console.log('Query usuarios - data:', usuario, 'error:', userError)

        if (userError || !usuario) {
          if (DEBUG_USER_PROVIDER && !usuario) console.log('Usuário não encontrado na tabela usuarios')
          tentativasRef.current += 1
          setTentativas(tentativasRef.current)
          if (tentativasRef.current < MAX_TENTATIVAS) {
            scheduleRetry(userId)
            return
          }
          setValue({ user: null, loading: false, error: userError?.message ?? null })
          maybeRedirect()
          return
        }

        const row = usuario as UsuarioRow

        let tenant: TenantRow | null = null
        if (row.tenant_id) {
          const { data: tenantData, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', row.tenant_id)
            .single()
          tenant = tenantData as TenantRow | null
          if (DEBUG_USER_PROVIDER) console.log('Query tenant - data:', tenantData, 'error:', tenantError)
        }

        let perfil: PerfilRow | null = null
        let listaPermissoes: string[] = []
        if (row.perfil_id) {
          const { data: perfilData, error: perfilError } = await supabase
            .from('perfis')
            .select('*')
            .eq('id', row.perfil_id)
            .single()
          perfil = perfilData as PerfilRow | null
          if (DEBUG_USER_PROVIDER) console.log('Query perfil - data:', perfilData, 'error:', perfilError)

          const { data: permissoesData, error: permissoesError } = await supabase
            .from('perfil_permissoes')
            .select('permissao')
            .eq('perfil_id', row.perfil_id)
          listaPermissoes = permissoesData?.map((p) => p.permissao).filter(Boolean) ?? []
          if (DEBUG_USER_PROVIDER) console.log('Query permissoes - data:', permissoesData, 'error:', permissoesError)
        }

        if (DEBUG_USER_PROVIDER) console.log('Montando usuário com dados:', { usuario: row, tenant, perfil, permissoes: listaPermissoes })

        const userData = createUserWithHelpers({
          id: row.id,
          nome: row.nome,
          email: row.email,
          is_master: row.is_master,
          ativo: row.ativo,
          tenant: tenant ? { id: tenant.id, nome: tenant.nome, slug: tenant.slug } : null,
          perfil: perfil ? { id: perfil.id, nome: perfil.nome, is_admin: perfil.is_admin } : null,
          permissoes: listaPermissoes,
        })
        setValue({ user: userData, loading: false, error: null })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar usuário'
        if (DEBUG_USER_PROVIDER) console.log('fetchUser catch:', message)
        tentativasRef.current += 1
        setTentativas(tentativasRef.current)
        if (tentativasRef.current < MAX_TENTATIVAS) {
          scheduleRetry(userId)
          return
        }
        setValue({ user: null, loading: false, error: message })
        maybeRedirect()
      }
    }

    const init = async () => {
      tentativasRef.current = 0
      setTentativas(0)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        if (DEBUG_USER_PROVIDER) console.log('Erro ao obter sessão:', sessionError.message)
        setValue({ user: null, loading: false, error: sessionError.message })
        return
      }

      if (!session) {
        if (DEBUG_USER_PROVIDER) console.log('Nenhuma sessão ativa')
        setValue({ user: null, loading: false, error: null })
        return
      }

      await fetchUser(session.user.id)
    }

    init()

    const safetyTimeout = setTimeout(() => {
      setValue((prev) => {
        if (prev.loading) {
          if (DEBUG_USER_PROVIDER) console.log('Timeout de segurança: forçando loading=false após 5s')
          return { ...prev, loading: false }
        }
        return prev
      })
    }, 5000)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (DEBUG_USER_PROVIDER) console.log('Auth state changed:', event, session?.user?.id)
      redirectingRef.current = false
      if (event === 'SIGNED_OUT' || !session) {
        setValue({ user: null, loading: false, error: null })
        tentativasRef.current = 0
        setTentativas(0)
        return
      }
      tentativasRef.current = 0
      setTentativas(0)
      await fetchUser(session.user.id)
    })

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [pathname, router])

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}
