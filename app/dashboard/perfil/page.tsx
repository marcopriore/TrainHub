'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

export default function PerfilPage() {
  const { user, loading: userLoading, getActiveTenantId, selectedTenant } = useUser()
  const activeTenantId = getActiveTenantId()
  const [notifInterna, setNotifInterna] = useState(true)
  const [notifEmail, setNotifEmail] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user?.id) return
    const fetchConfig = async () => {
      setConfigLoading(true)
      try {
        const { data, error } = await supabase
          .from('usuario_notificacoes_config')
          .select('notif_interna, notif_email')
          .eq('usuario_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (data) {
          setNotifInterna(data.notif_interna ?? true)
          setNotifEmail(data.notif_email ?? false)
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error)
        toast.error('Não foi possível carregar as preferências.')
      } finally {
        setConfigLoading(false)
      }
    }
    fetchConfig()
  }, [user?.id, supabase])

  const handleSave = async () => {
    if (!user?.id || !activeTenantId) {
      toast.error('Dados do usuário não disponíveis.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('usuario_notificacoes_config')
        .upsert(
          {
            usuario_id: user.id,
            tenant_id: activeTenantId,
            notif_interna: notifInterna,
            notif_email: notifEmail,
          },
          { onConflict: 'usuario_id' }
        )
      if (error) throw error
      toast.success('Preferências salvas com sucesso.')
    } catch (error) {
      console.error('Erro ao salvar preferências:', error)
      toast.error('Não foi possível salvar as preferências. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const tenantNome = user?.isMaster?.() ? selectedTenant?.nome : user?.tenant?.nome
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
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[180px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Meu Perfil
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie seus dados e preferências de notificação
        </p>
      </div>

      {/* Card 1 — Dados do Usuário */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-semibold text-primary">{initials}</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-medium text-foreground">{user.nome ?? '—'}</p>
            <p className="text-sm text-muted-foreground">{user.email ?? '—'}</p>
            <p className="text-sm text-muted-foreground">
              Perfil:{' '}
              {user.isMaster?.()
                ? 'Master'
                : user.isAdmin?.()
                  ? (user.perfil?.nome ?? 'Admin')
                  : (user.perfil?.nome ?? '—')}
            </p>
            <p className="text-sm text-muted-foreground">
              Tenant: {tenantNome ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Card 2 — Configurações de Notificação */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Notificações
        </h2>
        {configLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-interna" className="text-base font-medium cursor-pointer">
                  Notificações no sistema
                </Label>
                <Switch
                  id="notif-interna"
                  checked={notifInterna}
                  onCheckedChange={setNotifInterna}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Receba alertas no sino quando novos treinamentos forem registrados para você
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-email" className="text-base font-medium cursor-pointer">
                  Notificações por e-mail
                </Label>
                <Switch
                  id="notif-email"
                  checked={notifEmail}
                  onCheckedChange={setNotifEmail}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Receba um e-mail quando novos treinamentos forem registrados para você
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? 'Salvando...' : 'Salvar preferências'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
