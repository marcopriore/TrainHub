'use client'

import { GraduationCap, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'

export default function SemAcessoPage() {
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[oklch(0.19_0.04_253)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.72_0.15_175/0.25),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,oklch(0.58_0.17_240/0.2),transparent)]" />
      </div>

      <div className="w-full max-w-md mx-4">
        <div className="bg-[oklch(1_0_0/0.05)] backdrop-blur-xl border border-[oklch(1_0_0/0.12)] rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <GraduationCap className="w-9 h-9 text-amber-400" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-white">
                Acesso não autorizado
              </h1>
              <p className="text-[oklch(0.75_0.02_240)] text-sm mt-2">
                Sua conta não está vinculada a nenhuma organização no TrainHub.
                Entre em contato com o administrador para solicitar acesso.
              </p>
            </div>
            <Button
              onClick={handleLogout}
              className="w-full h-11 bg-[#00C9A7] hover:bg-[#00b396] text-white font-semibold gap-2"
            >
              <LogIn className="w-4 h-4" />
              Voltar ao login
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
