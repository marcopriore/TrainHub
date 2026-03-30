'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CatalogoItem } from '@/lib/catalogo'
import { MODALIDADE_LABEL } from '@/lib/catalogo'
import { cn } from '@/lib/utils'

/** Placeholder quando não há imagem — gradiente na identidade verde/teal TrainHub */
function CoverFallback({ titulo }: { titulo: string }) {
  return (
    <div
      className="absolute inset-0 flex items-end p-3 bg-gradient-to-br from-[#00C9A7]/90 via-emerald-700 to-[#053d32]"
      aria-hidden
    >
      <span className="text-white text-xs font-semibold line-clamp-2 leading-tight">{titulo}</span>
    </div>
  )
}

const heroCardClass = cn(
  'flex-shrink-0 w-[200px] sm:w-[260px] rounded-xl overflow-hidden',
  'border border-white/15 bg-[#0c1816]/95 shadow-lg shadow-black/30',
  'hover:border-[#00C9A7]/55 hover:shadow-[#00C9A7]/10',
  'transition-[transform,box-shadow,border-color] duration-300',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C9A7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#03120e]'
)

function HeroCardLink({ item, basePath }: { item: CatalogoItem; basePath: string }) {
  return (
    <Link href={`${basePath}/${item.id}`} prefetch className={heroCardClass}>
      <div className="relative h-[118px] sm:h-[136px] w-full">
        {item.imagem_url ? (
          <Image
            src={item.imagem_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 200px, 260px"
            unoptimized
          />
        ) : (
          <CoverFallback titulo={item.titulo} />
        )}
        {item.categoria ? (
          <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm border border-white/10">
            {item.categoria}
          </span>
        ) : null}
      </div>
      <div className="p-3 border-t border-white/10 bg-[#070f0d]/90">
        <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">{item.titulo}</p>
        <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-teal-200/70">
          {item.carga_horaria != null ? (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {item.carga_horaria}h
            </span>
          ) : null}
          {item.modalidade ? (
            <span>{MODALIDADE_LABEL[item.modalidade] ?? item.modalidade}</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

/** Fileira duplicada + animação (só quando a lista única é mais larga que o viewport da faixa). */
function MarqueeAnimatedStrip({ items, basePath }: { items: CatalogoItem[]; basePath: string }) {
  if (items.length === 0) return null
  const loop = [...items, ...items]

  return (
    <div className="catalog-marquee-outer w-full py-1">
      <div className="catalog-marquee-track">
        {loop.map((item, idx) => (
          <HeroCardLink key={`${item.id}-${idx}`} item={item} basePath={basePath} />
        ))}
      </div>
    </div>
  )
}

/** Poucos itens ou busca estreita: uma linha estática, sem duplicar. */
function HeroStaticRow({ items, basePath }: { items: CatalogoItem[]; basePath: string }) {
  if (items.length === 0) return null
  return (
    <div className="w-full py-1 flex justify-center overflow-x-auto [scrollbar-width:thin]">
      <div className="flex flex-nowrap items-stretch gap-4 px-4 pb-1">
        {items.map((item) => (
          <HeroCardLink key={item.id} item={item} basePath={basePath} />
        ))}
      </div>
    </div>
  )
}

export function CatalogoHeroMarquee({ items, basePath }: { items: CatalogoItem[]; basePath: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [needsMarquee, setNeedsMarquee] = useState(false)

  const recompute = useCallback(() => {
    const c = containerRef.current
    const m = measureRef.current
    if (!c || !m || items.length === 0) {
      setNeedsMarquee(false)
      return
    }
    const containerW = c.getBoundingClientRect().width
    const trackW = m.getBoundingClientRect().width
    /* Só animar quando a fileira realmente extrapola a área visível (evita repetir 1 card 10×). */
    setNeedsMarquee(trackW > containerW + 2)
  }, [items])

  useLayoutEffect(() => {
    recompute()
    const c = containerRef.current
    const m = measureRef.current
    if (!c || !m) return

    const ro = new ResizeObserver(() => recompute())
    ro.observe(c)
    ro.observe(m)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [recompute, items])

  if (items.length === 0) return null

  return (
    <section
      className="relative w-screen max-w-[100vw] left-1/2 -translate-x-1/2 overflow-hidden"
      aria-label={needsMarquee ? 'Destaques em movimento horizontal' : 'Destaques do catálogo'}
    >
      <div className="border-y border-white/10 bg-[#061210]/85 backdrop-blur-md shadow-inner shadow-black/20">
        <div className="absolute inset-0 bg-gradient-to-r from-[#00C9A7]/[0.06] via-transparent to-emerald-600/[0.05] pointer-events-none" />
        <div className="relative z-10 py-4">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-teal-200/80 px-4 mb-3 max-w-7xl mx-auto">
            {needsMarquee
              ? 'Em destaque — faixa horizontal · passe o mouse para pausar'
              : 'Em destaque'}
          </p>

          <div ref={containerRef} className="relative w-full min-w-0">
            {/* Largura = mesmos breakpoints dos cards; sem imagens nem Links (evita fetch duplicado). */}
            <div
              ref={measureRef}
              className="fixed left-[-9999px] top-0 flex flex-nowrap gap-4 w-max opacity-0 pointer-events-none -z-50"
              aria-hidden
            >
              {items.map((item) => (
                <div
                  key={`measure-${item.id}`}
                  className="flex-shrink-0 w-[200px] sm:w-[260px] h-px border-0"
                />
              ))}
            </div>

            {needsMarquee ? (
              <MarqueeAnimatedStrip items={items} basePath={basePath} />
            ) : (
              <HeroStaticRow items={items} basePath={basePath} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
