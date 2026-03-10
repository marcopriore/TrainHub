'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'

const satisfacaoData = [
  { empresa: 'Accenture', satisfacao: 92, aprovacao: 88 },
  { empresa: 'IBM', satisfacao: 88, aprovacao: 85 },
  { empresa: 'AWS', satisfacao: 93, aprovacao: 87 },
  { empresa: 'ESPM', satisfacao: 97, aprovacao: 91 },
  { empresa: 'Sebrae', satisfacao: 89, aprovacao: 86 },
  { empresa: 'Bureau Veritas', satisfacao: 84, aprovacao: 82 },
]

const evolucaoData = [
  { mes: 'Jan', horasTotal: 320 },
  { mes: 'Fev', horasTotal: 415 },
  { mes: 'Mar', horasTotal: 560 },
  { mes: 'Abr', horasTotal: 370 },
  { mes: 'Mai', horasTotal: 570 },
  { mes: 'Jun', horasTotal: 625 },
  { mes: 'Jul', horasTotal: 520 },
  { mes: 'Ago', horasTotal: 690 },
  { mes: 'Set', horasTotal: 700 },
  { mes: 'Out', horasTotal: 590 },
  { mes: 'Nov', horasTotal: 490 },
  { mes: 'Dez', horasTotal: 390 },
]

const radarData = [
  { subject: 'TI', A: 850 },
  { subject: 'RH', A: 620 },
  { subject: 'Financeiro', A: 540 },
  { subject: 'Operações', A: 980 },
  { subject: 'Comercial', A: 440 },
  { subject: 'Outro', A: 150 },
]

const summaryCards = [
  { label: 'Total de Treinamentos', value: '48', color: 'text-[#00C9A7]' },
  { label: 'Horas Totais', value: '4.820', color: 'text-blue-500' },
  { label: 'Satisfação Média', value: '90,7%', color: 'text-amber-500' },
  { label: 'Aprovação Média', value: '87,1%', color: 'text-green-500' },
]

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">Análise consolidada de todos os treinamentos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border p-4 shadow-sm text-center">
            <p className={`font-serif text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-muted-foreground text-xs mt-1 text-balance leading-relaxed">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Evolução Mensal */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="font-serif text-base font-semibold text-foreground mb-4">
          Evolução Mensal de Horas de Treinamento
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={evolucaoData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="horasTotal" stroke="#00C9A7" strokeWidth={2.5} dot={{ r: 4, fill: '#00C9A7' }} name="Horas Totais" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Satisfação & Aprovação por Empresa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">
            Satisfação e Aprovação por Empresa
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={satisfacaoData} barSize={10} barGap={2} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[70, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="empresa" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="satisfacao" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Satisfação %" />
              <Bar dataKey="aprovacao" fill="#22c55e" radius={[0, 4, 4, 0]} name="Aprovação %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Horas por Setor (Radar) */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-serif text-base font-semibold text-foreground mb-4">
            Horas de Treinamento por Setor
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Radar name="Horas" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v} horas`, '']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
