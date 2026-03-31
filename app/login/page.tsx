'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Eye, EyeOff, Mail, LogIn } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase'
import { registrarAuditoriaCliente } from '@/lib/registrar-auditoria'
import { usuarioTemTermosPlataformaAtuais } from '@/lib/termos-plataforma'
import { toast } from 'sonner'

const loginSchema = z.object({
  email: z.string().min(1, 'E-mail obrigatório').email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória').min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

const forgotSchema = z.object({
  email: z.string().min(1, 'E-mail obrigatório').email('E-mail inválido'),
})

type LoginForm = z.infer<typeof loginSchema>
type ForgotForm = z.infer<typeof forgotSchema>

function translateAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials'))
    return 'E-mail ou senha incorretos. Verifique e tente novamente.'
  if (lower.includes('email not confirmed')) return 'E-mail não confirmado. Verifique sua caixa de entrada.'
  if (lower.includes('user not found')) return 'Usuário não encontrado.'
  if (lower.includes('too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network') ||
    lower.includes('fetch')
  ) {
    return 'Não foi possível conectar ao Supabase. Confira: internet; projeto ativo no dashboard; NEXT_PUBLIC_SUPABASE_URL e ANON_KEY no .env.local; reinicie npm run dev após mudar o .env.'
  }
  return message
}

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotSubmitting, setForgotSubmitting] = useState(false)

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onLoginSubmit = async (data: LoginForm) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        toast.error(translateAuthError(error.message))
        return
      }
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      let destino = '/dashboard'
      if (uid) {
        const { data: row } = await supabase
          .from('usuarios')
          .select('tenant_id, termos_plataforma_versao')
          .eq('id', uid)
          .maybeSingle()
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null
        await registrarAuditoriaCliente(supabase, {
          userId: uid,
          tenantId: (row as { tenant_id: string | null } | null)?.tenant_id ?? null,
          acao: 'login',
          entidade: 'sessao',
          entidadeId: uid,
          detalhes: { email: data.email, metodo: 'senha' },
          userAgent: ua,
        })
        destino = usuarioTemTermosPlataformaAtuais(
          (row as { termos_plataforma_versao?: string | null } | null)?.termos_plataforma_versao ?? null
        )
          ? '/dashboard'
          : '/aceitar-termos'
      }
      router.push(destino)
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login'
      toast.error(translateAuthError(msg))
    }
  }

  const onForgotSubmit = async (data: ForgotForm) => {
    setForgotSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) {
        toast.error(translateAuthError(error.message))
        return
      }
      toast.success('E-mail de recuperação enviado!')
      setForgotOpen(false)
      forgotForm.reset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar e-mail'
      toast.error(translateAuthError(msg))
    } finally {
      setForgotSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 -z-10 bg-[oklch(0.19_0.04_253)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.72_0.15_175/0.25),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,oklch(0.58_0.17_240/0.2),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_60%,oklch(0.72_0.15_175/0.12),transparent)]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[oklch(0.72_0.15_175/0.08)] blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[oklch(0.58_0.17_240/0.1)] blur-3xl animate-[pulse_10s_ease-in-out_infinite_2s]" />
      </div>

      <div className="w-full max-w-md mx-4">
        <div className="bg-[oklch(1_0_0/0.05)] backdrop-blur-xl border border-[oklch(1_0_0/0.12)] rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#00C9A7] flex items-center justify-center shadow-lg shadow-[#00C9A7]/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="font-serif text-3xl font-bold text-white tracking-tight">TrainHub</h1>
              <p className="text-[oklch(0.88_0.015_240)] text-sm mt-1">
                Plataforma de Gestão de Treinamentos
              </p>
            </div>
          </div>
          <form
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email" className="text-[oklch(0.88_0.015_240)] text-sm font-medium">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    {...loginForm.register('email')}
                    className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white placeholder:text-[oklch(0.6_0.02_240)] focus-visible:ring-[#00C9A7] focus-visible:border-[#00C9A7] h-11"
                  />
                  {loginForm.formState.errors.email && (
                    <span className="text-red-400 text-xs">
                      {loginForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="password"
                    className="text-[oklch(0.88_0.015_240)] text-sm font-medium"
                  >
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...loginForm.register('password')}
                      className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white placeholder:text-[oklch(0.6_0.02_240)] focus-visible:ring-[#00C9A7] focus-visible:border-[#00C9A7] h-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.6_0.02_240)] hover:text-white transition-colors"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <span className="text-red-400 text-xs">
                      {loginForm.formState.errors.password.message}
                    </span>
                  )}
                </div>

                <div className="flex justify-end">
                  <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-[#00C9A7] text-sm hover:underline focus:outline-none"
                      >
                        Esqueci minha senha
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-[oklch(0.19_0.04_253)] border-[oklch(1_0_0/0.12)]">
                      <DialogHeader>
                        <DialogTitle className="text-white">
                          Recuperar senha
                        </DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={forgotForm.handleSubmit(onForgotSubmit)}
                        className="flex flex-col gap-4"
                      >
                        <p className="text-[oklch(0.88_0.015_240)] text-sm">
                          Informe seu e-mail para receber o link de recuperação.
                        </p>
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="forgot-email"
                            className="text-[oklch(0.88_0.015_240)] text-sm"
                          >
                            E-mail
                          </Label>
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="seu@email.com"
                            {...forgotForm.register('email')}
                            className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white"
                          />
                          {forgotForm.formState.errors.email && (
                            <span className="text-red-400 text-xs">
                              {forgotForm.formState.errors.email.message}
                            </span>
                          )}
                        </div>
                        <Button
                          type="submit"
                          disabled={forgotSubmitting}
                          className="bg-[#00C9A7] hover:bg-[#00b396] text-white"
                        >
                          {forgotSubmitting ? 'Enviando...' : 'Enviar e-mail'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <Button
                  type="submit"
                  disabled={loginForm.formState.isSubmitting}
                  className="h-11 bg-[#00C9A7] hover:bg-[#00b396] text-white font-semibold text-base shadow-lg shadow-[#00C9A7]/25 transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {loginForm.formState.isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>

          <p className="text-center text-[oklch(0.55_0.02_240)] text-xs mt-6">
            © {new Date().getFullYear()} TrainHub. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </main>
  )
}
