'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileCheck, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LEGAL_PATHS,
  TERMOS_PLATAFORMA_VERSAO_ATUAL,
  usuarioTemTermosPlataformaAtuais,
} from '@/lib/termos-plataforma'
import { registrarAuditoriaCliente } from '@/lib/registrar-auditoria'
import { toast } from 'sonner'

const STORAGE_KEY_USER_CACHE = 'trainhub_user_cache_v1'

export default function AceitarTermosPage() {
  const router = useRouter()
  const { user, loading } = useUser()
  const [concordo, setConcordo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    const run = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('usuarios')
        .select('termos_plataforma_versao')
        .eq('id', user.id)
        .maybeSingle()
      const v = (data as { termos_plataforma_versao: string | null } | null)?.termos_plataforma_versao
      if (usuarioTemTermosPlataformaAtuais(v)) {
        router.replace('/dashboard')
      }
    }
    void run()
  }, [loading, user, router])

  const confirmar = async () => {
    if (!user || !concordo) return
    setEnviando(true)
    const supabase = createClient()
    try {
      const { error } = await supabase.rpc('aceitar_termos_plataforma', {
        p_versao: TERMOS_PLATAFORMA_VERSAO_ATUAL,
      })
      if (error) throw error

      try {
        sessionStorage.removeItem(STORAGE_KEY_USER_CACHE)
      } catch {
        /* ignore */
      }

      await registrarAuditoriaCliente(supabase, {
        userId: user.id,
        tenantId: user.tenant?.id ?? null,
        acao: 'aceite_termos_plataforma',
        entidade: 'usuario',
        entidadeId: user.id,
        detalhes: { versao: TERMOS_PLATAFORMA_VERSAO_ATUAL },
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })

      toast.success('Obrigado. Termos registrados.')
      router.replace('/dashboard')
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível registrar o aceite. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Skeleton className="h-10 w-64" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <FileCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="font-serif text-xl font-bold text-center">Termos e privacidade</h1>
          <p className="text-sm text-muted-foreground text-center">
            Para continuar, confirme que leu e concorda com os documentos abaixo (versão{' '}
            {TERMOS_PLATAFORMA_VERSAO_ATUAL}).
          </p>
        </div>

        <ul className="text-sm space-y-2 mb-6">
          <li>
            <Link
              href={LEGAL_PATHS.termos}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <GraduationCap className="w-4 h-4" />
              Termos de uso
            </Link>
          </li>
          <li>
            <Link
              href={LEGAL_PATHS.privacidade}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <GraduationCap className="w-4 h-4" />
              Política de privacidade
            </Link>
          </li>
        </ul>

        <div className="flex items-start gap-3 mb-6">
          <Checkbox
            id="concordo"
            checked={concordo}
            onCheckedChange={(c) => setConcordo(c === true)}
            className="mt-1"
          />
          <Label htmlFor="concordo" className="text-sm font-normal leading-snug cursor-pointer">
            Li e concordo com os documentos. Entendo que a versão aplicável pode ser atualizada e que poderei
            ser solicitado a aceitar novamente.
          </Label>
        </div>

        <Button
          type="button"
          className="w-full bg-[#00C9A7] hover:bg-[#00b396] text-white"
          disabled={!concordo || enviando}
          onClick={() => void confirmar()}
        >
          {enviando ? 'Registrando…' : 'Continuar'}
        </Button>
      </div>
    </main>
  )
}
