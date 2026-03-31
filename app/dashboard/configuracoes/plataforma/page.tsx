'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  GraduationCap,
  Library,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { useCatalogoModuloPlataforma } from '@/lib/use-catalogo-modulo-plataforma'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import { toast } from 'sonner'

export default function ConfiguracoesPlataformaPage() {
  const { user, loading: userLoading } = useUser()
  const {
    catalogoModuloPlataformaAtivo,
    loadingCatalogoPlataforma,
    refetchCatalogoPlataforma,
  } = useCatalogoModuloPlataforma()
  const [localOn, setLocalOn] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loadingCatalogoPlataforma) setLocalOn(catalogoModuloPlataformaAtivo)
  }, [catalogoModuloPlataformaAtivo, loadingCatalogoPlataforma])

  const persist = async (checked: boolean) => {
    if (!user?.id) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('platform_feature_flags')
        .update({
          catalogo_trainings_module_enabled: checked,
          atualizado_em: new Date().toISOString(),
          atualizado_por: user.id,
        })
        .eq('id', 'singleton')
      if (error) throw error
      setLocalOn(checked)
      await refetchCatalogoPlataforma()
      toast.success(
        checked
          ? 'Módulo Catálogo de Treinamentos visível na plataforma.'
          : 'Módulo Catálogo de Treinamentos oculto para todos os usuários.'
      )
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível salvar. Verifique se a migration da plataforma foi aplicada.')
      setLocalOn(!checked)
    } finally {
      setSaving(false)
    }
  }

  const initials = user?.nome
    ? user.nome
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '—'

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-10 w-64" />
      </div>
    )
  }

  if (!user.isMaster?.()) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar h-16 flex items-center justify-between px-6 border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-white tracking-tight">TrainHub</span>
          <Link
            href="/dashboard/configuracoes"
            className="ml-4 inline-flex items-center gap-1 text-sm text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/40 px-2 py-1 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Configurações
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

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="font-serif text-2xl font-bold text-foreground">Plataforma</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Controles globais TrainHub (somente Master). Afetam todos os tenants.
        </p>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#8b5cf61a', color: '#8b5cf6' }}
            >
              <Library className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Label htmlFor="toggle-catalogo-plataforma" className="text-base font-semibold cursor-pointer">
                  Catálogo de Treinamentos
                </Label>
                {loadingCatalogoPlataforma ? (
                  <Skeleton className="h-6 w-11 rounded-full" />
                ) : (
                  <Switch
                    id="toggle-catalogo-plataforma"
                    checked={localOn}
                    disabled={saving}
                    onCheckedChange={(v) => {
                      setLocalOn(v)
                      void persist(v)
                    }}
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Quando desligado, a vitrine do catálogo e o ecossistema do pool global (importar da global,
                consentimento, moderação Master, opt-in de categorias para vitrine) somem para todos. A gestão
                local de treinamentos, o registro de treinamentos e as categorias do tenant continuam
                acessíveis. Ligue novamente para reativar a vitrine e o global.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
