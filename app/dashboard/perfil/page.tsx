'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ChevronLeft,
  GraduationCap,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificacoesSino } from '@/components/notificacoes-sino'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const changePasswordSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  })

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

export default function PerfilPage() {
  const router = useRouter()
  const { user, loading: userLoading, getActiveTenantId, selectedTenant } = useUser()
  const activeTenantId = getActiveTenantId()
  const [notifInterna, setNotifInterna] = useState(true)
  const [notifEmail, setNotifEmail] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  })

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
      <div className="min-h-screen bg-background">
        <div className="h-16 bg-sidebar" />
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="flex flex-col gap-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-72" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-xl" />
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  const isGoogleUser =
    user.app_metadata?.provider === 'google' ||
    (Array.isArray(user.identities) &&
      user.identities.some((i: { provider?: string }) => i.provider === 'google'))

  console.log('provider:', user?.app_metadata?.provider, 'identities:', user?.identities)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 bg-sidebar flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground/70 hover:text-white transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-bold text-white tracking-tight">
              TrainHub
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
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
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-6">
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

          {/* Card 3 — Alterar Senha */}
          {!isGoogleUser && (
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Alterar Senha
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Preencha os campos abaixo para alterar sua senha de acesso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit(async (values) => {
                    if (!user?.email) {
                      toast.error('E-mail do usuário não disponível.')
                      return
                    }
                    try {
                      const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: user.email,
                        password: values.senhaAtual,
                      })
                      if (signInError) {
                        toast.error('Senha atual incorreta.')
                        return
                      }

                      const { error: updateError } = await supabase.auth.updateUser({
                        password: values.novaSenha,
                      })
                      if (updateError) {
                        toast.error('Erro ao alterar senha. Tente novamente.')
                        return
                      }

                      toast.success('Senha alterada com sucesso!')
                      reset()
                    } catch (error) {
                      console.error('Erro ao alterar senha:', error)
                      toast.error('Erro ao alterar senha. Tente novamente.')
                    }
                  })}
                  className="space-y-4 max-w-md"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="senhaAtual">Senha Atual</Label>
                    <Input
                      id="senhaAtual"
                      type="password"
                      autoComplete="current-password"
                      {...register('senhaAtual')}
                    />
                    {errors.senhaAtual && (
                      <p className="text-xs text-destructive">{errors.senhaAtual.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="novaSenha">Nova Senha</Label>
                    <Input
                      id="novaSenha"
                      type="password"
                      autoComplete="new-password"
                      {...register('novaSenha')}
                    />
                    {errors.novaSenha && (
                      <p className="text-xs text-destructive">{errors.novaSenha.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                    <Input
                      id="confirmarSenha"
                      type="password"
                      autoComplete="new-password"
                      {...register('confirmarSenha')}
                    />
                    {errors.confirmarSenha && (
                      <p className="text-xs text-destructive">{errors.confirmarSenha.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#00C9A7] hover:bg-[#00C9A7]/90 text-white"
                  >
                    {isSubmitting ? 'Alterando...' : 'Alterar Senha'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
