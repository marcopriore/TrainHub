'use client'

import Link from 'next/link'
import {
  Settings,
  LogOut,
  Shield,
  Users,
  Building2,
  ChevronRight,
} from 'lucide-react'
import { useUser } from '@/lib/use-user'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import { Button } from '@/components/ui/button'

const COR_PERFIS = '#00C9A7'
const COR_USUARIOS = '#3b82f6'
const COR_TENANTS = '#8b5cf6'

export default function ConfiguracoesPage() {
  const { user, loading } = useUser()

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  const podeAcessarConfiguracoes = user?.isMaster?.() || user?.isAdmin?.()
  const podeAcessarTenants = user?.isMaster?.()

  if (loading || !user || !podeAcessarConfiguracoes) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 bg-sidebar flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <Settings className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-white">
            Configurações do Hub
          </span>
          <span className="text-sidebar-foreground/40">|</span>
          <Link
            href="/dashboard"
            className="text-sm text-sidebar-foreground/50 hover:text-white transition-colors"
          >
            ← Home
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/perfil"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/40 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">{initials}</span>
            </div>
          </Link>
          <NotificacoesSino variant="compact" />
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
            onClick={async () => {
              const { createClient } = await import('@/lib/supabase')
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Configurações do Hub
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie perfis, usuários e estrutura do sistema
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
          {/* Card 1 — Perfis de Acesso */}
          <Link
            href="/dashboard/configuracoes/perfis"
            className="h-44 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 hover:shadow-md hover:border-[#00C9A7]/40 transition-all duration-200 group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${COR_PERFIS}1a`, color: COR_PERFIS }}
            >
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">
                Perfis de Acesso
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure perfis e permissões de acesso ao sistema
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium" style={{ color: COR_PERFIS }}>
              <span>Acessar</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Card 2 — Usuários */}
          <Link
            href="/dashboard/configuracoes/usuarios"
            className="h-44 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 hover:shadow-md hover:border-[#3b82f6]/40 transition-all duration-200 group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${COR_USUARIOS}1a`, color: COR_USUARIOS }}
            >
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">
                Usuários
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie os usuários do tenant
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium" style={{ color: COR_USUARIOS }}>
              <span>Acessar</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Card 3 — Tenants */}
          {podeAcessarTenants && (
            <Link
              href="/dashboard/configuracoes/tenants"
              className="h-44 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 hover:shadow-md hover:border-[#8b5cf6]/40 transition-all duration-200 group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${COR_TENANTS}1a`, color: COR_TENANTS }}
              >
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-foreground">
                  Tenants
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie os tenants e suas configurações
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium" style={{ color: COR_TENANTS }}>
                <span>Acessar</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
