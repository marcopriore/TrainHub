'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PlusCircle, Trash2, Building2, Users, FileSpreadsheet, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TreinamentoImportDialog } from '@/components/treinamento-import-dialog'

// ---------- Schemas ----------
const baseSchema = z.object({
  nome: z.string().min(1, 'Informe o nome do treinamento'),
  conteudo: z.string().min(1, 'Informe o conteúdo programático'),
  objetivo: z.string().min(1, 'Informe o objetivo'),
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
})

const parceiroSchema = baseSchema.extend({
  quantidadePessoas: z.coerce.number().min(1, 'Informe a quantidade de pessoas'),
})

const colaboradorSchema = baseSchema.extend({
  colaboradores: z
    .array(z.object({ colaboradorId: z.string().min(1, 'Selecione o colaborador') }))
    .min(1, 'Adicione ao menos um colaborador'),
})

type ParceiroForm = z.infer<typeof parceiroSchema>
type ColaboradorForm = z.infer<typeof colaboradorSchema>

// ---------- Types ----------
interface EmpresaParceira {
  id: string
  nome: string
}

interface ColaboradorWithSetor {
  id: string
  nome: string
  setor_id: string | null
  setores?: { nome: string } | null
}

// ---------- Shared Components ----------
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="text-destructive text-xs mt-1">{message}</span>
}

