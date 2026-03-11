'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useUser } from '@/lib/use-user'
import {
  GraduationCap,
  LayoutDashboard,
  PlusCircle,
  List,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Briefcase,
  Users,
  ChevronDown,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TenantSelector } from '@/components/tenant-selector'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const mainNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: null as string | null },
  { href: '/dashboard/treinamentos/novo', label: 'Registrar Treinamento', icon: PlusCircle, permission: 'registrar_treinamento' },
  { href: '/dashboard/historico', label: 'Histórico de Treinamentos', icon: List, permission: null },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: BarChart2, permission: null },
]

const configNavItems = [
  { href: '/dashboard/configuracoes/setores', label: 'Setores', icon: Building2, permission: 'gerenciar_setores', masterOnly: false },
  { href: '/dashboard/configuracoes/empresas-parceiras', label: 'Empresas Parceiras', icon: Briefcase, permission: 'gerenciar_empresas_parceiras', masterOnly: false },
  { href: '/dashboard/configuracoes/colaboradores', label: 'Colaboradores', icon: Users, permission: 'gerenciar_colaboradores', masterOnly: false },
  { href: '/dashboard/configuracoes/perfis', label: 'Perfil de Acesso', icon: Shield, permission: null, masterOnly: true },
  { href: '/dashboard/configuracoes/tenants', label: 'Tenants', icon: Building2, permission: null, masterOnly: true },
]

interface SidebarProps {
  isMobileOpen: boolean
  onClose: () => void
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { user, loading } = useUser()

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground pointer-events-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-serif text-xl font-bold text-white tracking-tight">TrainHub</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-sidebar-foreground/60 hover:text-white transition-colors lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <TenantSelector />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Menu principal">
        <ul className="flex flex-col gap-1">
          {mainNavItems.map(({ href, label, icon: Icon, permission }) => {
            if (permission && !user?.hasPermission?.(permission) && !user?.isAdmin?.() && !user?.isMaster?.()) return null
            const isActive = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                    isActive
                      ? 'bg-sidebar-accent text-white'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={cn(
                      'w-4.5 h-4.5 flex-shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-sidebar-foreground/50 group-hover:text-primary'
                    )}
                  />
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            )
          })}

          <li className="pt-2 mt-2 border-t border-sidebar-border/50">
            <Collapsible
              defaultOpen={pathname.startsWith('/dashboard/configuracoes')}
              className="group/collapsible"
            >
              <CollapsibleTrigger
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                )}
              >
                <Settings className="w-4.5 h-4.5 flex-shrink-0 text-sidebar-foreground/50" />
                <span className="flex-1 text-left">Configurações</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="flex flex-col gap-0.5 mt-1 pl-1">
                  {configNavItems.map(({ href, label, icon: Icon, masterOnly, permission }) => {
                    if (masterOnly && !user?.isMaster()) return null
                    if (permission && !user?.hasPermission?.(permission) && !user?.isAdmin?.() && !user?.isMaster?.()) return null
                    const isActive = pathname === href
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                            isActive
                              ? 'bg-sidebar-accent text-white'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                          )}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4 flex-shrink-0',
                              isActive ? 'text-primary' : 'text-sidebar-foreground/50'
                            )}
                          />
                          <span>{label}</span>
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </li>
        </ul>
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {loading ? 'Carregando...' : user?.nome ?? '—'}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {user?.email ?? '—'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            const { createClient } = await import('@/lib/supabase')
            const supabase = createClient()
            await supabase.auth.signOut()
            window.location.href = '/login'
          }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group cursor-pointer"
        >
          <LogOut className="w-4.5 h-4.5 flex-shrink-0 group-hover:text-red-400" />
          Sair
        </button>
      </div>
    </div>
  )
}

export function Sidebar({ isMobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen sticky top-0 flex-shrink-0 pointer-events-auto">
        <SidebarContent />
      </aside>

      {/* Mobile overlay - lg:pointer-events-none evita bloquear cliques no desktop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden lg:pointer-events-none"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 transition-transform duration-300 ease-in-out lg:hidden pointer-events-auto',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Menu de navegação"
      >
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  )
}

export function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-30">
      <button
        onClick={onMenuOpen}
        className="text-sidebar-foreground/70 hover:text-white transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-serif text-lg font-bold text-white">TrainHub</span>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background pointer-events-auto">
      <Sidebar isMobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileTopBar onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
