'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Clock, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CatalogoItem } from '@/lib/catalogo'
import { MODALIDADE_LABEL, NIVEL_LABEL } from '@/lib/catalogo'

const COR = '#00C9A7'

export function CatalogoCard({
  item,
  href,
  className,
  priority,
}: {
  item: CatalogoItem
  href: string
  className?: string
  priority?: boolean
}) {
  const ch = item.carga_horaria != null ? `${item.carga_horaria}h` : null
  const nivel = item.nivel ? NIVEL_LABEL[item.nivel] ?? item.nivel : null

  return (
    <Link
      href={href}
      prefetch
      className={cn(
        'group flex-shrink-0 snap-start w-[160px] sm:w-[200px] rounded-xl border border-border bg-card overflow-hidden shadow-sm',
        'hover:shadow-lg hover:border-[color-mix(in_srgb,var(--cor)_40%,transparent)] transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
      style={
        {
          '--cor': COR,
        } as React.CSSProperties
      }
    >
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {item.imagem_url ? (
          <Image
            src={item.imagem_url}
            alt={item.titulo}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 160px, 200px"
            priority={priority}
            unoptimized
          />
        ) : (
          <div
            className="absolute inset-0 flex items-end p-3 bg-gradient-to-br from-[#00C9A7] via-emerald-700 to-[#053d32]"
            aria-hidden
          >
            <span className="text-white text-sm font-semibold line-clamp-3 leading-tight drop-shadow-md">
              {item.titulo}
            </span>
          </div>
        )}
        {item.categoria ? (
          <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/55 text-white backdrop-blur-sm">
            {item.categoria}
          </span>
        ) : null}
      </div>
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          {item.titulo}
        </h3>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {ch ? (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {ch}
            </span>
          ) : null}
          {item.modalidade ? (
            <span>{MODALIDADE_LABEL[item.modalidade] ?? item.modalidade}</span>
          ) : null}
          {nivel ? (
            <span className="inline-flex items-center gap-0.5">
              <Layers className="w-3 h-3" />
              {nivel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
