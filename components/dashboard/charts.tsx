'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

// Parceiro = azul, Colaborador = teal
const COR_PARCEIRO = '#3b82f6'
const COR_COLABORADOR = '#00C9A7'

export interface MonthlyBarData {
  mes: string
  Parceiro: number
  Colaborador: number
}

export interface DonutDataItem {
  name: string
  value: number
}

export function TrainingBarChart({
  data,
  loading,
}: {
  data: MonthlyBarData[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-serif text-base font-semibold text-foreground mb-4">
          Horas de Treinamento por Mês
        </h3>
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </div>
    )
  }

  const hasData = data.length > 0

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <h3 className="font-serif text-base font-semibold text-foreground mb-4">
        Horas de Treinamento por Mês
      </h3>
      {!hasData ? (
        <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
          Nenhum dado para exibir
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barSize={10} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 12,
              }}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Parceiro" fill={COR_PARCEIRO} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Colaborador" fill={COR_COLABORADOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function TrainingDonutChart({
  data,
  loading,
}: {
  data: DonutDataItem[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col">
        <h3 className="font-serif text-base font-semibold text-foreground mb-4">
          Distribuição por Tipo
        </h3>
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    )
  }

  const hasData = data.length > 0
  const colorMap: Record<string, string> = {
    Parceiro: COR_PARCEIRO,
    Colaborador: COR_COLABORADOR,
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col">
      <h3 className="font-serif text-base font-semibold text-foreground mb-4">
        Distribuição por Tipo
      </h3>
      <div className="flex-1 flex flex-col items-center justify-center">
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum dado para exibir
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={colorMap[entry.name] ?? `hsl(var(--muted-foreground))`}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} treinamentos`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-2">
              {data.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: colorMap[entry.name] ?? 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {entry.name}:{' '}
                    <strong className="text-foreground">{entry.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
