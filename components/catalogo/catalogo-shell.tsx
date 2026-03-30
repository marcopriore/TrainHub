'use client'

import { useRouter } from 'next/navigation'
import { GraduationCap, ChevronLeft, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import { useUser } from '@/lib/use-user'
import { cn } from '@/lib/utils'

export function CatalogoShell({
  title,
  subtitle,
  children,
  immersive = true,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Fundo escuro, degradês e atmosfera “stage” (padrão no catálogo). */
  immersive?: boolean
}) {
  const router = useRouter()
  const { user } = useUser()

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col relative overflow-x-hidden',
        immersive && 'bg-[#03120e] text-slate-100'
      )}
    >
      {immersive ? (
        <>
          <div
            className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-25%,rgba(0,201,167,0.14),transparent),radial-gradient(ellipse_55%_45%_at_100%_15%,rgba(5,80,62,0.45),transparent),radial-gradient(ellipse_50%_55%_at_0%_85%,rgba(4,45,38,0.65),transparent)]"
            aria-hidden
          />
          <div
            className="pointer-events-none fixed top-20 left-1/4 w-[420px] h-[420px] rounded-full bg-[#00C9A7]/12 blur-[100px] motion-safe:animate-pulse"
            style={{ animationDuration: '10s' }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed bottom-0 right-0 w-[380px] h-[380px] rounded-full bg-teal-500/10 blur-[90px] motion-safe:animate-pulse"
            style={{ animationDuration: '12s' }}
            aria-hidden
          />
        </>
      ) : null}

      <header className="relative z-20 bg-sidebar h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-sidebar-border sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-lg sm:text-xl font-bold text-white tracking-tight truncate">
            TrainHub
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/40 text-xs sm:text-sm"
            onClick={() => router.push('/dashboard')}
          >
            <ChevronLeft className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Módulos</span>
          </Button>
          <NotificacoesSino variant="compact" />
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary">{initials}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 hidden sm:flex"
            onClick={async () => {
              const { createClient } = await import('@/lib/supabase')
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main
        className={cn(
          'relative z-10 flex-1 flex flex-col gap-8 px-4 sm:px-6 py-8 max-w-7xl mx-auto w-full',
          immersive && 'text-slate-200'
        )}
      >
        <div>
          <h1
            className={cn(
              'font-serif text-2xl sm:text-3xl font-bold',
              immersive ? 'text-white' : 'text-foreground'
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                'text-sm mt-1 max-w-2xl',
                immersive ? 'text-teal-200/75' : 'text-muted-foreground'
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  )
}
