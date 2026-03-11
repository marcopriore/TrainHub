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
import { toast } from 'sonner'

const schema = z
  .object({
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Senha alterada com sucesso!')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha')
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[oklch(0.19_0.04_253)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.72_0.15_175/0.25),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,oklch(0.58_0.17_240/0.2),transparent)]" />
      </div>

      <div className="w-full max-w-md mx-4">
        <div className="bg-[oklch(1_0_0/0.05)] backdrop-blur-xl border border-[oklch(1_0_0/0.12)] rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#00C9A7] flex items-center justify-center shadow-lg shadow-[#00C9A7]/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-white">Nova senha</h1>
            <p className="text-[oklch(0.88_0.015_240)] text-sm text-center">
              Informe sua nova senha
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[oklch(0.88_0.015_240)] text-sm font-medium">
                Nova senha
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...form.register('password')}
                  className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.6_0.02_240)] hover:text-white"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <span className="text-red-400 text-xs">{form.formState.errors.password.message}</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[oklch(0.88_0.015_240)] text-sm font-medium">
                Confirmar senha
              </Label>
              <div className="relative">
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...form.register('confirmPassword')}
                  className="bg-[oklch(1_0_0/0.07)] border-[oklch(1_0_0/0.15)] text-white h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.6_0.02_240)] hover:text-white"
                  aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <span className="text-red-400 text-xs">
                  {form.formState.errors.confirmPassword.message}
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-11 bg-[#00C9A7] hover:bg-[#00b396] text-white font-semibold"
            >
              {form.formState.isSubmitting ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="mt-4 w-full text-[oklch(0.7_0.02_240)] hover:text-white"
            onClick={() => router.push('/login')}
          >
            Voltar ao login
          </Button>
        </div>
      </div>
    </main>
  )
}