function FormField({
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

// ---------- Main Page ----------
export default function NovoTreinamentoPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canRegistrarParceiro =
    user?.hasPermission?.('registrar_treinamento_parceiro') || user?.isAdmin?.() || user?.isMaster?.()
  const canRegistrarColaborador =
    user?.hasPermission?.('registrar_treinamento_colaborador') || user?.isAdmin?.() || user?.isMaster?.()
  const canRegistrar = canRegistrarParceiro || canRegistrarColaborador
  const canImport = user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('importar_planilha')
  const isColaboradorLimited =
    !user?.isAdmin?.() && !user?.isMaster?.() && !user?.hasPermission?.('registrar_treinamento_parceiro')
  const activeTenantId = getActiveTenantId()
  const [empresas, setEmpresas] = useState<EmpresaParceira[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorWithSetor[]>([])
  const [colaboradorLogado, setColaboradorLogado] = useState<{ id: string; nome: string } | null>(null)
  const [treinamentosExistentes, setTreinamentosExistentes] = useState<
    { nome: string; data_treinamento: string }[]
  >([])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (user && !canRegistrar) {
      router.replace('/dashboard')
      return
    }
  }, [user, canRegistrar, router])

  useEffect(() => {
    if (!activeTenantId) {
      setEmpresas([])
      setColaboradores([])
      return
    }
    const loadData = async () => {
      try {
        const [empRes, colRes] = await Promise.all([
          supabase
            .from('empresas_parceiras')
            .select('id, nome')
            .eq('tenant_id', activeTenantId)
            .order('nome', { ascending: true }),
          supabase
            .from('colaboradores')
            .select('id, nome, setor_id')
            .eq('tenant_id', activeTenantId)
            .order('nome'),
        ])
        if (empRes.error) throw empRes.error
        if (colRes.error) throw colRes.error
        setEmpresas(empRes.data ?? [])
        setColaboradores((colRes.data as ColaboradorWithSetor[]) ?? [])
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
        toast.error('Não foi possível carregar os dados. Tente novamente.')
      }
    }
    loadData()
  }, [activeTenantId])

  useEffect(() => {
    if (!isColaboradorLimited || !user?.email || !activeTenantId) {
      setColaboradorLogado(null)
      return
    }
    const fetchColaboradorByEmail = async () => {
      try {
        const { data, error } = await supabase
          .from('colaboradores')
          .select('id, nome')
          .eq('email', user.email)
          .eq('tenant_id', activeTenantId)
          .maybeSingle()
        if (error) throw error
        setColaboradorLogado((data as { id: string; nome: string } | null) ?? null)
      } catch (err) {
        console.error('Erro ao buscar colaborador:', err)
        setColaboradorLogado(null)
      }
    }
    fetchColaboradorByEmail()
  }, [isColaboradorLimited, user?.email, activeTenantId])

  const fetchTreinamentosExistentes = async () => {
    if (!activeTenantId) return
    try {
      const { data, error } = await supabase
        .from('treinamentos')
        .select('nome, data_treinamento')
        .eq('tenant_id', activeTenantId)
      if (error) throw error
      setTreinamentosExistentes((data as { nome: string; data_treinamento: string }[]) ?? [])
    } catch (err) {
      console.error('Erro ao carregar treinamentos:', err)
      setTreinamentosExistentes([])
    }
  }

  const handleOpenImport = () => {
    fetchTreinamentosExistentes()
    setImportDialogOpen(true)
  }

  const formatColaboradorLabel = (c: ColaboradorWithSetor) => {
    const setor = c.setores?.nome ?? 'Sem setor'
    return `${c.nome} (${setor})`
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Registrar Treinamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Preencha os dados do treinamento realizado
          </p>
        </div>
        {canImport && (
          <Button variant="outline" onClick={handleOpenImport} className="gap-2 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
            Importar Planilha
          </Button>
        )}
      </div>

      <Tabs
        defaultValue={
          canRegistrarParceiro ? 'parceiro' : canRegistrarColaborador ? 'colaborador' : 'parceiro'
        }
        className="w-full"
      >
        <TabsList className="flex gap-1 bg-muted rounded-xl p-1.5 h-auto">
          {canRegistrarParceiro && (
            <TabsTrigger
              value="parceiro"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Building2 className="w-4 h-4" />
              Parceiro (Externo)
            </TabsTrigger>
          )}
          {canRegistrarColaborador && (
            <TabsTrigger
              value="colaborador"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <Users className="w-4 h-4" />
              Colaborador (Interno)
            </TabsTrigger>
          )}
        </TabsList>

        {canRegistrarParceiro && (
        <TabsContent value="parceiro" className="mt-6">
          <ParceiroForm
            empresas={empresas}
            tenantId={activeTenantId}
            onSuccess={() => {
              toast.success('Treinamento salvo com sucesso.')
              router.push('/dashboard/treinamentos')
            }}
          />
        </TabsContent>
        )}

        {canRegistrarColaborador && (
        <TabsContent value="colaborador" className="mt-6">
          <ColaboradorForm
            empresas={empresas}
            colaboradores={colaboradores}
            tenantId={activeTenantId}
            formatColaboradorLabel={formatColaboradorLabel}
            isColaboradorLimited={isColaboradorLimited}
            colaboradorLogado={colaboradorLogado}
            onSuccess={() => {
              toast.success('Treinamento salvo com sucesso.')
              router.push('/dashboard/treinamentos')
            }}
          />
        </TabsContent>
        )}
      </Tabs>

      <TreinamentoImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        empresas={empresas}
        colaboradores={colaboradores.map((c) => ({ id: c.id, nome: c.nome }))}
        treinamentosExistentes={treinamentosExistentes}
        onImportParceiro={async (data) => {
          if (!activeTenantId) throw new Error('Tenant não identificado')
          const supabaseClient = createClient()
          for (const row of data) {
            const { error } = await supabaseClient
              .from('treinamentos')
              .insert({
                tipo: 'parceiro',
                nome: row.nome,
                conteudo: row.conteudo ?? '',
                objetivo: row.objetivo ?? '',
                carga_horaria: row.carga_horaria,
                empresa_parceira_id: row.empresa_parceira_id,
                quantidade_pessoas: row.quantidade_pessoas,
                data_treinamento: row.data_treinamento,
                indice_satisfacao: row.indice_satisfacao,
                indice_aprovacao: row.indice_aprovacao,
                tenant_id: activeTenantId,
              })
            if (error) throw error
          }
        }}
        onImportColaborador={async (data) => {
          if (!activeTenantId) throw new Error('Tenant não identificado')
          const supabaseClient = createClient()
          for (const row of data) {
            const { data: inserted, error: err1 } = await supabaseClient
              .from('treinamentos')
              .insert({
                tipo: 'colaborador',
                nome: row.nome,
                conteudo: row.conteudo ?? '',
                objetivo: row.objetivo ?? '',
                carga_horaria: row.carga_horaria,
                empresa_parceira_id: row.empresa_parceira_id,
                data_treinamento: row.data_treinamento,
                indice_satisfacao: row.indice_satisfacao,
                indice_aprovacao: row.indice_aprovacao,
                tenant_id: activeTenantId,
              })
              .select('id')
              .single()
            if (err1) throw err1
            const treinamentoId = (inserted as { id: string }).id
            const colabIds = row.colaborador_ids as string[]
            if (colabIds?.length) {
              const rows = colabIds.map((colaborador_id: string) => ({
                treinamento_id: treinamentoId,
                colaborador_id,
                tenant_id: activeTenantId,
              }))
              const { error: err2 } = await supabaseClient
                .from('treinamento_colaboradores')
                .insert(rows)
              if (err2) throw err2
            }
          }
        }}
        onSuccess={() => {
          toast.success('Treinamentos importados com sucesso.')
          router.push('/dashboard/treinamentos')
        }}
      />
    </div>
  )
}

