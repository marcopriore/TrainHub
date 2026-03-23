'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface RecentActivityItem {
  id: string
  tipo: string
  nome: string
  empresa: string
  cargaHoraria: number
  data: string
  indiceSatisfacao: number | null
}

const tipoConfig: Record<string, string> = {
  parceiro: 'bg-blue-500/10 text-blue-600',
  colaborador: 'bg-[#00C9A7]/10 text-[#00C9A7]',
}

const tipoLabel: Record<string, string> = {
  parceiro: 'Parceiro',
  colaborador: 'Colaborador',
}

export function RecentActivityTable({
  data,
  loading,
}: {
  data: RecentActivityItem[]
  loading: boolean
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-serif text-base font-semibold text-foreground">
          Atividade Recente
        </h3>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 px-5 text-center text-muted-foreground text-sm">
            Nenhum treinamento registrado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Tipo
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Nome do Treinamento
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Empresa Parceira
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Carga Horária
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Data
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Satisfação
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-muted/30 transition-colors',
                    i === data.length - 1 && 'border-b-0'
                  )}
                >
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        tipoConfig[item.tipo] ?? tipoConfig.parceiro
                      )}
                    >
                      {tipoLabel[item.tipo] ?? item.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-foreground max-w-48 truncate">
                    {item.nome}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {item.empresa}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {item.cargaHoraria}h
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                    {new Date(item.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3.5">
                    {item.indiceSatisfacao != null ? (
                      <span className="text-amber-600 font-medium">
                        {item.indiceSatisfacao}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
