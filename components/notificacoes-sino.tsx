'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Notificacao {
  id: string
  usuario_id: string
  titulo: string
  mensagem: string | null
  criado_em: string
  lida: boolean
}

type NotificacoesSinoVariant = 'sidebar' | 'compact'

export function NotificacoesSino({
  variant = 'sidebar',
}: { variant?: NotificacoesSinoVariant } = {}) {
  const { user } = useUser()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  const naoLidas = notificacoes.filter((n) => !n.lida)
  const countNaoLidas = naoLidas.length

  const fetchNotificacoes = async (silent = false) => {
    if (!user?.id) return
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('id, usuario_id, titulo, mensagem, criado_em, lida')
        .eq('usuario_id', user.id)
        .order('criado_em', { ascending: false })
        .limit(20)
      if (error) throw error
      setNotificacoes((data as Notificacao[]) ?? [])
    } catch (error) {
      if (!silent) {
        console.error('Erro ao carregar notificações:', error)
        toast.error('Não foi possível carregar as notificações.')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    fetchNotificacoes(false)

    const channel = supabase
      .channel(`notificacoes-sino-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as Notificacao
          setNotificacoes((prev) => [newRow, ...prev.slice(0, 19)])
        }
      )
      .subscribe()

    const pollMs = 15_000
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotificacoes(true)
      }
    }, pollMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchNotificacoes(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [user?.id])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && countNaoLidas > 0 && user?.id) {
      void (async () => {
        try {
          const { error } = await supabase
            .from('notificacoes')
            .update({ lida: true })
            .eq('usuario_id', user.id)
            .eq('lida', false)
          if (error) throw error
          setNotificacoes((prev) =>
            prev.map((n) => ({ ...n, lida: true }))
          )
        } catch (error) {
          console.error('Erro ao marcar como lidas:', error)
        }
      })()
    }
  }

  const formatarData = (dataStr: string) => {
    try {
      return formatDistanceToNow(new Date(dataStr), {
        addSuffix: true,
        locale: ptBR,
      })
    } catch {
      return ''
    }
  }

  if (!user?.id) return null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notificações"
          className={cn(
            'flex items-center rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-all duration-200 cursor-pointer',
            variant === 'sidebar'
              ? 'gap-3 w-full px-3 py-2.5'
              : 'p-2 shrink-0'
          )}
        >
          <div className="relative flex-shrink-0">
            <Bell className="w-4.5 h-4.5" />
            {countNaoLidas > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold">
                {countNaoLidas > 99 ? '99+' : countNaoLidas}
              </span>
            )}
          </div>
          {variant === 'sidebar' && (
            <span className="flex-1 text-left">Notificações</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align="end"
        side="top"
        sideOffset={8}
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-foreground">Notificações</span>
            {countNaoLidas > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs text-primary hover:bg-primary/10"
                onClick={async () => {
                  if (!user?.id) return
                  try {
                    const { error } = await supabase
                      .from('notificacoes')
                      .update({ lida: true })
                      .eq('usuario_id', user.id)
                      .eq('lida', false)
                    if (error) throw error
                    setNotificacoes((prev) =>
                      prev.map((n) => ({ ...n, lida: true }))
                    )
                  } catch (error) {
                    console.error('Erro ao marcar como lidas:', error)
                  }
                }}
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : notificacoes.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            ) : (
              <div className="divide-y divide-border">
                {notificacoes.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'px-4 py-3',
                      !n.lida && 'bg-primary/5'
                    )}
                  >
                    <p className="font-medium text-foreground text-sm">
                      {n.titulo}
                    </p>
                    {n.mensagem && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {n.mensagem}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatarData(n.criado_em)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
