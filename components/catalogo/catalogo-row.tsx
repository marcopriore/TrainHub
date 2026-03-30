'use client'

import { cn } from '@/lib/utils'

export function CatalogoRow({
  title,
  subtitle,
  children,
  className,
  onDark,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  /** Títulos claros sobre fundo escuro do catálogo. */
  onDark?: boolean
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="px-0">
        <h2
          className={cn(
            'text-lg font-semibold tracking-tight',
            onDark ? 'text-white' : 'text-foreground'
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={cn(
              'text-sm mt-0.5',
              onDark ? 'text-slate-400' : 'text-muted-foreground'
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <div
        className={cn(
          'flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory',
          '[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full',
          onDark
            ? '[&::-webkit-scrollbar-thumb]:bg-white/20'
            : '[&::-webkit-scrollbar-thumb]:bg-border',
          '-mx-4 px-4 sm:mx-0 sm:px-0'
        )}
      >
        {children}
      </div>
    </section>
  )
}
