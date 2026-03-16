'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { UserContext, createUserWithHelpers, getActiveTenantId, type UserContextValue } from '@/lib/user-context'

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
const STORAGE_KEY_SELECTED_TENANT = 'trainhub_selected_tenant_id'
const STORAGE_KEY_USER_CACHE = 'trainhub_user_cache_v1'
const USER_CACHE_TTL_MS = 5 * 60 * 1000

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = React.useMemo(() => createClient(), [])
  const [value, setValue] = React.useState<Omit<UserContextValue, 'selectedTenantId' | 'selectedTenant' | 'setSelectedTenant' | 'getActiveTenantId'>>({
    user: null,
    loading: true,
    error: null,
  })
  const [selectedTenant, setSelectedTenantState] = React.useState<{ id: string; nome: string; slug: string } | null>(null)
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
        // Cache de usuário em sessionStorage (TTL 5 minutos)
        if (typeof window !== 'undefined') {
          const cachedRaw = sessionStorage.getItem(STORAGE_KEY_USER_CACHE)
          if (cachedRaw) {
            try {
              const cached = JSON.parse(cachedRaw) as {
                ts: number
                usuario: UsuarioRow
                tenant: TenantRow | null
                perfil: PerfilRow | null
                permissoes: string[]
              }
              if (
                Date.now() - cached.ts < USER_CACHE_TTL_MS &&
                cached.usuario.id === userId
              ) {
                if (DEBUG_USER_PROVIDER) console.log('Usando cache de usuário do sessionStorage')
                const userData = createUserWithHelpers({
                  id: cached.usuario.id,
                  nome: cached.usuario.nome,
                  email: cached.usuario.email,
                  is_master: cached.usuario.is_master,
                  ativo: cached.usuario.ativo,
                  tenant: cached.tenant
                    ? { id: cached.tenant.id, nome: cached.tenant.nome, slug: cached.tenant.slug }
                    : null,
                  perfil: cached.perfil
                    ? {
                        id: cached.perfil.id,
                        nome: cached.perfil.nome,
                        is_admin: cached.perfil.is_admin,
                      }
                    : null,
                  permissoes: cached.permissoes,
                })
                setValue({ user: userData, loading: false, error: null })
                if (cached.usuario.is_master) {
                  const storedTenant = sessionStorage.getItem(STORAGE_KEY_SELECTED_TENANT)
                  if (storedTenant) {
                    try {
                      const parsed = JSON.parse(storedTenant) as { id: string; nome: string; slug: string }
                      setSelectedTenantState(parsed)
                    } catch {
                      const tenantObj = cached.tenant
                        ? { id: cached.tenant.id, nome: cached.tenant.nome, slug: cached.tenant.slug }
                        : null
                      setSelectedTenantState(tenantObj)
                    }
                  } else {
                    const tenantObj = cached.tenant
                      ? { id: cached.tenant.id, nome: cached.tenant.nome, slug: cached.tenant.slug }
                      : null
                    setSelectedTenantState(tenantObj)
                  }
                } else {
                  setSelectedTenantState(null)
                }
                return
              }
            } catch {
              if (DEBUG_USER_PROVIDER) console.log('Falha ao ler cache de usuário, ignorando.')
            }
          }
        }

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
        let perfil: PerfilRow | null = null
        let listaPermissoes: string[] = []

        const tenantPromise = row.tenant_id
          ? supabase
              .from('tenants')
              .select('*')
              .eq('id', row.tenant_id)
              .single()
          : null

        const perfilPromise = row.perfil_id
          ? supabase
              .from('perfis')
              .select('*')
              .eq('id', row.perfil_id)
              .single()
          : null

        const permissoesPromise = row.perfil_id
          ? supabase
              .from('perfil_permissoes')
              .select('permissao')
              .eq('perfil_id', row.perfil_id)
          : null

        const [tenantResult, perfilResult, permissoesResult] = await Promise.all([
          tenantPromise,
          perfilPromise,
          permissoesPromise,
        ])

        if (tenantResult) {
          const { data: tenantData, error: tenantError } = tenantResult as {
            data: TenantRow | null
            error: { message?: string } | null
          }
          tenant = tenantData
          if (DEBUG_USER_PROVIDER) console.log('Query tenant - data:', tenantData, 'error:', tenantError)
        }

        if (perfilResult) {
          const { data: perfilData, error: perfilError } = perfilResult as {
            data: PerfilRow | null
            error: { message?: string } | null
          }
          perfil = perfilData
          if (DEBUG_USER_PROVIDER) console.log('Query perfil - data:', perfilData, 'error:', perfilError)
        }

        if (permissoesResult) {
          const { data: permissoesData, error: permissoesError } = permissoesResult as {
            data: { permissao: string | null }[] | null
            error: { message?: string } | null
          }
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

        // Atualiza cache em sessionStorage
        if (typeof window !== 'undefined') {
          try {
            const cachePayload = {
              ts: Date.now(),
              usuario: row,
              tenant,
              perfil,
              permissoes: listaPermissoes,
            }
            sessionStorage.setItem(STORAGE_KEY_USER_CACHE, JSON.stringify(cachePayload))
          } catch {
            if (DEBUG_USER_PROVIDER) console.log('Falha ao salvar cache de usuário.')
          }
        }
        if (row.is_master) {
          const stored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_SELECTED_TENANT) : null
          const tenantObj = tenant ? { id: tenant.id, nome: tenant.nome, slug: tenant.slug } : null
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as { id: string; nome: string; slug: string }
              setSelectedTenantState(parsed)
            } catch {
              setSelectedTenantState(tenantObj)
            }
          } else {
            setSelectedTenantState(tenantObj)
          }
        } else {
          setSelectedTenantState(null)
        }
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
        setSelectedTenantState(null)
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(STORAGE_KEY_SELECTED_TENANT)
          sessionStorage.removeItem(STORAGE_KEY_USER_CACHE)
        }
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

  const setSelectedTenant = React.useCallback((tenant: { id: string; nome: string; slug: string } | null) => {
    setSelectedTenantState(tenant)
    if (typeof window !== 'undefined') {
      if (tenant) {
        sessionStorage.setItem(STORAGE_KEY_SELECTED_TENANT, JSON.stringify(tenant))
      } else {
        sessionStorage.removeItem(STORAGE_KEY_SELECTED_TENANT)
      }
    }
  }, [])

  const contextValue: UserContextValue = {
    ...value,
    selectedTenantId: selectedTenant?.id ?? null,
    selectedTenant,
    setSelectedTenant,
    getActiveTenantId: () => getActiveTenantId(value.user, selectedTenant?.id ?? null),
  }

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  )
}
