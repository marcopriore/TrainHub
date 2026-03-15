'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye,
  Trash2,
  Pencil,
  Star,
  CheckCircle,
  Calendar,
  Clock,
  Users,
  Building2,
  PlusCircle,
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
import { cn } from '@/lib/utils'

interface Treinamento {
  id: string
  tipo: string
  nome: string
  conteudo: string | null
  objetivo: string | null
  carga_horaria: number
  empresa_parceira_id: string | null
  quantidade_pessoas: number | null
  data_treinamento: string
  indice_satisfacao: number | null
  indice_aprovacao: number | null
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
  indiceAprovacao: z.coerce
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
        indiceAprovacao: treinamento.indice_aprovacao ?? 0,
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

    const indiceAprovacao = Number(values.indiceAprovacao)
    if (isNaN(indiceAprovacao) || indiceAprovacao < 0 || indiceAprovacao > 100) {
      setError('indiceAprovacao', { message: 'Valor entre 0 e 100' })
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
        indice_aprovacao: indiceAprovacao,
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormFieldEdit label="Índice de Satisfação %" error={errors.indiceSatisfacao?.message}>
          <div className="relative">
            <Input type="number" min={0} max={100} className="pr-8" {...register('indiceSatisfacao')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </FormFieldEdit>
        <FormFieldEdit label="Índice de Aprovação %" error={errors.indiceAprovacao?.message}>
          <div className="relative">
            <Input type="number" min={0} max={100} className="pr-8" {...register('indiceAprovacao')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </FormFieldEdit>
      </div>

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

  const supabase = createClient()

  useEffect(() => {
    if (user && !canView) router.replace('/dashboard/gestao')
  }, [user, canView, router])

  const fetchTreinamentos = async (silent = false) => {
    if (!activeTenantId) {
      setTreinamentos([])
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      if (user?.isMaster() || user?.isAdmin?.()) {
        const { data, error } = await supabase
          .from('treinamentos')
          .select('*, empresas_parceiras(nome)')
          .eq('tenant_id', activeTenantId)
          .order('data_treinamento', { ascending: false })
        if (error) throw error
        setTreinamentos((data as Treinamento[]) ?? [])
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
      const ids = (tcData ?? []).map((r: { treinamento_id: string }) => r.treinamento_id)
      if (ids.length === 0) {
        setTreinamentos([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('treinamentos')
        .select('*, empresas_parceiras(nome)')
        .in('id', ids)
        .order('data_treinamento', { ascending: false })
      if (error) throw error
      setTreinamentos((data as Treinamento[]) ?? [])
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
  }, [activeTenantId])

  const filtered = treinamentos.filter((t) => {
    const matchTipo = filtroTipo === 'todos' || t.tipo === filtroTipo
    const matchEmpresa =
      filtroEmpresa === 'todas' || t.empresa_parceira_id === filtroEmpresa
    const dataStr = t.data_treinamento
    const matchDataInicio = !filtroDataInicio || dataStr >= filtroDataInicio
    const matchDataFim = !filtroDataFim || dataStr <= filtroDataFim
    return matchTipo && matchEmpresa && matchDataInicio && matchDataFim
  })

  const handleLimparFiltros = () => {
    setFiltroTipo('todos')
    setFiltroEmpresa('todas')
    setFiltroDataInicio('')
    setFiltroDataFim('')
  }

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
      setColaboradoresList((colData as ColaboradorWithSetorEdit[]) ?? [])

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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  const empresaNome = (t: Treinamento) =>
    t.empresas_parceiras?.nome ?? '—'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Histórico de Treinamentos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {loading ? '...' : filtered.length}{' '}
          treinamento{filtered.length !== 1 ? 's' : ''} encontrado
          {filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
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
        <Input
          type="date"
          placeholder="Data Início"
          value={filtroDataInicio}
          onChange={(e) => setFiltroDataInicio(e.target.value)}
          className="w-[150px]"
        />
        <Input
          type="date"
          placeholder="Data Fim"
          value={filtroDataFim}
          onChange={(e) => setFiltroDataFim(e.target.value)}
          className="w-[150px]"
        />
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
        ) : filtered.length === 0 ? (
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
                <TableHead className="font-medium">Tipo</TableHead>
                <TableHead className="font-medium">Nome do Treinamento</TableHead>
                <TableHead className="font-medium">Empresa Parceira</TableHead>
                <TableHead className="font-medium">C. H.</TableHead>
                <TableHead className="font-medium">Data</TableHead>
                <TableHead className="font-medium">Satisfação</TableHead>
                <TableHead className="font-medium">Aprovação</TableHead>
                <TableHead className="font-medium w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
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
                    {t.indice_aprovacao != null ? (
                      <span className="text-green-600 font-medium">
                        {t.indice_aprovacao}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
                  <div className="grid grid-cols-2 gap-3">
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
                    <div
                      className={cn(
                        'rounded-xl p-5 border relative',
                        getIndicadorColor(selectedTreinamento.indice_aprovacao)
                      )}
                    >
                      <div className="absolute top-4 right-4">
                        <CheckCircle className="w-4 h-4 shrink-0 opacity-80" />
                      </div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground/80 mb-1">
                        Índice de Aprovação
                      </p>
                      <span className="text-4xl font-bold block">
                        {selectedTreinamento.indice_aprovacao != null
                          ? `${selectedTreinamento.indice_aprovacao}%`
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

