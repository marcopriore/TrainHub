'use client'

import Link from 'next/link'
import {
  GraduationCap,
  LogOut,
  ClipboardList,
  BookOpen,
  Library,
  Award,
  Lock,
  ChevronRight,
} from 'lucide-react'
import { useUser } from '@/lib/use-user'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const COR_GESTAO = '#00C9A7'
const COR_TRILHAS = '#3b82f6'
const COR_CATALOGO = '#8b5cf6'
const COR_AVALIACOES = '#f59e0b'

export default function ModulosPage() {
  const { user, loading } = useUser()

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 bg-sidebar" />
        <div className="max-w-5xl mx-auto px-6 py-12">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-80 mb-10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 bg-sidebar flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-white tracking-tight">
            TrainHub
          </span>
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
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Olá, {user.nome ?? 'Usuário'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Selecione um módulo para começar
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
          {/* Card 1 — Gestão de Treinamentos */}
          <Link
            href="/dashboard/gestao"
            className="h-52 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 hover:shadow-md hover:border-[#00C9A7]/40 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${COR_GESTAO}1a`, color: COR_GESTAO }}
              >
                <ClipboardList className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                Ativo
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">
                Gestão de Treinamentos
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Registre, acompanhe e analise todos os treinamentos corporativos
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium" style={{ color: COR_GESTAO }}>
              <span>Acessar</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Card 2 — Trilhas de Conhecimento */}
          <Link
            href="/dashboard/gestao/minhas-trilhas"
            className="h-52 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 hover:shadow-md hover:border-[#3b82f6]/40 transition-all duration-200 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${COR_TRILHAS}1a`, color: COR_TRILHAS }}
              >
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                Ativo
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">
                Trilhas de Conhecimento
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Acompanhe sua jornada de aprendizado e evolução profissional
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-medium" style={{ color: COR_TRILHAS }}>
              <span>Acessar</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Card 3 — Catálogo de Treinamentos */}
          <div
            className="h-52 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 opacity-60 cursor-not-allowed"
          >
            <div className="flex justify-between items-start">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${COR_CATALOGO}1a`, color: COR_CATALOGO }}
              >
                <Library className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                Em breve
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">
                Catálogo de Treinamentos
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Explore o catálogo completo de treinamentos disponíveis
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Em breve</span>
            </div>
          </div>

          {/* Card 4 — Avaliações e Certificados */}
          <div
            className="h-52 bg-card rounded-2xl border border-border shadow-sm flex flex-col justify-between p-6 opacity-60 cursor-not-allowed"
          >
            <div className="flex justify-between items-start">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${COR_AVALIACOES}1a`, color: COR_AVALIACOES }}
              >
                <Award className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                Em breve
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">
                Avaliações e Certificados
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Realize avaliações e obtenha certificados de conclusão
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Em breve</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
