'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  Heart,
  Layers,
  MapPin,
  Star,
  Share2,
  Library,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogoShell } from '@/components/catalogo/catalogo-shell'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CatalogoItem } from '@/lib/catalogo'
import { MODALIDADE_LABEL, NIVEL_LABEL } from '@/lib/catalogo'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const BASE = '/dashboard/catalogo'

export default function CatalogoDetalhePage() {
  const params = useParams()
  const rawId = params?.id
  const id = typeof rawId === 'string' ? rawId : ''

  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<CatalogoItem | null>(null)
  const [favorito, setFavorito] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [minhaNota, setMinhaNota] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [media, setMedia] = useState<number | null>(null)
  const [totalAval, setTotalAval] = useState(0)
  const [savingAval, setSavingAval] = useState(false)

  const load = useCallback(async () => {
    if (!id || !activeTenantId || !user?.id) {
      setLoading(false)
      return
    }
    const supabase = createClient()
    setLoading(true)
    try {
      const { data: row, error } = await supabase
        .from('catalogo_treinamentos')
        .select(
          'id, tenant_id, titulo, conteudo_programatico, objetivo, carga_horaria, categoria, nivel, modalidade, imagem_url, status, criado_em'
        )
        .eq('id', id)
        .eq('tenant_id', activeTenantId)
        .maybeSingle()

      if (error) throw error
      if (!row || (row as CatalogoItem).status !== 'ativo') {
        setItem(null)
        setLoading(false)
        return
      }
      setItem(row as CatalogoItem)

      const { data: fav } = await supabase
        .from('catalogo_favoritos')
        .select('catalogo_treinamento_id')
        .eq('usuario_id', user.id)
        .eq('tenant_id', activeTenantId)
        .eq('catalogo_treinamento_id', id)
        .maybeSingle()

      setFavorito(!!fav)

      const { data: minha } = await supabase
        .from('catalogo_avaliacoes')
        .select('nota, comentario')
        .eq('usuario_id', user.id)
        .eq('tenant_id', activeTenantId)
        .eq('catalogo_treinamento_id', id)
        .maybeSingle()

      const m = minha as { nota: number; comentario: string | null } | null
      setMinhaNota(m?.nota ?? null)
      setComentario(m?.comentario ?? '')

      const { data: todas } = await supabase
        .from('catalogo_avaliacoes')
        .select('nota')
        .eq('tenant_id', activeTenantId)
        .eq('catalogo_treinamento_id', id)

      const notas = (todas ?? []) as { nota: number }[]
      setTotalAval(notas.length)
      if (notas.length > 0) {
        setMedia(notas.reduce((a, b) => a + b.nota, 0) / notas.length)
      } else {
        setMedia(null)
      }
    } catch {
      toast.error('Não foi possível carregar o treinamento.')
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [id, activeTenantId, user?.id])

  useEffect(() => {
    load()
  }, [load])

  const toggleFavorito = async () => {
    if (!item || !user?.id || !activeTenantId || favLoading) return
    const supabase = createClient()
    setFavLoading(true)
    try {
      if (favorito) {
        const { error } = await supabase
          .from('catalogo_favoritos')
          .delete()
          .eq('usuario_id', user.id)
          .eq('tenant_id', activeTenantId)
          .eq('catalogo_treinamento_id', item.id)
        if (error) throw error
        setFavorito(false)
        toast.success('Removido dos salvos.')
      } else {
        const { error } = await supabase.from('catalogo_favoritos').insert({
          usuario_id: user.id,
          tenant_id: activeTenantId,
          catalogo_treinamento_id: item.id,
        })
        if (error) throw error
        setFavorito(true)
        toast.success('Salvo para depois.')
      }
    } catch {
      toast.error('Não foi possível atualizar favoritos.')
    } finally {
      setFavLoading(false)
    }
  }

  const salvarAvaliacao = async (nota: number) => {
    if (!item || !user?.id || !activeTenantId) return
    const supabase = createClient()
    setSavingAval(true)
    try {
      const { error } = await supabase.from('catalogo_avaliacoes').upsert(
        {
          usuario_id: user.id,
          tenant_id: activeTenantId,
          catalogo_treinamento_id: item.id,
          nota,
          comentario: comentario.trim() || null,
        },
        { onConflict: 'usuario_id,catalogo_treinamento_id' }
      )
      if (error) throw error
      setMinhaNota(nota)
      toast.success('Avaliação registrada.')
      load()
    } catch {
      toast.error('Não foi possível salvar a avaliação.')
    } finally {
      setSavingAval(false)
    }
  }

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
      <CatalogoShell title="Detalhe" subtitle="">
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
        <p className="text-slate-400">Este treinamento não existe ou não está ativo.</p>
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
    <CatalogoShell title={item.titulo} subtitle={item.categoria ?? undefined}>
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
        <Button
          variant={favorito ? 'default' : 'outline'}
          size="sm"
          className={
            favorito
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground [&_svg]:text-primary-foreground'
              : 'border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white [&_svg]:text-white'
          }
          onClick={toggleFavorito}
          disabled={favLoading}
        >
          <Heart className={cn('w-4 h-4 mr-2', favorito && 'fill-current')} />
          {favorito ? 'Salvo' : 'Salvar para depois'}
        </Button>
      </div>

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
                {MODALIDADE_LABEL[item.modalidade] ?? item.modalidade}
              </span>
            ) : null}
            {item.nivel ? (
              <span className="inline-flex items-center gap-1">
                <Layers className="w-4 h-4" />
                {NIVEL_LABEL[item.nivel] ?? item.nivel}
              </span>
            ) : null}
          </div>

          {media != null && (
            <p className="text-sm">
              <span className="font-medium text-white">{media.toFixed(1)}</span>
              <span className="text-slate-400"> / 5 · {totalAval} avaliação(ões) no time</span>
            </p>
          )}

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

          <div className="rounded-xl border border-white/15 p-4 space-y-3 bg-white/5">
            <Label className="text-sm font-semibold text-white">Sua avaliação (1 a 5)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => salvarAvaliacao(n)}
                  disabled={savingAval}
                  className={cn(
                    'p-2 rounded-lg border transition-colors',
                    minhaNota === n
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'border-white/20 hover:bg-white/10'
                  )}
                  aria-label={`Nota ${n}`}
                >
                  <Star
                    className={cn(
                      'w-6 h-6',
                      minhaNota != null && n <= minhaNota ? 'fill-amber-400 text-amber-500' : 'text-slate-500'
                    )}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Comentário opcional (outros colaboradores do mesmo tenant podem ver avaliações agregadas)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              className="text-sm resize-y"
            />
            {minhaNota != null && (
              <Button size="sm" variant="secondary" disabled={savingAval} onClick={() => salvarAvaliacao(minhaNota)}>
                Atualizar comentário
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-500">
            As recomendações do catálogo usam preferências e histórico de treinamentos vinculados ao seu e-mail como
            colaborador.{' '}
            <Link href={`${BASE}/preferencias`} className="text-[#6ee4d0] hover:text-[#9cf0e3] underline">
              Ajustar preferências
            </Link>
          </p>
        </div>
      </div>
    </CatalogoShell>
  )
}
