'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye,
  Trash2,
  Pencil,
  Star,
  Calendar,
  Clock,
  Users,
  Building2,
  PlusCircle,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'

interface Treinamento {
  id: string
  codigo: string
  tipo: string
  nome: string
  conteudo: string | null
  objetivo: string | null
  carga_horaria: number
  empresa_parceira_id: string | null
  quantidade_pessoas: number | null
  data_treinamento: string
  indice_satisfacao: number | null
  criado_em: string
  tenant_id: string | null
  empresas_parceiras: { nome: string } | null
}

interface EmpresaParceira {
  id: string
  nome: string
}

interface ColaboradorComSetor {
  id: string
  nome: string
  colaboradores: { nome: string; setores: { nome: string } | null } | null
}

type AvaliacaoTokenRow = {
  id: string
  respondente_nome: string | null
  respondente_email: string
  respondente_tipo: string
  usado: boolean
  nota: number | null
  aprovado: boolean | null
  respondido_em: string | null
  token: string
}

type RespostaDetalhe = {
  pergunta_texto: string
  tipo: string
  opcao_selecionada: string | null
  resposta_correta: string | null
}

const tipoConfig: Record<string, string> = {
  parceiro: 'bg-blue-500/10 text-blue-600',
  colaborador: 'bg-[#00C9A7]/10 text-[#00C9A7]',
}

const tipoLabel: Record<string, string> = {
  parceiro: 'Parceiro',
  colaborador: 'Colaborador',
}

function getIndicadorColor(valor: number | null) {
  if (valor == null) return 'bg-muted text-muted-foreground border-border'
  if (valor < 60) return 'bg-red-500/10 text-red-600 border-red-500/30'
  if (valor < 80) return 'bg-amber-500/10 text-amber-600 border-amber-500/30'
  return 'bg-green-500/10 text-green-600 border-green-500/30'
}

function getInicial(nome: string) {
  const partes = nome.trim().split(/\s+/)
  if (partes.length >= 2) {
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  }
  return nome.slice(0, 2).toUpperCase()
}

// ---------- Edit Form Schema ----------
const editBaseSchema = z.object({
  tipo: z.enum(['parceiro', 'colaborador']),
  nome: z.string().min(1, 'Informe o nome do treinamento'),
  conteudo: z.string().optional().default(''),
  objetivo: z.string().optional().default(''),
  cargaHoraria: z.coerce.number().min(0.1, 'Informe a carga horária'),
  empresaParceiraId: z.string().min(1, 'Selecione a empresa parceira'),
  dataTreinamento: z.string().min(1, 'Selecione a data do treinamento'),
  indiceSatisfacao: z.coerce
    .number()
    .min(0, 'Valor entre 0 e 100')
    .max(100, 'Valor entre 0 e 100'),
  quantidadePessoas: z.coerce.number().optional(),
  colaboradores: z
    .array(z.object({ colaboradorId: z.string().min(1, 'Selecione o colaborador') }))
    .optional(),
})

type EditFormData = z.infer<typeof editBaseSchema>

interface ColaboradorWithSetorEdit {
  id: string
  nome: string
  setor_id: string | null
  setores: { nome: string } | null
}

// ---------- Form Field Helper ----------
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="text-destructive text-xs mt-1">{message}</span>
}

