'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (_data: LoginForm) => {
    await new Promise((r) => setTimeout(r, 600))
    router.push('/dashboard')
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        console.error('Erro ao fazer login com Google:', error.message)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 -z-10 bg-[oklch(0.19_0.04_253)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.72_0.15_175/0.25),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,oklch(0.58_0.17_240/0.2),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_60%,oklch(0.72_0.15_175/0.12),transparent)]" />
        {/* Animated blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[oklch(0.72_0.15_175/0.08)] blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[oklch(0.58_0.17_240/0.1)] blur-3xl animate-[pulse_10s_ease-in-out_infinite_2s]" />
      </div>

      {/* Login Card */}
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

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full h-11 border-[oklch(1_0_0/0.2)] bg-[oklch(1_0_0/0.07)] text-white hover:bg-[oklch(1_0_0/0.12)] hover:text-white mb-5"
          >
            {isGoogleLoading ? 'Carregando...' : 'Entrar com Google'}
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[oklch(1_0_0/0.15)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[oklch(1_0_0/0.05)] px-2 text-[oklch(0.6_0.02_240)]">
                ou continue com e-mail
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[oklch(0.88_0.015_240)] text-sm font-medium">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                {...register('email')}
                className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white placeholder:text-[oklch(0.6_0.02_240)] focus-visible:ring-[#00C9A7] focus-visible:border-[#00C9A7] h-11"
              />
              {errors.email && (
                <span className="text-red-400 text-xs">{errors.email.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-[oklch(0.88_0.015_240)] text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white placeholder:text-[oklch(0.6_0.02_240)] focus-visible:ring-[#00C9A7] focus-visible:border-[#00C9A7] h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.6_0.02_240)] hover:text-white transition-colors"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <span className="text-red-400 text-xs">{errors.password.message}</span>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="text-[#00C9A7] text-sm hover:underline focus:outline-none"
              >
                Esqueci minha senha
              </button>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 bg-[#00C9A7] hover:bg-[#00b396] text-white font-semibold text-base shadow-lg shadow-[#00C9A7]/25 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
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
