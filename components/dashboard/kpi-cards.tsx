'use client'

import { Handshake, Users, Star, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: 'teal' | 'blue' | 'amber' | 'green'
  isPercent?: boolean
  progress?: number
}

const colorMap = {
  teal: {
    bg: 'bg-[#00C9A7]/10',
    icon: 'text-[#00C9A7]',
    ring: 'stroke-[#00C9A7]',
    text: 'text-[#00C9A7]',
  },
  blue: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-500',
    ring: 'stroke-blue-500',
    text: 'text-blue-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    icon: 'text-amber-500',
    ring: 'stroke-amber-500',
    text: 'text-amber-500',
  },
  green: {
    bg: 'bg-green-500/10',
    icon: 'text-green-500',
    ring: 'stroke-green-500',
    text: 'text-green-500',
  },
}

function ProgressRing({ value, color }: { value: number; color: 'teal' | 'blue' | 'amber' | 'green' }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (value / 100) * circumference

  return (
    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="4"
        className="opacity-10 stroke-foreground" />
      <circle
        cx="32" cy="32" r={radius} fill="none" strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        className={cn('transition-all duration-700', colorMap[color].ring)}
      />
    </svg>
  )
}

export function KpiCard({ title, value, subtitle, icon, color, isPercent, progress }: KpiCardProps) {
  const colors = colorMap[color]

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', colors.bg)}>
        <span className={colors.icon}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide truncate">{title}</p>
        <p className={cn('font-serif text-2xl font-bold mt-0.5', colors.text)}>
          {value}{isPercent ? '%' : ''}
        </p>
        {subtitle && <p className="text-muted-foreground text-xs mt-0.5">{subtitle}</p>}
      </div>
      {isPercent && progress !== undefined && (
        <div className="relative flex-shrink-0">
          <ProgressRing value={progress} color={color} />
          <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-bold', colors.text)}>
            {progress}%
          </span>
        </div>
      )}
    </div>
  )
}

export interface KpiData {
  totalHorasParceiros: number
  totalHorasColaboradores: number
  indiceSatisfacao: number | null
  indiceAprovacao: number | null
}

export function KpiCards({
  data,
  loading,
}: {
  data: KpiData | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const satisfacao = data?.indiceSatisfacao ?? 0
  const aprovacao = data?.indiceAprovacao ?? 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        title="Total de Horas — Parceiros"
        value={data?.totalHorasParceiros?.toLocaleString('pt-BR') ?? '0'}
        subtitle="horas"
        icon={<Handshake className="w-6 h-6" />}
        color="blue"
      />
      <KpiCard
        title="Total de Horas — Colaboradores"
        value={data?.totalHorasColaboradores?.toLocaleString('pt-BR') ?? '0'}
        subtitle="horas"
        icon={<Users className="w-6 h-6" />}
        color="teal"
      />
      <KpiCard
        title="Índice de Satisfação"
        value={satisfacao > 0 ? satisfacao.toFixed(1) : '—'}
        icon={<Star className="w-6 h-6" />}
        color="amber"
        isPercent
        progress={satisfacao}
      />
      <KpiCard
        title="Índice de Aprovação"
        value={aprovacao > 0 ? aprovacao.toFixed(1) : '—'}
        subtitle="média das provas"
        icon={<CheckCircle className="w-6 h-6" />}
        color="green"
        isPercent
        progress={aprovacao}
      />
    </div>
  )
}