function FormFieldEdit({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

// ---------- Edit Form Component ----------
function EditTreinamentoForm({
  treinamento,
  empresas,
  colaboradoresList,
  colaboradoresVinculados,
  onSuccess,
}: {
  treinamento: Treinamento
  empresas: EmpresaParceira[]
  colaboradoresList: ColaboradorWithSetorEdit[]
  colaboradoresVinculados: string[]
  onSuccess: () => void
}) {
  const supabase = createClient()

  const defaultColaboradores =
    treinamento.tipo === 'colaborador' && colaboradoresVinculados.length > 0
      ? colaboradoresVinculados.map((id) => ({ colaboradorId: id }))
      : [{ colaboradorId: '' }]

  const [salvando, setSalvando] = useState(false)
  const { register, control, setValue, getValues, setError, clearErrors, formState: { errors } } =
    useForm<EditFormData>({
      mode: 'onChange',
      defaultValues: {
        tipo: treinamento.tipo as 'parceiro' | 'colaborador',
        nome: treinamento.nome ?? '',
        conteudo: treinamento.conteudo ?? '',
        objetivo: treinamento.objetivo ?? '',
        cargaHoraria: treinamento.carga_horaria,
        empresaParceiraId: treinamento.empresa_parceira_id ?? '',
        dataTreinamento: treinamento.data_treinamento,
        indiceSatisfacao: treinamento.indice_satisfacao ?? 0,
        quantidadePessoas: treinamento.quantidade_pessoas ?? undefined,
        colaboradores: defaultColaboradores,
      },
    })

  const tipo = useWatch({ control, name: 'tipo', defaultValue: treinamento.tipo as 'parceiro' | 'colaborador' })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'colaboradores' })

  const handleTipoChange = (value: 'parceiro' | 'colaborador') => {
    setValue('tipo', value)
    if (value === 'parceiro') {
      replace([])
      setValue('quantidadePessoas', treinamento.tipo === 'parceiro' ? (treinamento.quantidade_pessoas ?? 1) : 1)
    } else {
      setValue('quantidadePessoas', undefined as never)
      const def =
        treinamento.tipo === 'colaborador' && colaboradoresVinculados.length > 0
          ? colaboradoresVinculados.map((id) => ({ colaboradorId: id }))
          : [{ colaboradorId: '' }]
      replace(def)
    }
  }

  const formatColaboradorLabel = (c: ColaboradorWithSetorEdit) => {
    const setor = c.setores?.nome ?? 'Sem setor'
    return `${c.nome} (${setor})`
  }

  const handleSalvar = async () => {
    clearErrors()
    const values = getValues()

    let hasError = false

    if (!values.nome?.trim()) {
      setError('nome', { message: 'Informe o nome do treinamento' })
      hasError = true
    }
    if (!values.empresaParceiraId?.trim()) {
      setError('empresaParceiraId', { message: 'Selecione a empresa parceira' })
      hasError = true
    }
    if (!values.dataTreinamento?.trim()) {
      setError('dataTreinamento', { message: 'Selecione a data do treinamento' })
      hasError = true
    }

    const cargaHoraria = Number(values.cargaHoraria)
    if (isNaN(cargaHoraria) || cargaHoraria < 0.1) {
      setError('cargaHoraria', { message: 'Informe a carga horária' })
      hasError = true
    }

    const indiceSatisfacao = Number(values.indiceSatisfacao)
    if (isNaN(indiceSatisfacao) || indiceSatisfacao < 0 || indiceSatisfacao > 100) {
      setError('indiceSatisfacao', { message: 'Valor entre 0 e 100' })
      hasError = true
    }

    if (values.tipo === 'parceiro') {
      const qtd = Number(values.quantidadePessoas)
      if (isNaN(qtd) || qtd < 1) {
        setError('quantidadePessoas', { message: 'Informe a quantidade de pessoas' })
        hasError = true
      }
    }

    let colaboradoresIds: string[] = []
    if (values.tipo === 'colaborador') {
      colaboradoresIds = fields
        .map((_, idx) => getValues(`colaboradores.${idx}.colaboradorId`))
        .filter((id): id is string => !!id?.trim())
      if (colaboradoresIds.length < 1) {
        setError('colaboradores', { message: 'Adicione ao menos um colaborador' })
        hasError = true
      }
    }

    if (hasError) return

    setSalvando(true)
    try {
      const updatePayload: Record<string, unknown> = {
        tipo: values.tipo,
        nome: values.nome?.trim() ?? '',
        conteudo: values.conteudo ?? '',
        objetivo: values.objetivo ?? '',
        carga_horaria: cargaHoraria,
        empresa_parceira_id: values.empresaParceiraId,
        data_treinamento: values.dataTreinamento,
        indice_satisfacao: indiceSatisfacao,
      }
      if (values.tipo === 'parceiro') {
        updatePayload.quantidade_pessoas = Math.max(1, Number(values.quantidadePessoas) || 1)
      } else {
        updatePayload.quantidade_pessoas = null
      }

      const { error: updErr } = await supabase
        .from('treinamentos')
        .update(updatePayload)
        .eq('id', treinamento.id)
      if (updErr) throw updErr

      const { error: delErr } = await supabase
        .from('treinamento_colaboradores')
        .delete()
        .eq('treinamento_id', treinamento.id)
      if (delErr) throw delErr

      if (values.tipo === 'colaborador' && colaboradoresIds.length > 0) {
        const tenantId = treinamento.tenant_id
        if (!tenantId) {
          toast.error('Tenant não identificado neste treinamento.')
          return
        }
        const rows = colaboradoresIds.map((colaborador_id) => ({
          treinamento_id: treinamento.id,
          colaborador_id,
          tenant_id: tenantId,
        }))
        const { error: insErr } = await supabase
          .from('treinamento_colaboradores')
          .insert(rows)
        if (insErr) throw insErr
      }

      onSuccess()
    } catch (error) {
      console.error('Erro ao atualizar treinamento:', error)
      toast.error('Não foi possível atualizar o treinamento. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-5">
      <FormFieldEdit label="Tipo" error={errors.tipo?.message}>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => handleTipoChange(v as 'parceiro' | 'colaborador')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parceiro">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Parceiro
                  </span>
                </SelectItem>
                <SelectItem value="colaborador">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Colaborador
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldEdit>

      <FormFieldEdit label="Nome do Treinamento" error={errors.nome?.message}>
        <Input placeholder="Ex.: Gestão de Projetos Ágeis" {...register('nome')} />
      </FormFieldEdit>

      <FormFieldEdit label="Conteúdo Programático" error={errors.conteudo?.message}>
        <Controller
          control={control}
          name="conteudo"
          render={({ field }) => (
            <Textarea
              placeholder="Descreva os temas..."
              className="min-h-[80px] resize-y"
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormFieldEdit>

      <FormFieldEdit label="Objetivo" error={errors.objetivo?.message}>
        <Controller
          control={control}
          name="objetivo"
          render={({ field }) => (
            <Textarea
              placeholder="Qual o objetivo?"
              className="min-h-[80px] resize-y"
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormFieldEdit>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormFieldEdit label="Carga Horária (horas)" error={errors.cargaHoraria?.message}>
          <div className="relative">
            <Input type="number" min={0} step={0.5} className="pr-14" {...register('cargaHoraria')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">horas</span>
          </div>
        </FormFieldEdit>
        <FormFieldEdit label="Empresa Parceira" error={errors.empresaParceiraId?.message}>
          <Controller
            control={control}
            name="empresaParceiraId"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormFieldEdit>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {tipo === 'parceiro' && (
          <FormFieldEdit label="Quantidade de Pessoas" error={errors.quantidadePessoas?.message}>
            <Input type="number" min={1} {...register('quantidadePessoas')} />
          </FormFieldEdit>
        )}
        <FormFieldEdit label="Data do Treinamento" error={errors.dataTreinamento?.message}>
          <Input type="date" {...register('dataTreinamento')} />
        </FormFieldEdit>
      </div>

      <FormFieldEdit label="Índice de Satisfação %" error={errors.indiceSatisfacao?.message}>
        <div className="relative">
          <Input type="number" min={0} max={100} className="pr-8 w-full max-w-[160px]" {...register('indiceSatisfacao')} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
        </div>
      </FormFieldEdit>

      {tipo === 'colaborador' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Colaboradores</Label>
            {errors.colaboradores && (
              <FieldError message={typeof errors.colaboradores === 'string' ? errors.colaboradores : (errors.colaboradores as { message?: string }).message} />
            )}
          </div>
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex gap-2 items-center">
                <Controller
                  control={control}
                  name={`colaboradores.${idx}.colaboradorId`}
                  render={({ field: f }) => (
                    <Select value={f.value || undefined} onValueChange={f.onChange}>
                      <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                      <SelectContent>
                        {colaboradoresList.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{formatColaboradorLabel(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} aria-label="Remover">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => append({ colaboradorId: '' })}>
              <PlusCircle className="w-4 h-4" />
              Adicionar Colaborador
            </Button>
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={handleSalvar}
        disabled={salvando}
        className="w-full h-11 bg-primary hover:bg-primary/90"
      >
        {salvando ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

export default function HistoricoPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canView = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('visualizar_historico')
  const canEdit = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('editar_treinamento')
  const canDelete = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('excluir_treinamento')
  const canExportExcel = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('exportar_excel')

  const ITENS_POR_PAGINA = 20
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [exportando, setExportando] = useState(false)
  const activeTenantId = getActiveTenantId()
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([])
  const [empresas, setEmpresas] = useState<EmpresaParceira[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedTreinamento, setSelectedTreinamento] = useState<Treinamento | null>(null)
  const [colaboradoresDetalhe, setColaboradoresDetalhe] = useState<ColaboradorComSetor[]>([])
  const [loadingColaboradores, setLoadingColaboradores] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [treinamentoToDelete, setTreinamentoToDelete] = useState<Treinamento | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editingTreinamento, setEditingTreinamento] = useState<Treinamento | null>(null)
  const [colaboradoresList, setColaboradoresList] = useState<ColaboradorWithSetorEdit[]>([])
  const [colaboradoresVinculados, setColaboradoresVinculados] = useState<string[]>([])

  const [participantesDialogOpen, setParticipantesDialogOpen] = useState(false)
  const [treinamentoSelecionado, setTreinamentoSelecionado] = useState<Treinamento | null>(null)
  const [participantes, setParticipantes] = useState<{ nome: string; email: string }[]>([])
  const [loadingParticipantes, setLoadingParticipantes] = useState(false)
  const [buscaParticipante, setBuscaParticipante] = useState('')

  const [filtroParticipante, setFiltroParticipante] = useState('')
  const [debouncedFiltroParticipante, setDebouncedFiltroParticipante] = useState('')
  const [idsPorParticipante, setIdsPorParticipante] = useState<string[] | null>(null)

  const [avaliacaoDialogOpen, setAvaliacaoDialogOpen] = useState(false)
  const [treinamentoAvaliacao, setTreinamentoAvaliacao] = useState<Treinamento | null>(null)
  const [avaliacaoTokens, setAvaliacaoTokens] = useState<AvaliacaoTokenRow[]>([])
  const [avaliacaoSemFormulario, setAvaliacaoSemFormulario] = useState(false)
  const [loadingAvaliacao, setLoadingAvaliacao] = useState(false)
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null)
  const [respostasPorToken, setRespostasPorToken] = useState<Map<string, RespostaDetalhe[]>>(new Map())
  const [mediasPorTreinamento, setMediasPorTreinamento] = useState<Map<string, number>>(new Map())
  const [treinamentosComAvaliacao, setTreinamentosComAvaliacao] = useState<Set<string>>(new Set())
  const [notaMinimaPorTreinamento, setNotaMinimaPorTreinamento] = useState<Map<string, number>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedFiltroParticipante(filtroParticipante)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filtroParticipante])

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard/gestao')
  }, [user, canView, router])

  const fetchTreinamentos = async (silent = false) => {
    if (!activeTenantId) {
      setTreinamentos([])
      setTotalRegistros(0)
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      const participanteIds = idsPorParticipante

      const selectCols = `
        id,
        codigo,
        tipo,
        nome,
        conteudo,
        objetivo,
        carga_horaria,
        empresa_parceira_id,
        quantidade_pessoas,
        data_treinamento,
        indice_satisfacao,
        criado_em,
        tenant_id,
        empresas_parceiras(nome)
      `

      if (user?.isMaster() || user?.isAdmin?.()) {
        let query = supabase
          .from('treinamentos')
          .select(selectCols, { count: 'exact' })
          .eq('tenant_id', activeTenantId)
        if (participanteIds !== null) {
          query = query.in('id', participanteIds.length > 0 ? participanteIds : ['__empty__'])
        }
        if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo)
        if (filtroEmpresa !== 'todas') query = query.eq('empresa_parceira_id', filtroEmpresa)
        if (filtroDataInicio) query = query.gte('data_treinamento', filtroDataInicio)
        if (filtroDataFim) query = query.lte('data_treinamento', filtroDataFim)
        const from = (paginaAtual - 1) * ITENS_POR_PAGINA
        const to = paginaAtual * ITENS_POR_PAGINA - 1
        const { data, error, count } = await query
          .order('codigo', { ascending: false })
          .range(from, to)
        if (error) throw error
        const treinamentosData = (data as unknown as Treinamento[]) ?? []
        setTreinamentos(treinamentosData)
        setTotalRegistros(count ?? 0)

        const treinamentoIds = treinamentosData.map((t) => t.id)
        if (treinamentoIds.length > 0) {
          const { data: mediasAvaliacao } = await supabase
            .from('avaliacao_tokens')
            .select('treinamento_id, nota')
            .eq('tenant_id', activeTenantId)
            .eq('usado', true)
            .in('treinamento_id', treinamentoIds)
            .not('nota', 'is', null)

          const { data: avaliacoesVinculadas } = await supabase
            .from('avaliacao_formularios')
            .select('treinamento_id, nota_minima')
            .eq('tenant_id', activeTenantId)
            .in('treinamento_id', treinamentoIds)

          const mediasMap = new Map<string, number>()
          if (mediasAvaliacao) {
            const grupos = new Map<string, number[]>()
            for (const row of mediasAvaliacao as { treinamento_id: string; nota: number }[]) {
              if (!grupos.has(row.treinamento_id)) grupos.set(row.treinamento_id, [])
              grupos.get(row.treinamento_id)!.push(row.nota)
            }
            for (const [id, notas] of grupos) {
              const media = notas.reduce((a, b) => a + b, 0) / notas.length
              mediasMap.set(id, Math.round(media))
            }
          }
          setMediasPorTreinamento(mediasMap)

          const comAvaliacao = new Set(
            (avaliacoesVinculadas as { treinamento_id: string }[] | null)?.map((a) => a.treinamento_id) ?? []
          )
          setTreinamentosComAvaliacao(comAvaliacao)

          const notaMinimaMap = new Map<string, number>()
          ;(avaliacoesVinculadas as { treinamento_id: string; nota_minima: number }[] | null)?.forEach((a) => {
            notaMinimaMap.set(a.treinamento_id, a.nota_minima ?? 70)
          })
          setNotaMinimaPorTreinamento(notaMinimaMap)
        } else {
          setMediasPorTreinamento(new Map())
          setTreinamentosComAvaliacao(new Set())
          setNotaMinimaPorTreinamento(new Map())
        }
        return
      }

      const userEmail = user?.email
      if (!userEmail) {
        setTreinamentos([])
        setLoading(false)
        return
      }

      const { data: colData, error: colError } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('tenant_id', activeTenantId)
        .eq('email', userEmail)
        .maybeSingle()

      if (!colData) {
        setTreinamentos([])
        setLoading(false)
        return
      }

      if (colError) {
        throw colError
      }

      const colaboradorId = (colData as { id: string }).id
      const { data: tcData, error: tcError } = await supabase
        .from('treinamento_colaboradores')
        .select('treinamento_id')
        .eq('colaborador_id', colaboradorId)
      if (tcError) throw tcError
      let ids = (tcData ?? []).map((r: { treinamento_id: string }) => r.treinamento_id)
      if (participanteIds !== null) {
        ids = ids.filter((id) => participanteIds.includes(id))
      }
      if (ids.length === 0) {
        setTreinamentos([])
        setTotalRegistros(0)
        setLoading(false)
        return
      }

      let query = supabase
        .from('treinamentos')
        .select(selectCols, { count: 'exact' })
        .in('id', ids)
      if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo)
      if (filtroEmpresa !== 'todas') query = query.eq('empresa_parceira_id', filtroEmpresa)
      if (filtroDataInicio) query = query.gte('data_treinamento', filtroDataInicio)
      if (filtroDataFim) query = query.lte('data_treinamento', filtroDataFim)
      const from = (paginaAtual - 1) * ITENS_POR_PAGINA
      const to = paginaAtual * ITENS_POR_PAGINA - 1
      const { data, error, count } = await query
        .order('codigo', { ascending: false })
        .range(from, to)
      if (error) throw error
      const treinamentosData = (data as unknown as Treinamento[]) ?? []
      setTreinamentos(treinamentosData)
      setTotalRegistros(count ?? 0)

      const treinamentoIds = treinamentosData.map((t) => t.id)
      if (treinamentoIds.length > 0) {
        const { data: mediasAvaliacao } = await supabase
          .from('avaliacao_tokens')
          .select('treinamento_id, nota')
          .eq('tenant_id', activeTenantId)
          .eq('usado', true)
          .in('treinamento_id', treinamentoIds)
          .not('nota', 'is', null)

        const { data: avaliacoesVinculadas } = await supabase
          .from('avaliacao_formularios')
          .select('treinamento_id, nota_minima')
          .eq('tenant_id', activeTenantId)
          .in('treinamento_id', treinamentoIds)

        const mediasMap = new Map<string, number>()
        if (mediasAvaliacao) {
          const grupos = new Map<string, number[]>()
          for (const row of mediasAvaliacao as { treinamento_id: string; nota: number }[]) {
            if (!grupos.has(row.treinamento_id)) grupos.set(row.treinamento_id, [])
            grupos.get(row.treinamento_id)!.push(row.nota)
          }
          for (const [id, notas] of grupos) {
            const media = notas.reduce((a, b) => a + b, 0) / notas.length
            mediasMap.set(id, Math.round(media))
          }
        }
        setMediasPorTreinamento(mediasMap)

        const comAvaliacao = new Set(
          (avaliacoesVinculadas as { treinamento_id: string }[] | null)?.map((a) => a.treinamento_id) ?? []
        )
        setTreinamentosComAvaliacao(comAvaliacao)

        const notaMinimaMap = new Map<string, number>()
        ;(avaliacoesVinculadas as { treinamento_id: string; nota_minima: number }[] | null)?.forEach((a) => {
          notaMinimaMap.set(a.treinamento_id, a.nota_minima ?? 70)
        })
        setNotaMinimaPorTreinamento(notaMinimaMap)
      } else {
        setMediasPorTreinamento(new Map())
        setTreinamentosComAvaliacao(new Set())
        setNotaMinimaPorTreinamento(new Map())
      }
    } catch (error) {
      console.error('Erro ao carregar treinamentos:', error)
      toast.error('Não foi possível carregar os treinamentos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmpresas = async () => {
    if (!activeTenantId) {
      setEmpresas([])
      return
    }
    try {
      const { data, error } = await supabase
        .from('empresas_parceiras')
        .select('id, nome')
        .eq('tenant_id', activeTenantId)
        .order('nome', { ascending: true })

      if (error) throw error
      setEmpresas(data ?? [])
    } catch (error) {
      console.error('Erro ao carregar empresas:', error)
    }
  }

  const buscarTreinamentosPorParticipante = async (texto: string): Promise<string[] | null> => {
    if (!texto || texto.length < 2 || !activeTenantId) return null
    try {
      const { data: parceiros } = await supabase
        .from('treinamento_parceiros')
        .select('treinamento_id')
        .eq('tenant_id', activeTenantId)
        .or(`nome.ilike.%${texto}%,email.ilike.%${texto}%`)

      const { data: colaboradoresMatch } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('tenant_id', activeTenantId)
        .or(`nome.ilike.%${texto}%,email.ilike.%${texto}%`)

      const colaboradorIds = colaboradoresMatch?.map((c) => c.id) ?? []
      let treinamentoIdsColaborador: string[] = []
      if (colaboradorIds.length > 0) {
        const { data: tc } = await supabase
          .from('treinamento_colaboradores')
          .select('treinamento_id')
          .eq('tenant_id', activeTenantId)
          .in('colaborador_id', colaboradorIds)
        treinamentoIdsColaborador = tc?.map((t) => t.treinamento_id) ?? []
      }

      const todosIds = [
        ...(parceiros?.map((p) => p.treinamento_id) ?? []),
        ...treinamentoIdsColaborador,
      ]
      return [...new Set(todosIds)]
    } catch {
      return []
    }
  }

  useEffect(() => {
    if (!activeTenantId) return
    const run = async () => {
      if (!debouncedFiltroParticipante || debouncedFiltroParticipante.length < 2) {
        setIdsPorParticipante(null)
        return
      }
      const ids = await buscarTreinamentosPorParticipante(debouncedFiltroParticipante)
      setIdsPorParticipante(ids)
    }
    run()
  }, [debouncedFiltroParticipante, activeTenantId])

  useEffect(() => {
    if (!activeTenantId) return

    fetchTreinamentos()
    fetchEmpresas()

    const channel = supabase
      .channel('treinamentos-historico')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'treinamentos',
          filter: `tenant_id=eq.${activeTenantId}`,
        },
        () => fetchTreinamentos(true)
      )
      .subscribe()

    const pollMs = 15_000
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTreinamentos(true)
      }
    }, pollMs)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchTreinamentos(true)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeTenantId, idsPorParticipante, paginaAtual, filtroTipo, filtroEmpresa, filtroDataInicio, filtroDataFim])

  useEffect(() => {
    setPaginaAtual(1)
  }, [filtroTipo, filtroEmpresa, filtroDataInicio, filtroDataFim, idsPorParticipante])

  const handleLimparFiltros = () => {
    setFiltroTipo('todos')
    setFiltroEmpresa('todas')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroParticipante('')
    setIdsPorParticipante(null)
    setPaginaAtual(1)
  }

  const totalPaginas = Math.ceil(totalRegistros / ITENS_POR_PAGINA) || 1
  const inicio = totalRegistros === 0 ? 0 : (paginaAtual - 1) * ITENS_POR_PAGINA + 1
  const fim = Math.min(paginaAtual * ITENS_POR_PAGINA, totalRegistros)

  const paginasParaExibir = useMemo(() => {
    const paginas: number[] = []
    const delta = 2
    let start = Math.max(1, paginaAtual - delta)
    let end = Math.min(totalPaginas, paginaAtual + delta)
    if (end - start < 4) {
      if (start === 1) end = Math.min(totalPaginas, 5)
      else if (end === totalPaginas) start = Math.max(1, totalPaginas - 4)
    }
    for (let i = start; i <= end; i++) paginas.push(i)
    return paginas
  }, [paginaAtual, totalPaginas])

  const handleVerDetalhes = async (t: Treinamento) => {
    setSelectedTreinamento(t)
    setDetailsOpen(true)
    if (t.tipo === 'colaborador') {
      setLoadingColaboradores(true)
      try {
        const { data, error } = await supabase
          .from('treinamento_colaboradores')
          .select('*, colaboradores(nome, setores(nome))')
          .eq('treinamento_id', t.id)

        if (error) throw error
        setColaboradoresDetalhe((data as ColaboradorComSetor[]) ?? [])
      } catch (error) {
        console.error('Erro ao carregar colaboradores:', error)
        toast.error('Não foi possível carregar os colaboradores.')
      } finally {
        setLoadingColaboradores(false)
      }
    } else {
      setColaboradoresDetalhe([])
    }
  }

  const handleCloseDetails = () => {
    setDetailsOpen(false)
    setSelectedTreinamento(null)
    setColaboradoresDetalhe([])
  }

  const handleOpenEdit = async (t: Treinamento) => {
    if (!activeTenantId) return
    try {
      const { data: colData, error: colErr } = await supabase
        .from('colaboradores')
        .select('id, nome, setor_id, setores(nome)')
        .eq('tenant_id', activeTenantId)
        .order('nome', { ascending: true })
      if (colErr) throw colErr
      setColaboradoresList((colData as unknown as ColaboradorWithSetorEdit[]) ?? [])

      if (t.tipo === 'colaborador') {
        const { data: tcData, error: tcErr } = await supabase
          .from('treinamento_colaboradores')
          .select('colaborador_id')
          .eq('treinamento_id', t.id)
        if (tcErr) throw tcErr
        const ids = (tcData ?? []).map((r: { colaborador_id: string }) => r.colaborador_id)
        setColaboradoresVinculados(ids)
      } else {
        setColaboradoresVinculados([])
      }

      setEditingTreinamento(t)
      setEditSheetOpen(true)
    } catch (error) {
      console.error('Erro ao carregar dados para edição:', error)
      toast.error('Não foi possível carregar os dados. Tente novamente.')
    }
  }

  const handleCloseEdit = () => {
    setEditSheetOpen(false)
    setEditingTreinamento(null)
    setColaboradoresList([])
    setColaboradoresVinculados([])
  }

  const handleEditSuccess = () => {
    handleCloseEdit()
    fetchTreinamentos()
    toast.success('Treinamento atualizado com sucesso.')
  }

  const handleOpenDelete = (t: Treinamento) => {
    setTreinamentoToDelete(t)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!treinamentoToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('treinamentos')
        .delete()
        .eq('id', treinamentoToDelete.id)

      if (error) throw error
      toast.success('Treinamento excluído com sucesso.')
      setDeleteDialogOpen(false)
      setTreinamentoToDelete(null)
      fetchTreinamentos()
    } catch (error) {
      console.error('Erro ao excluir treinamento:', error)
      toast.error('Não foi possível excluir o treinamento.')
    } finally {
      setDeleting(false)
    }
  }

  const buscarParticipantes = async (t: Treinamento) => {
    if (!activeTenantId) return
    setTreinamentoSelecionado(t)
    setParticipantesDialogOpen(true)
    setParticipantes([])
    setBuscaParticipante('')
    setLoadingParticipantes(true)
    try {
      if (t.tipo === 'parceiro') {
        const { data, error } = await supabase
          .from('treinamento_parceiros')
          .select('nome, email')
          .eq('treinamento_id', t.id)
          .eq('tenant_id', activeTenantId)
        if (error) throw error
        setParticipantes((data as { nome: string; email: string }[]) ?? [])
      } else {
        const { data, error } = await supabase
          .from('treinamento_colaboradores')
          .select('colaboradores(nome, email)')
          .eq('treinamento_id', t.id)
          .eq('tenant_id', activeTenantId)
        if (error) throw error
        const rows = (data ?? []) as { colaboradores: { nome: string; email: string } | { nome: string; email: string }[] | null }[]
        const list = rows.map((row) => {
          const col = Array.isArray(row.colaboradores) ? row.colaboradores[0] : row.colaboradores
          return { nome: col?.nome ?? '—', email: col?.email ?? '—' }
        })
        setParticipantes(list)
      }
    } catch (err) {
      console.error('Erro ao buscar participantes:', err)
      toast.error('Não foi possível carregar os participantes.')
      setParticipantes([])
    } finally {
      setLoadingParticipantes(false)
    }
  }

  const buscarAvaliacaoTokens = async (treinamento: Treinamento) => {
    if (!activeTenantId) return
    setTreinamentoAvaliacao(treinamento)
    setAvaliacaoDialogOpen(true)
    setAvaliacaoTokens([])
    setAvaliacaoSemFormulario(false)
    setExpandedTokenId(null)
    setRespostasPorToken(new Map())
    setLoadingAvaliacao(true)
    try {
      const { data: formulario } = await supabase
        .from('avaliacao_formularios')
        .select('id')
        .eq('treinamento_id', treinamento.id)
        .eq('tenant_id', activeTenantId)
        .maybeSingle()

      if (!formulario) {
        setAvaliacaoTokens([])
        setAvaliacaoSemFormulario(true)
        return
      }

      setAvaliacaoSemFormulario(false)
      const { data: tokens } = await supabase
        .from('avaliacao_tokens')
        .select(
          'id, respondente_nome, respondente_email, respondente_tipo, usado, nota, aprovado, respondido_em, token'
        )
        .eq('formulario_id', (formulario as { id: string }).id)
        .eq('tenant_id', activeTenantId)
        .order('respondido_em', { ascending: false })

      setAvaliacaoTokens((tokens as AvaliacaoTokenRow[]) ?? [])
    } catch (err) {
      console.error('Erro ao buscar tokens de avaliação:', err)
      toast.error('Não foi possível carregar as avaliações.')
      setAvaliacaoTokens([])
    } finally {
      setLoadingAvaliacao(false)
    }
  }

  const buscarRespostasToken = async (tokenId: string) => {
    try {
      const { data } = await supabase
        .from('avaliacao_respostas')
        .select(
          `
          opcao_selecionada,
          avaliacao_perguntas(texto, tipo, resposta_correta)
        `
        )
        .eq('token_id', tokenId)

      const rows = (data ?? []) as unknown as {
        opcao_selecionada: string | null
        avaliacao_perguntas: { texto: string; tipo: string; resposta_correta: string | null } | { texto: string; tipo: string; resposta_correta: string | null }[] | null
      }[]
      const detalhes: RespostaDetalhe[] = rows.map((r) => {
        const pergunta = Array.isArray(r.avaliacao_perguntas)
          ? r.avaliacao_perguntas[0]
          : r.avaliacao_perguntas
        return {
          pergunta_texto: pergunta?.texto ?? '',
          tipo: pergunta?.tipo ?? '',
          opcao_selecionada: r.opcao_selecionada,
          resposta_correta: pergunta?.resposta_correta ?? null,
        }
      })

      setRespostasPorToken((prev) => new Map(prev).set(tokenId, detalhes))
    } catch (err) {
      console.error('Erro ao buscar respostas:', err)
      toast.error('Não foi possível carregar as respostas.')
    }
  }

  const toggleExpandToken = (tokenId: string) => {
    setExpandedTokenId((prev) => {
      const next = prev === tokenId ? null : tokenId
      if (next && !respostasPorToken.has(next)) {
        buscarRespostasToken(next)
      }
      return next
    })
  }

  const formatDateTime = (isoStr: string | null) => {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  const buscaParticipanteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedBuscaParticipante, setDebouncedBuscaParticipante] = useState('')
  useEffect(() => {
    if (buscaParticipanteDebounceRef.current) clearTimeout(buscaParticipanteDebounceRef.current)
    buscaParticipanteDebounceRef.current = setTimeout(() => {
      setDebouncedBuscaParticipante(buscaParticipante)
    }, 300)
    return () => {
      if (buscaParticipanteDebounceRef.current) clearTimeout(buscaParticipanteDebounceRef.current)
    }
  }, [buscaParticipante])

  const participantesFiltradosParaExibir = useMemo(() => {
    const termo = debouncedBuscaParticipante.trim().toLowerCase()
    if (!termo) return participantes
    return participantes.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo)
    )
  }, [participantes, debouncedBuscaParticipante])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const [ano, mes, dia] = dateStr.split('-')
    if (!ano || !mes || !dia) return dateStr
    return `${dia}/${mes}/${ano}`
  }

  const exportarExcel = async () => {
    if (!activeTenantId || !canExportExcel) return
    setExportando(true)
    try {
      const participanteIds = idsPorParticipante
      let data: Treinamento[] = []

      const selectColsExport = `
        id,
        codigo,
        tipo,
        nome,
        carga_horaria,
        empresa_parceira_id,
        data_treinamento,
        indice_satisfacao,
        tenant_id,
        empresas_parceiras(nome)
      `

      if (user?.isMaster() || user?.isAdmin?.()) {
        let query = supabase
          .from('treinamentos')
          .select(selectColsExport)
          .eq('tenant_id', activeTenantId)
        if (participanteIds !== null) {
          query = query.in('id', participanteIds.length > 0 ? participanteIds : ['__empty__'])
        }
        if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo)
        if (filtroEmpresa !== 'todas') query = query.eq('empresa_parceira_id', filtroEmpresa)
        if (filtroDataInicio) query = query.gte('data_treinamento', filtroDataInicio)
        if (filtroDataFim) query = query.lte('data_treinamento', filtroDataFim)
        const { data: d, error } = await query.order('codigo', { ascending: false })
        if (error) throw error
        data = (d as unknown as Treinamento[]) ?? []
      } else {
        const userEmail = user?.email
        if (!userEmail) {
          toast.error('Não foi possível exportar.')
          return
        }
        const { data: colData, error: colError } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('tenant_id', activeTenantId)
          .eq('email', userEmail)
          .maybeSingle()
        if (colError || !colData) {
          toast.error('Não foi possível exportar.')
          return
        }
        const colaboradorId = (colData as { id: string }).id
        const { data: tcData, error: tcError } = await supabase
          .from('treinamento_colaboradores')
          .select('treinamento_id')
          .eq('colaborador_id', colaboradorId)
        if (tcError) throw tcError
        let ids = (tcData ?? []).map((r: { treinamento_id: string }) => r.treinamento_id)
        if (participanteIds !== null) {
          ids = ids.filter((id) => participanteIds.includes(id))
        }
        if (ids.length === 0) {
          data = []
        } else {
          let query = supabase
            .from('treinamentos')
            .select(selectColsExport)
            .in('id', ids)
          if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo)
          if (filtroEmpresa !== 'todas') query = query.eq('empresa_parceira_id', filtroEmpresa)
          if (filtroDataInicio) query = query.gte('data_treinamento', filtroDataInicio)
          if (filtroDataFim) query = query.lte('data_treinamento', filtroDataFim)
          const { data: d, error } = await query.order('codigo', { ascending: false })
          if (error) throw error
          data = (d as unknown as Treinamento[]) ?? []
        }
      }

      const headerStyle = {
        fill: { fgColor: { rgb: '00C9A7' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
      }

      const treinamentoIdsExport = data.map((t) => t.id)
      let mediasExport = new Map<string, number>()
      let comAvaliacaoExport = new Set<string>()
      if (treinamentoIdsExport.length > 0) {
        const { data: mediasAvaliacao } = await supabase
          .from('avaliacao_tokens')
          .select('treinamento_id, nota')
          .eq('tenant_id', activeTenantId)
          .eq('usado', true)
          .in('treinamento_id', treinamentoIdsExport)
          .not('nota', 'is', null)
        const { data: avaliacoesVinculadas } = await supabase
          .from('avaliacao_formularios')
          .select('treinamento_id')
          .eq('tenant_id', activeTenantId)
          .in('treinamento_id', treinamentoIdsExport)
        if (mediasAvaliacao) {
          const grupos = new Map<string, number[]>()
          for (const row of mediasAvaliacao as { treinamento_id: string; nota: number }[]) {
            if (!grupos.has(row.treinamento_id)) grupos.set(row.treinamento_id, [])
            grupos.get(row.treinamento_id)!.push(row.nota)
          }
          for (const [id, notas] of grupos) {
            mediasExport.set(id, Math.round(notas.reduce((a, b) => a + b, 0) / notas.length))
          }
        }
        comAvaliacaoExport = new Set(
          (avaliacoesVinculadas as { treinamento_id: string }[] | null)?.map((a) => a.treinamento_id) ?? []
        )
      }

      const rows = data.map((t) => {
        const media = mediasExport.get(t.id)
        const temAvaliacao = comAvaliacaoExport.has(t.id)
        let avaliacaoVal = '—'
        if (!temAvaliacao) avaliacaoVal = 'N/A'
        else if (media !== undefined) avaliacaoVal = `${media}%`
        return [
          t.codigo,
          tipoLabel[t.tipo] ?? t.tipo,
          t.nome,
          t.empresas_parceiras?.nome ?? '—',
          t.carga_horaria,
          formatDate(t.data_treinamento),
          t.indice_satisfacao != null ? `${t.indice_satisfacao}%` : '—',
          avaliacaoVal,
        ]
      })

      const aoa = [
        [
          { v: 'Código', t: 's', s: headerStyle },
          { v: 'Tipo', t: 's', s: headerStyle },
          { v: 'Nome do Treinamento', t: 's', s: headerStyle },
          { v: 'Empresa Parceira', t: 's', s: headerStyle },
          { v: 'Carga Horária (h)', t: 's', s: headerStyle },
          { v: 'Data', t: 's', s: headerStyle },
          { v: 'Satisfação (%)', t: 's', s: headerStyle },
          { v: 'Avaliação (%)', t: 's', s: headerStyle },
        ],
        ...rows.map((r) => r.map((v) => ({ v, t: 's' as const }))),
      ]

      const codigoPorId = Object.fromEntries(data.map((t) => [t.id, t.codigo]))
      const idsParceiro = data.filter((t) => t.tipo === 'parceiro').map((t) => t.id)
      const idsColaborador = data.filter((t) => t.tipo === 'colaborador').map((t) => t.id)

      const participantesRows: { codigo: string; nome: string; email: string }[] = []

      if (idsParceiro.length > 0) {
        let offset = 0
        const pageSize = 1000
        let hasMore = true
        while (hasMore) {
          const { data: parceirosData } = await supabase
            .from('treinamento_parceiros')
            .select('treinamento_id, nome, email')
            .in('treinamento_id', idsParceiro)
            .eq('tenant_id', activeTenantId)
            .range(offset, offset + pageSize - 1)
          const parceiros = (parceirosData ?? []) as { treinamento_id: string; nome: string; email: string }[]
          parceiros.forEach((p) => {
            participantesRows.push({
              codigo: codigoPorId[p.treinamento_id] ?? '—',
              nome: p.nome ?? '—',
              email: p.email ?? '—',
            })
          })
          hasMore = parceiros.length === pageSize
          offset += pageSize
        }
      }

      if (idsColaborador.length > 0) {
        let offset = 0
        const pageSize = 1000
        let hasMore = true
        const colaboradorMap = new Map<string, { nome: string; email: string }>()
        while (hasMore) {
          const { data: tcData } = await supabase
            .from('treinamento_colaboradores')
            .select('treinamento_id, colaborador_id')
            .in('treinamento_id', idsColaborador)
            .eq('tenant_id', activeTenantId)
            .range(offset, offset + pageSize - 1)
          const tcRows = (tcData ?? []) as { treinamento_id: string; colaborador_id: string }[]
          const colaboradorIds = [...new Set(tcRows.map((r) => r.colaborador_id))]
          if (colaboradorIds.length > 0) {
            const idsToFetch = colaboradorIds.filter((id) => !colaboradorMap.has(id))
            if (idsToFetch.length > 0) {
              const { data: colData } = await supabase
                .from('colaboradores')
                .select('id, nome, email')
                .in('id', idsToFetch)
                .eq('tenant_id', activeTenantId)
              const cols = (colData ?? []) as { id: string; nome: string; email: string }[]
              cols.forEach((c) => colaboradorMap.set(c.id, { nome: c.nome ?? '—', email: c.email ?? '—' }))
            }
            tcRows.forEach((row) => {
              const col = colaboradorMap.get(row.colaborador_id) ?? { nome: '—', email: '—' }
              participantesRows.push({
                codigo: codigoPorId[row.treinamento_id] ?? '—',
                nome: col.nome,
                email: col.email,
              })
            })
          }
          hasMore = tcRows.length === pageSize
          offset += pageSize
        }
      }

      participantesRows.sort((a, b) =>
        a.codigo.localeCompare(b.codigo) || a.nome.localeCompare(b.nome)
      )

      const aoaParticipantes = [
        [
          { v: 'Código', t: 's', s: headerStyle },
          { v: 'Nome', t: 's', s: headerStyle },
          { v: 'E-mail', t: 's', s: headerStyle },
        ],
        ...participantesRows.map((r) => [
          { v: r.codigo, t: 's' as const },
          { v: r.nome, t: 's' as const },
          { v: r.email, t: 's' as const },
        ]),
      ]

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ws['!cols'] = [
        { wch: 14 },
        { wch: 12 },
        { wch: 35 },
        { wch: 25 },
        { wch: 16 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Treinamentos')

      const wsParticipantes = XLSX.utils.aoa_to_sheet(aoaParticipantes)
      wsParticipantes['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 35 }]
      XLSX.utils.book_append_sheet(wb, wsParticipantes, 'Participantes')
      const filename = `historico-treinamentos-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`
      XLSX.writeFile(wb, filename)
      toast.success('Exportação concluída.')
    } catch (err) {
      console.error('Erro ao exportar:', err)
      toast.error('Não foi possível exportar o Excel.')
    } finally {
      setExportando(false)
    }
  }

  const empresaNome = (t: Treinamento) =>
    t.empresas_parceiras?.nome ?? '—'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Histórico de Treinamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? '...' : totalRegistros}{' '}
            treinamento{totalRegistros !== 1 ? 's' : ''} encontrado
            {totalRegistros !== 1 ? 's' : ''}
          </p>
        </div>
        {canExportExcel && (
          <Button
            variant="outline"
            onClick={exportarExcel}
            disabled={exportando || loading}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="parceiro">Parceiro</SelectItem>
              <SelectItem value="colaborador">Colaborador</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Empresa Parceira</Label>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Empresa Parceira" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Data Início</Label>
          <Input
            type="date"
            placeholder="Data Início"
            value={filtroDataInicio}
            onChange={(e) => setFiltroDataInicio(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Data Fim</Label>
          <Input
            type="date"
            placeholder="Data Fim"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Participante</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por participante..."
              value={filtroParticipante}
              onChange={(e) => setFiltroParticipante(e.target.value)}
              className="w-[200px] pl-9"
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLimparFiltros}>
          Limpar Filtros
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : treinamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum treinamento encontrado.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Registre um treinamento para ver o histórico.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Código</TableHead>
                <TableHead className="font-medium">Tipo</TableHead>
                <TableHead className="font-medium">Nome do Treinamento</TableHead>
                <TableHead className="font-medium">Empresa Parceira</TableHead>
                <TableHead className="font-medium">C. H.</TableHead>
                <TableHead className="font-medium">Data</TableHead>
                <TableHead className="font-medium">Satisfação</TableHead>
                <TableHead className="font-medium">Avaliação</TableHead>
                <TableHead className="font-medium w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treinamentos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.codigo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        tipoConfig[t.tipo] ?? tipoConfig.parceiro
                      )}
                    >
                      {tipoLabel[t.tipo] ?? t.tipo}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium max-w-52 truncate">
                    {t.nome}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {empresaNome(t)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.carga_horaria}h
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(t.data_treinamento)}
                  </TableCell>
                  <TableCell>
                    {t.indice_satisfacao != null ? (
                      <span className="text-amber-600 font-medium">
                        {t.indice_satisfacao}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const media = mediasPorTreinamento.get(t.id)
                      const temAvaliacao = treinamentosComAvaliacao.has(t.id)
                      const notaMinima = notaMinimaPorTreinamento.get(t.id) ?? 70
                      if (!temAvaliacao) {
                        return (
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            N/A
                          </Badge>
                        )
                      }
                      if (media === undefined) {
                        return <span className="text-muted-foreground">—</span>
                      }
                      const aprovado = media >= notaMinima
                      return (
                        <span
                          className={cn(
                            'font-medium',
                            aprovado ? 'text-green-600' : 'text-destructive'
                          )}
                        >
                          {media}%
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => buscarAvaliacaoTokens(t)}
                              className="gap-1"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                              Avaliação
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver Avaliações</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => buscarParticipantes(t)}
                              className="gap-1"
                              title="Ver Participantes"
                            >
                              <Users className="w-4 h-4" />
                              Ver Participantes
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver Participantes</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerDetalhes(t)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(t)}
                          className="gap-1"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleOpenDelete(t)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginação */}
      {!loading && totalRegistros > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {inicio}–{fim} de {totalRegistros} treinamentos
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {paginasParaExibir.map((num) => (
                <Button
                  key={num}
                  variant={num === paginaAtual ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPaginaAtual(num)}
                  className={cn(
                    num === paginaAtual &&
                      'bg-[#00C9A7] hover:bg-[#00C9A7]/90 text-white'
                  )}
                >
                  {num}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas}
              className="gap-1"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sheet Detalhes */}
      <Sheet open={detailsOpen} onOpenChange={(open) => !open && handleCloseDetails()}>
        <SheetContent side="right" className="flex flex-col p-0 sm:max-w-xl">
          {selectedTreinamento && (
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-6 p-6 pr-12">
                {/* Cabeçalho */}
                <div className="pt-6 space-y-1">
                  <SheetHeader className="p-0">
                    <SheetTitle className="text-2xl font-bold leading-tight text-foreground">
                      {selectedTreinamento.nome}
                    </SheetTitle>
                  </SheetHeader>
                  <span
                    className={cn(
                      'inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium',
                      tipoConfig[selectedTreinamento.tipo] ?? tipoConfig.parceiro
                    )}
                  >
                    {tipoLabel[selectedTreinamento.tipo] ?? selectedTreinamento.tipo}
                  </span>
                  <Separator className="mt-4" />
                </div>

                {/* Informações Gerais */}
                <section className="space-y-4">
                  <h3 className="text-sm uppercase tracking-widest font-semibold text-muted-foreground">
                    Informações Gerais
                  </h3>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" />
                        Empresa Parceira
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {empresaNome(selectedTreinamento)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Data do Treinamento
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(selectedTreinamento.data_treinamento)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Carga Horária
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedTreinamento.carga_horaria}h
                      </p>
                    </div>
                    {selectedTreinamento.tipo === 'parceiro' && (
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" />
                          Quantidade de Pessoas
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {selectedTreinamento.quantidade_pessoas ?? '—'}
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Indicadores */}
                <section className="space-y-4">
                  <h3 className="text-sm uppercase tracking-widest font-semibold text-muted-foreground">
                    Indicadores
                  </h3>
                  <Separator />
                  <div className="grid grid-cols-1 gap-3">
                    <div
                      className={cn(
                        'rounded-xl p-5 border relative',
                        getIndicadorColor(selectedTreinamento.indice_satisfacao)
                      )}
                    >
                      <div className="absolute top-4 right-4">
                        <Star className="w-4 h-4 shrink-0 opacity-80" />
                      </div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/80 mb-1">
                        Índice de Satisfação
                      </p>
                      <span className="text-4xl font-bold block">
                        {selectedTreinamento.indice_satisfacao != null
                          ? `${selectedTreinamento.indice_satisfacao}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Conteúdo Programático */}
                {selectedTreinamento.conteudo && (
                  <section className="space-y-4">
                    <h3 className="text-sm uppercase tracking-widest font-semibold text-muted-foreground">
                      Conteúdo Programático
                    </h3>
                    <Separator />
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {selectedTreinamento.conteudo}
                      </p>
                    </div>
                  </section>
                )}

                {/* Objetivo */}
                {selectedTreinamento.objetivo && (
                  <section className="space-y-4">
                    <h3 className="text-sm uppercase tracking-widest font-semibold text-muted-foreground">
                      Objetivo
                    </h3>
                    <Separator />
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                        {selectedTreinamento.objetivo}
                      </p>
                    </div>
                  </section>
                )}

                {/* Colaboradores */}
                {selectedTreinamento.tipo === 'colaborador' && (
                  <section className="space-y-4 pb-4">
                    <h3 className="text-sm uppercase tracking-widest font-semibold text-muted-foreground">
                      Colaboradores
                    </h3>
                    <Separator />
                    {loadingColaboradores ? (
                      <Skeleton className="h-24 w-full" />
                    ) : colaboradoresDetalhe.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum colaborador vinculado
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {colaboradoresDetalhe.map((tc) => {
                          const nome = tc.colaboradores?.nome ?? '—'
                          const setor = tc.colaboradores?.setores?.nome ?? '—'
                          return (
                            <li
                              key={tc.id}
                              className="flex items-center gap-3 rounded-lg border border-border p-3"
                            >
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarFallback className="bg-[#00C9A7]/20 text-[#00C9A7] text-sm font-medium">
                                  {getInicial(nome)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {nome}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {setor}
                                </p>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet Editar */}
      <Sheet open={editSheetOpen} onOpenChange={(open) => !open && handleCloseEdit()}>
        <SheetContent side="right" className="flex flex-col p-0 sm:max-w-xl overflow-y-auto">
          <div className="flex flex-col gap-6 p-6 pr-12">
            <SheetHeader className="p-0">
              <SheetTitle className="text-2xl font-bold">Editar Treinamento</SheetTitle>
            </SheetHeader>
            <Separator />
            {editingTreinamento && (
              <EditTreinamentoForm
                key={editingTreinamento.id}
                treinamento={editingTreinamento}
                empresas={empresas}
                colaboradoresList={colaboradoresList}
                colaboradoresVinculados={colaboradoresVinculados}
                onSuccess={handleEditSuccess}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog Participantes */}
      <Dialog open={participantesDialogOpen} onOpenChange={setParticipantesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Participantes — {treinamentoSelecionado?.nome ?? ''}
            </DialogTitle>
            {treinamentoSelecionado && (
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-muted-foreground">
                  {treinamentoSelecionado.codigo}
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    tipoConfig[treinamentoSelecionado.tipo] ?? tipoConfig.parceiro
                  )}
                >
                  {tipoLabel[treinamentoSelecionado.tipo] ?? treinamentoSelecionado.tipo}
                </span>
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={buscaParticipante}
                onChange={(e) => setBuscaParticipante(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {participantesFiltradosParaExibir.length} participante(s) encontrado(s)
            </p>
            {loadingParticipantes ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : participantesFiltradosParaExibir.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum participante encontrado.
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden max-h-[280px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-medium">Nome</TableHead>
                      <TableHead className="font-medium">E-mail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participantesFiltradosParaExibir.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParticipantesDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Avaliações */}
      <Dialog
        open={avaliacaoDialogOpen}
        onOpenChange={(open) => {
          setAvaliacaoDialogOpen(open)
          if (!open) {
            setTreinamentoAvaliacao(null)
            setAvaliacaoTokens([])
            setAvaliacaoSemFormulario(false)
            setExpandedTokenId(null)
            setRespostasPorToken(new Map())
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Avaliações — {treinamentoAvaliacao?.nome ?? ''}
            </DialogTitle>
            {treinamentoAvaliacao && (
              <DialogDescription>
                {treinamentoAvaliacao.codigo}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="py-4">
            {loadingAvaliacao ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : avaliacaoSemFormulario ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma avaliação vinculada a este treinamento.
              </p>
            ) : avaliacaoTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum participante com avaliação gerada ainda.
              </p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-medium w-8" />
                      <TableHead className="font-medium">Nome</TableHead>
                      <TableHead className="font-medium">E-mail</TableHead>
                      <TableHead className="font-medium">Tipo</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium">Nota</TableHead>
                      <TableHead className="font-medium">Respondido em</TableHead>
                      <TableHead className="font-medium w-20">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {avaliacaoTokens.map((tok) => (
                      <React.Fragment key={tok.id}>
                        <TableRow>
                          <TableCell className="w-8" />
                          <TableCell className="font-medium">
                            {tok.respondente_nome?.trim() || tok.respondente_email}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {tok.respondente_email}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                (tok.respondente_tipo ?? '') === 'colaborador' &&
                                  'bg-blue-500/10 text-blue-600 border-0',
                                (tok.respondente_tipo ?? '') === 'parceiro' &&
                                  'bg-muted text-muted-foreground border-0'
                              )}
                            >
                              {(tok.respondente_tipo ?? 'parceiro') === 'colaborador'
                                ? 'Colaborador'
                                : 'Parceiro'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!tok.usado ? (
                              <Badge className="bg-amber-500/10 text-amber-600 border-0">
                                Pendente
                              </Badge>
                            ) : tok.aprovado === true ? (
                              <Badge className="bg-green-500/10 text-green-600 border-0">
                                Aprovado
                              </Badge>
                            ) : tok.aprovado === false ? (
                              <Badge className="bg-destructive/10 text-destructive border-0">
                                Reprovado
                              </Badge>
                            ) : (
                              <Badge className="bg-muted text-muted-foreground border-0">
                                Respondido
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {tok.nota != null ? `${tok.nota}%` : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateTime(tok.respondido_em)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => toggleExpandToken(tok.id)}
                              aria-label={
                                expandedTokenId === tok.id ? 'Recolher' : 'Expandir'
                              }
                            >
                              {expandedTokenId === tok.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedTokenId === tok.id && (
                          <TableRow key={`${tok.id}-expanded`}>
                            <TableCell
                              colSpan={8}
                              className="bg-muted/20 p-4 align-top"
                            >
                              {!respostasPorToken.has(tok.id) ? (
                                <div className="flex items-center justify-center py-4">
                                  <Skeleton className="h-6 w-32" />
                                </div>
                              ) : (
                                <ul className="space-y-3">
                                  {respostasPorToken
                                    .get(tok.id)
                                    ?.map((r, idx) => {
                                      const resp = r.opcao_selecionada ?? '—'
                                      const correta = r.resposta_correta
                                      const isCorreta =
                                        correta != null &&
                                        resp !== '—' &&
                                        resp === correta
                                      const isErrada =
                                        correta != null &&
                                        resp !== '—' &&
                                        resp !== correta
                                      return (
                                        <li key={idx} className="space-y-1">
                                          <p className="font-semibold text-sm text-foreground">
                                            {r.pergunta_texto}
                                          </p>
                                          <p
                                            className={cn(
                                              'text-sm',
                                              isCorreta &&
                                                'text-green-600 font-medium',
                                              isErrada &&
                                                'text-destructive font-medium',
                                              !isCorreta &&
                                                !isErrada &&
                                                'text-muted-foreground'
                                            )}
                                          >
                                            {isCorreta && '✓ '}
                                            {isErrada && '✗ '}
                                            Resposta: {resp}
                                            {isErrada &&
                                              correta &&
                                              ` — Correta: ${correta}`}
                                          </p>
                                        </li>
                                      )
                                    }) ?? []}
                                </ul>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAvaliacaoDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treinamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o treinamento &quot;
              {treinamentoToDelete?.nome}&quot;? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

