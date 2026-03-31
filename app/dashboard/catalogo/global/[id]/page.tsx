'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { ArrowLeft, Clock, Layers, Library, MapPin, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogoShell } from '@/components/catalogo/catalogo-shell'
import { toast } from 'sonner'
import { MODALIDADE_LABEL, NIVEL_LABEL } from '@/lib/catalogo'

const BASE = '/dashboard/catalogo'

type GlobalRow = {
  id: string
  titulo: string
  conteudo_programatico: string | null
  objetivo: string | null
  carga_horaria: number | null
  categoria: string | null
  nivel: string | null
  modalidade: string | null
  imagem_url: string | null
  status: string
}

export default function CatalogoGlobalDetalhePage() {
  const params = useParams()
  const rawId = params?.id
  const id = typeof rawId === 'string' ? rawId : ''

  const { getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<GlobalRow | null>(null)

  const load = useCallback(async () => {
    if (!id || !activeTenantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      const { data: row, error } = await supabase
        .from('catalogo_treinamentos_globais')
        .select(
          'id, titulo, conteudo_programatico, objetivo, carga_horaria, categoria, nivel, modalidade, imagem_url, status'
        )
        .eq('id', id)
        .eq('status', 'publicado')
        .maybeSingle()

      if (error) throw error
      setItem((row as GlobalRow) ?? null)
    } catch {
      toast.error('Não foi possível carregar este treinamento global.')
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [id, activeTenantId])

  useEffect(() => {
    load()
  }, [load])

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  if (!activeTenantId) {
    return (
      <CatalogoShell title="Catálogo global" subtitle="">
        <p className="text-sm text-slate-400">Selecione um tenant.</p>
      </CatalogoShell>
    )
  }

  if (loading) {
    return (
      <CatalogoShell title="Carregando…" subtitle="">
        <Skeleton className="h-64 w-full rounded-xl bg-white/10" />
        <Skeleton className="h-40 w-full mt-6 bg-white/10" />
      </CatalogoShell>
    )
  }

  if (!item) {
    return (
      <CatalogoShell title="Não encontrado" subtitle="">
        <p className="text-slate-400">
          Este programa não está disponível na sua vitrine (categoria sem opt-in ou conteúdo despublicado).
        </p>
        <Button
          className="mt-4 border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white [&_svg]:text-white"
          variant="outline"
          asChild
        >
          <Link href={BASE}>Voltar ao catálogo</Link>
        </Button>
      </CatalogoShell>
    )
  }

  const ch = item.carga_horaria != null ? `${item.carga_horaria}h` : null

  return (
    <CatalogoShell
      title={item.titulo}
      subtitle={item.categoria ? `${item.categoria} · Catálogo global TrainHub` : 'Catálogo global TrainHub'}
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10" asChild>
          <Link href={BASE}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Catálogo
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white [&_svg]:text-white"
          onClick={share}
        >
          <Share2 className="w-4 h-4 mr-2" />
          Copiar link
        </Button>
      </div>

      <p className="text-xs text-slate-500 mb-6 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        Conteúdo do pool global TrainHub. Favoritos e avaliações do seu tenant aplicam-se apenas a treinamentos
        internos. Para incluir um programa semelhante no seu catálogo local, use a gestão (importar cópia, quando
        disponível).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-white/5">
          {item.imagem_url ? (
            <Image
              src={item.imagem_url}
              alt={item.titulo}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#00C9A7]/80 via-emerald-800 to-[#053d32] p-6">
              <Library className="w-20 h-20 text-white/40" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            {ch ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {ch}
              </span>
            ) : null}
            {item.modalidade ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {MODALIDADE_LABEL[item.modalidade as keyof typeof MODALIDADE_LABEL] ?? item.modalidade}
              </span>
            ) : null}
            {item.nivel ? (
              <span className="inline-flex items-center gap-1">
                <Layers className="w-4 h-4" />
                {NIVEL_LABEL[item.nivel as keyof typeof NIVEL_LABEL] ?? item.nivel}
              </span>
            ) : null}
          </div>

          {item.objetivo ? (
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Objetivo</h2>
              <p className="text-sm text-slate-400 whitespace-pre-wrap">{item.objetivo}</p>
            </div>
          ) : null}

          {item.conteudo_programatico ? (
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Conteúdo programático</h2>
              <p className="text-sm text-slate-400 whitespace-pre-wrap">{item.conteudo_programatico}</p>
            </div>
          ) : null}
        </div>
      </div>
    </CatalogoShell>
  )
}
