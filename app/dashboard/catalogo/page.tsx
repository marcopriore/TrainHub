'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, Library } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogoShell } from '@/components/catalogo/catalogo-shell'
import { CatalogoHeroMarquee } from '@/components/catalogo/catalogo-hero-marquee'
import { CatalogoRow } from '@/components/catalogo/catalogo-row'
import { CatalogoCard } from '@/components/catalogo/catalogo-card'
import {
  type CatalogoItem,
  type UsuarioCatalogoPreferencias,
  preferenciasPreenchidas,
  pontuacaoRecomendacao,
  titulosCatalogoJaRealizados,
  itemInPreferredCategories,
} from '@/lib/catalogo'
import { toast } from 'sonner'

const BASE = '/dashboard/catalogo'

export default function CatalogoExplorePage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [itens, setItens] = useState<CatalogoItem[]>([])
  const [prefs, setPrefs] = useState<UsuarioCatalogoPreferencias | null>(null)
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [historicoNomes, setHistoricoNomes] = useState<string[]>([])
  const [mediasAval, setMediasAval] = useState<Record<string, number>>({})
  const [globaisItens, setGlobaisItens] = useState<CatalogoItem[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!activeTenantId || !user?.id) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    const run = async () => {
      setLoading(true)
      try {
        const { data: catRows, error: catErr } = await supabase
          .from('catalogo_treinamentos')
          .select(
            'id, tenant_id, titulo, conteudo_programatico, objetivo, carga_horaria, categoria, nivel, modalidade, imagem_url, status, criado_em, atualizado_em'
          )
          .eq('tenant_id', activeTenantId)
          .eq('status', 'ativo')
          .order('criado_em', { ascending: false })

        if (catErr) throw catErr
        setItens((catRows as CatalogoItem[]) ?? [])

        const { data: prefRow } = await supabase
          .from('usuario_catalogo_preferencias')
          .select('id, usuario_id, tenant_id, categorias, niveis, modalidades, atualizado_em')
          .eq('usuario_id', user.id)
          .eq('tenant_id', activeTenantId)
          .maybeSingle()

        setPrefs((prefRow as UsuarioCatalogoPreferencias | null) ?? null)

        const { data: favRows } = await supabase
          .from('catalogo_favoritos')
          .select('catalogo_treinamento_id')
          .eq('usuario_id', user.id)
          .eq('tenant_id', activeTenantId)

        setFavoritos(
          new Set((favRows ?? []).map((r: { catalogo_treinamento_id: string }) => r.catalogo_treinamento_id))
        )

        if (user.email) {
          const { data: col } = await supabase
            .from('colaboradores')
            .select('id')
            .eq('tenant_id', activeTenantId)
            .eq('email', user.email)
            .maybeSingle()

          const colId = (col as { id: string } | null)?.id
          if (colId) {
            const { data: tc } = await supabase
              .from('treinamento_colaboradores')
              .select('treinamentos(nome)')
              .eq('colaborador_id', colId)

            const nomes: string[] = []
            for (const row of tc ?? []) {
              const t = (row as { treinamentos: { nome: string } | { nome: string }[] | null })
                .treinamentos
              const nome = Array.isArray(t) ? t[0]?.nome : t?.nome
              if (nome) nomes.push(nome)
            }
            setHistoricoNomes(nomes)
          } else {
            setHistoricoNomes([])
          }
        } else {
          setHistoricoNomes([])
        }

        const { data: avalRows } = await supabase
          .from('catalogo_avaliacoes')
          .select('catalogo_treinamento_id, nota')
          .eq('tenant_id', activeTenantId)

        const sum: Record<string, { t: number; n: number }> = {}
        for (const r of avalRows ?? []) {
          const row = r as { catalogo_treinamento_id: string; nota: number }
          if (!sum[row.catalogo_treinamento_id]) sum[row.catalogo_treinamento_id] = { t: 0, n: 0 }
          sum[row.catalogo_treinamento_id].t += row.nota
          sum[row.catalogo_treinamento_id].n += 1
        }
        const med: Record<string, number> = {}
        for (const k of Object.keys(sum)) {
          med[k] = sum[k].t / sum[k].n
        }
        setMediasAval(med)

        const { data: optRows } = await supabase
          .from('tenant_catalogo_global_categorias')
          .select('categoria')
          .eq('tenant_id', activeTenantId)
          .eq('opt_in', true)

        const catsGlob = (optRows ?? [])
          .map((r) => (r as { categoria: string }).categoria)
          .filter(Boolean)

        if (catsGlob.length > 0) {
          const { data: gData, error: gErr } = await supabase
            .from('catalogo_treinamentos_globais')
            .select(
              'id, titulo, conteudo_programatico, objetivo, carga_horaria, categoria, nivel, modalidade, imagem_url, criado_em, aprovado_em'
            )
            .eq('status', 'publicado')
            .in('categoria', catsGlob)

          if (!gErr && gData) {
            setGlobaisItens(
              (gData as Record<string, unknown>[]).map((row) => ({
                id: row.id as string,
                tenant_id: activeTenantId,
                titulo: row.titulo as string,
                conteudo_programatico: (row.conteudo_programatico as string | null) ?? null,
                objetivo: (row.objetivo as string | null) ?? null,
                carga_horaria: (row.carga_horaria as number | null) ?? null,
                categoria: (row.categoria as string | null) ?? null,
                nivel: row.nivel as CatalogoItem['nivel'],
                modalidade: row.modalidade as CatalogoItem['modalidade'],
                imagem_url: (row.imagem_url as string | null) ?? null,
                status: 'ativo',
                criado_em: (row.criado_em as string) ?? (row.aprovado_em as string) ?? '',
                atualizado_em: row.aprovado_em as string | undefined,
                origem_global: true,
              }))
            )
          } else {
            setGlobaisItens([])
          }
        } else {
          setGlobaisItens([])
        }
      } catch (e) {
        toast.error('Não foi possível carregar o catálogo.')
        setItens([])
        setGlobaisItens([])
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [activeTenantId, user?.id, user?.email])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return itens
    return itens.filter(
      (i) =>
        i.titulo.toLowerCase().includes(t) ||
        (i.categoria ?? '').toLowerCase().includes(t) ||
        (i.objetivo ?? '').toLowerCase().includes(t)
    )
  }, [itens, q])

  const globaisFiltrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return globaisItens
    return globaisItens.filter(
      (i) =>
        i.titulo.toLowerCase().includes(t) ||
        (i.categoria ?? '').toLowerCase().includes(t) ||
        (i.objetivo ?? '').toLowerCase().includes(t)
    )
  }, [globaisItens, q])

  const heroItems = useMemo(() => {
    const pool = filtrados.length > 0 ? filtrados : itens
    const comImg = pool.filter((i) => i.imagem_url)
    if (comImg.length >= 1) {
      const rest = pool.filter((i) => !i.imagem_url)
      return [...comImg, ...rest].slice(0, 8)
    }
    return pool.slice(0, 8)
  }, [filtrados, itens])

  const realizadosIds = useMemo(
    () => titulosCatalogoJaRealizados(filtrados.length > 0 ? filtrados : itens, historicoNomes),
    [filtrados, itens, historicoNomes]
  )

  const recomendados = useMemo(() => {
    if (!preferenciasPreenchidas(prefs)) return []
    const pool = filtrados.length > 0 ? filtrados : itens
    return [...pool]
      .filter((i) => !realizadosIds.has(i.id))
      .filter((i) => itemInPreferredCategories(i, prefs))
      .map((i) => ({
        item: i,
        score: pontuacaoRecomendacao(i, prefs, historicoNomes, favoritos),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 18)
      .map((x) => x.item)
  }, [filtrados, itens, prefs, historicoNomes, favoritos, realizadosIds])

  const novidades = useMemo(() => {
    const pool = filtrados.length > 0 ? filtrados : itens
    return [...pool].sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? '')).slice(0, 14)
  }, [filtrados, itens])

  const curtos = useMemo(() => {
    const pool = filtrados.length > 0 ? filtrados : itens
    return pool.filter((i) => (i.carga_horaria ?? 99) <= 4 && (i.carga_horaria ?? 0) > 0).slice(0, 14)
  }, [filtrados, itens])

  const favoritosItens = useMemo(() => {
    const pool = filtrados.length > 0 ? filtrados : itens
    return pool.filter((i) => favoritos.has(i.id))
  }, [filtrados, itens, favoritos])

  const popularesSorted = useMemo(() => {
    const pool = filtrados.length > 0 ? filtrados : itens
    return [...pool]
      .map((i) => ({ item: i, m: mediasAval[i.id] ?? 0 }))
      .filter((x) => x.m > 0)
      .sort((a, b) => b.m - a.m)
      .slice(0, 14)
      .map((x) => x.item)
  }, [filtrados, itens, mediasAval])

  const porCategoria = useMemo(() => {
    const pool = filtrados.length > 0 ? filtrados : itens
    const map = new Map<string, CatalogoItem[]>()
    for (const i of pool) {
      const c = (i.categoria ?? '').trim() || 'Outros'
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(i)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 14)
  }, [filtrados, itens])

  if (!activeTenantId) {
    return (
      <CatalogoShell title="Catálogo" subtitle="Selecione um tenant para continuar.">
        <p className="text-muted-foreground text-sm">Nenhum tenant ativo.</p>
      </CatalogoShell>
    )
  }

  return (
    <CatalogoShell
      title="Catálogo de Treinamentos"
      subtitle="Explore programas em modo vitrine. Sugestões respeitam as categorias que você marcou (ex.: Gestão e Soft Skills são categorias diferentes) e cruzam nível, modalidade e histórico."
    >
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por título, categoria ou objetivo..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-white/10 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-teal-400/50"
            aria-label="Buscar no catálogo"
          />
        </div>
        <Button
          variant="outline"
          asChild
          className="border-[#00C9A7]/45 text-teal-100 bg-[#00C9A7]/12 hover:bg-[#00C9A7]/20 hover:text-white"
        >
          <Link href={`${BASE}/preferencias`}>
            <Sparkles className="w-4 h-4 mr-2" />
            Minhas preferências
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-56 w-full rounded-2xl bg-white/10" />
          <Skeleton className="h-48 w-full bg-white/10" />
        </div>
      ) : itens.length === 0 && globaisFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
          <Library className="w-12 h-12 mx-auto text-[#00C9A7]/85 mb-3" />
          <p className="text-white font-medium">Nenhum treinamento ativo no catálogo</p>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Quando a gestão publicar itens como &quot;ativo&quot;, eles aparecerão aqui.
          </p>
          {(user?.isMaster?.() || user?.isAdmin?.() || user?.hasPermission?.('gerenciar_catalogo')) && (
            <Button className="mt-4 bg-teal-600 hover:bg-teal-500" onClick={() => router.push('/dashboard/gestao/catalogo')}>
              Gerenciar catálogo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {itens.length > 0 && <CatalogoHeroMarquee items={heroItems} basePath={BASE} />}

          {itens.length === 0 && globaisFiltrados.length > 0 && (
            <p className="text-sm text-slate-400 max-w-xl">
              Nenhum treinamento interno ativo no momento. Abaixo, o catálogo global liberado para as suas
              categorias (opt-in do administrador).
            </p>
          )}

          {itens.length > 0 && !preferenciasPreenchidas(prefs) ? (
            <div className="rounded-2xl border border-[#00C9A7]/30 bg-[#00C9A7]/[0.08] backdrop-blur-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00C9A7]" />
                  Sugestões personalizadas
                </h2>
                <p className="text-sm text-slate-400 mt-1 max-w-xl">
                  Preencha suas preferências de aprendizado para ativarmos recomendações baseadas no seu perfil e
                  no histórico de treinamentos que você já realizou na empresa.
                </p>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 shrink-0 text-primary-foreground">
                <Link href={`${BASE}/preferencias`}>Preencher preferências</Link>
              </Button>
            </div>
          ) : itens.length > 0 ? (
            <CatalogoRow
              onDark
              title="Sugeridos para você"
              subtitle="Só aparecem treinamentos das categorias que você marcou; nível, modalidade e histórico refinam a ordem. Gestão e Soft Skills não são a mesma categoria."
            >
              {recomendados.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">
                  Nenhuma sugestão no momento. Ajuste suas preferências ou explore as outras seções.
                </p>
              ) : (
                recomendados.map((item, idx) => (
                  <CatalogoCard key={item.id} item={item} href={`${BASE}/${item.id}`} priority={idx < 4} />
                ))
              )}
            </CatalogoRow>
          ) : null}

          {itens.length > 0 && favoritosItens.length > 0 && (
            <CatalogoRow onDark title="Salvos para depois" subtitle="Treinamentos que você marcou como favoritos.">
              {favoritosItens.map((item, idx) => (
                <CatalogoCard key={item.id} item={item} href={`${BASE}/${item.id}`} priority={idx < 2} />
              ))}
            </CatalogoRow>
          )}

          {itens.length > 0 && popularesSorted.length > 0 && (
            <CatalogoRow
              onDark
              title="Bem avaliados pelo time"
              subtitle="Média das notas internas dos colaboradores."
            >
              {popularesSorted.map((item, idx) => (
                <CatalogoCard key={item.id} item={item} href={`${BASE}/${item.id}`} priority={idx < 2} />
              ))}
            </CatalogoRow>
          )}

          {itens.length > 0 && (
            <CatalogoRow onDark title="Novidades" subtitle="Programas adicionados recentemente.">
              {novidades.map((item, idx) => (
                <CatalogoCard key={item.id} item={item} href={`${BASE}/${item.id}`} priority={idx < 3} />
              ))}
            </CatalogoRow>
          )}

          {itens.length > 0 && curtos.length > 0 && (
            <CatalogoRow onDark title="Até 4 horas" subtitle="Conteúdos mais curtos para encaixar na agenda.">
              {curtos.map((item) => (
                <CatalogoCard key={item.id} item={item} href={`${BASE}/${item.id}`} />
              ))}
            </CatalogoRow>
          )}

          {itens.length > 0 &&
            porCategoria.map(([categoria, lista]) => (
              <CatalogoRow onDark key={categoria} title={categoria}>
                {lista.slice(0, 16).map((item) => (
                  <CatalogoCard key={item.id} item={item} href={`${BASE}/${item.id}`} />
                ))}
              </CatalogoRow>
            ))}

          {globaisFiltrados.length > 0 && (
            <CatalogoRow
              onDark
              title="Catálogo global TrainHub"
              subtitle="Conteúdos aprovados pela TrainHub, nas categorias que o administrador liberou para a vitrine. Detalhes abertos em página própria (sem vínculo com favoritos ou avaliações internas)."
            >
              {globaisFiltrados.map((item, idx) => (
                <CatalogoCard
                  key={`g-${item.id}`}
                  item={item}
                  href={`${BASE}/global/${item.id}`}
                  priority={idx < 2}
                />
              ))}
            </CatalogoRow>
          )}
        </div>
      )}
    </CatalogoShell>
  )
}