// ---------- Parceiro Form ----------
function ParceiroForm({
  empresas,
  tenantId,
  onSuccess,
}: {
  empresas: EmpresaParceira[]
  tenantId: string | null
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ParceiroForm>({
    resolver: zodResolver(parceiroSchema),
    mode: 'onChange',
  })

  const onSubmit = async (data: ParceiroForm) => {
    if (!tenantId) {
      toast.error('Tenant não identificado. Selecione um tenant.')
      return
    }
    const supabase = createClient()
    try {
      const { data: row, error } = await supabase
        .from('treinamentos')
        .insert({
          tipo: 'parceiro',
          nome: data.nome,
          conteudo: data.conteudo,
          objetivo: data.objetivo,
          carga_horaria: data.cargaHoraria,
          empresa_parceira_id: data.empresaParceiraId,
          quantidade_pessoas: data.quantidadePessoas,
          data_treinamento: data.dataTreinamento,
          indice_satisfacao: data.indiceSatisfacao,
          indice_aprovacao: data.indiceAprovacao,
          tenant_id: tenantId,
        })
        .select('id')
        .single()

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Erro ao salvar treinamento:', error)
      toast.error('Não foi possível salvar o treinamento. Tente novamente.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5"
    >
      <FormField label="Nome do Treinamento" error={errors.nome?.message}>
        <Input placeholder="Ex.: Gestão de Projetos Ágeis" {...register('nome')} />
      </FormField>

      <FormField label="Conteúdo Programático" error={errors.conteudo?.message}>
        <Textarea
          placeholder="Descreva os temas e módulos abordados..."
          className="min-h-[80px] resize-y"
          {...register('conteudo')}
        />
      </FormField>

      <FormField label="Objetivo" error={errors.objetivo?.message}>
        <Textarea
          placeholder="Qual o objetivo deste treinamento?"
          className="min-h-[80px] resize-y"
          {...register('objetivo')}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Carga Horária (horas)" error={errors.cargaHoraria?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              className="pr-14"
              {...register('cargaHoraria')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              horas
            </span>
          </div>
        </FormField>
        <FormField label="Empresa Parceira" error={errors.empresaParceiraId?.message}>
          <Controller
            control={control}
            name="empresaParceiraId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField
          label="Quantidade de Pessoas Treinadas"
          error={errors.quantidadePessoas?.message}
        >
          <Input type="number" min={1} placeholder="0" {...register('quantidadePessoas')} />
        </FormField>
        <FormField label="Data do Treinamento" error={errors.dataTreinamento?.message}>
          <Input type="date" {...register('dataTreinamento')} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Índice de Satisfação (%)" error={errors.indiceSatisfacao?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="pr-8"
              {...register('indiceSatisfacao')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              %
            </span>
          </div>
        </FormField>
        <FormField label="Índice de Aprovação (%)" error={errors.indiceAprovacao?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="pr-8"
              {...register('indiceAprovacao')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              %
            </span>
          </div>
        </FormField>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 transition-all"
      >
        {isSubmitting ? 'Salvando...' : 'Salvar Treinamento'}
      </Button>
    </form>
  )
}

// ---------- Colaborador Form ----------
function ColaboradorForm({
  empresas,
  colaboradores,
  tenantId,
  formatColaboradorLabel,
  isColaboradorLimited,
  colaboradorLogado,
  onSuccess,
}: {
  empresas: EmpresaParceira[]
  colaboradores: ColaboradorWithSetor[]
  tenantId: string | null
  formatColaboradorLabel: (c: ColaboradorWithSetor) => string
  isColaboradorLimited: boolean
  colaboradorLogado: { id: string; nome: string } | null
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ColaboradorForm>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: {
      colaboradores: colaboradorLogado && isColaboradorLimited
        ? [{ colaboradorId: colaboradorLogado.id }]
        : [{ colaboradorId: '' }],
    },
    mode: 'onChange',
  })

  useEffect(() => {
    if (isColaboradorLimited && colaboradorLogado) {
      reset({ colaboradores: [{ colaboradorId: colaboradorLogado.id }] }, { keepDefaultValues: false })
    }
  }, [isColaboradorLimited, colaboradorLogado, reset])

  const { fields, append, remove } = useFieldArray({ control, name: 'colaboradores' })

  const onSubmit = async (data: ColaboradorForm) => {
    if (!tenantId) {
      toast.error('Tenant não identificado. Selecione um tenant.')
      return
    }
    const supabase = createClient()
    try {
      const { data: treinamento, error: err1 } = await supabase
        .from('treinamentos')
        .insert({
          tipo: 'colaborador',
          nome: data.nome,
          conteudo: data.conteudo,
          objetivo: data.objetivo,
          carga_horaria: data.cargaHoraria,
          empresa_parceira_id: data.empresaParceiraId,
          quantidade_pessoas: null,
          data_treinamento: data.dataTreinamento,
          indice_satisfacao: data.indiceSatisfacao,
          indice_aprovacao: data.indiceAprovacao,
          tenant_id: tenantId,
        })
        .select('id')
        .single()

      if (err1) throw err1
      if (!treinamento?.id) throw new Error('Falha ao criar treinamento')

      const colaboradorIds = data.colaboradores
        .map((c) => c.colaboradorId?.trim())
        .filter((id): id is string => !!id)
      const inserts = colaboradorIds.map((colaborador_id) => ({
        treinamento_id: treinamento.id,
        colaborador_id,
        tenant_id: tenantId,
      }))

      if (inserts.length > 0) {
        const { error: err2 } = await supabase
          .from('treinamento_colaboradores')
          .insert(inserts)

        if (err2) throw err2
      }
      onSuccess()
    } catch (error) {
      const err = error as { message?: string; details?: string; hint?: string } | null
      const msg =
        err && typeof err === 'object'
          ? (err.message || err.details || err.hint || null)
          : null
      const displayMsg =
        (typeof msg === 'string' && msg.trim()) ? msg.trim() : 'Não foi possível salvar o treinamento. Tente novamente.'
      console.error('Erro ao salvar treinamento:', { message: err?.message, details: err?.details, hint: err?.hint, raw: error })
      toast.error(displayMsg)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5"
    >
      <FormField label="Nome do Treinamento" error={errors.nome?.message}>
        <Input
          placeholder="Ex.: Excel Avançado para Finanças"
          {...register('nome')}
        />
      </FormField>

      <FormField label="Conteúdo Programático" error={errors.conteudo?.message}>
        <Textarea
          placeholder="Descreva os temas e módulos abordados..."
          className="min-h-[80px] resize-y"
          {...register('conteudo')}
        />
      </FormField>

      <FormField label="Objetivo" error={errors.objetivo?.message}>
        <Textarea
          placeholder="Qual o objetivo deste treinamento?"
          className="min-h-[80px] resize-y"
          {...register('objetivo')}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Carga Horária (horas)" error={errors.cargaHoraria?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              className="pr-14"
              {...register('cargaHoraria')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              horas
            </span>
          </div>
        </FormField>
        <FormField label="Empresa Parceira / Fornecedor" error={errors.empresaParceiraId?.message}>
          <Controller
            control={control}
            name="empresaParceiraId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <FormField label="Data do Treinamento" error={errors.dataTreinamento?.message}>
        <Input type="date" {...register('dataTreinamento')} />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Índice de Satisfação (%)" error={errors.indiceSatisfacao?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="pr-8"
              {...register('indiceSatisfacao')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              %
            </span>
          </div>
        </FormField>
        <FormField label="Índice de Aprovação (%)" error={errors.indiceAprovacao?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              className="pr-8"
              {...register('indiceAprovacao')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              %
            </span>
          </div>
        </FormField>
      </div>

      {/* Colaboradores Section */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium text-foreground">
          Colaboradores do Treinamento
        </Label>
        {isColaboradorLimited && colaboradorLogado ? (
          <div className="flex items-center gap-3 p-3 bg-muted/60 rounded-lg border border-border">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground">{colaboradorLogado.nome}</span>
          </div>
        ) : isColaboradorLimited ? (
          <p className="text-sm text-muted-foreground py-2">
            Colaborador não encontrado. Verifique se seu e-mail está vinculado ao cadastro.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ colaboradorId: '' })}
                className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
              >
                <PlusCircle className="w-4 h-4" />
                Adicionar Colaborador
              </Button>
            </div>
            {(errors.colaboradores as { message?: string } | undefined)?.message && (
              <FieldError
                message={(errors.colaboradores as { message?: string })?.message}
              />
            )}
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border"
                >
                  <div className="flex-1">
                    <Controller
                      control={control}
                      name={`colaboradores.${index}.colaboradorId`}
                      render={({ field: f }) => (
                        <Select
                          value={f.value || undefined}
                          onValueChange={f.onChange}
                        >
                          <SelectTrigger className="w-full bg-card">
                            <SelectValue placeholder="Selecione o colaborador" />
                          </SelectTrigger>
                          <SelectContent>
                            {colaboradores.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {formatColaboradorLabel(c)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError
                      message={
                        errors.colaboradores?.[index]?.colaboradorId?.message
                      }
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Remover colaborador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || (isColaboradorLimited && !colaboradorLogado)}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 transition-all"
      >
        {isSubmitting ? 'Salvando...' : 'Salvar Treinamento'}
      </Button>
    </form>
  )
}
