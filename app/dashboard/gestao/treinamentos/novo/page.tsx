'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { PlusCircle, Trash2, Building2, Users, FileSpreadsheet, Lock, Copy, Upload, X } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TreinamentoImportDialog } from '@/components/treinamento-import-dialog'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx-js-style'
import { parseExcelFile, getExcelValue } from '@/lib/excel-utils'

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
})

const parceiroSchema = baseSchema

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
  email: string | null
  setor_id: string | null
  setores?: { nome: string } | null
}

interface CatalogoItem {
  id: string
  titulo: string
  objetivo: string | null
  conteudo_programatico: string | null
  carga_horaria: number | null
}

interface FormularioPesquisa {
  id: string
  nome: string
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
  const [catalogoItems, setCatalogoItems] = useState<CatalogoItem[]>([])
  const [formulariosPesquisa, setFormulariosPesquisa] = useState<FormularioPesquisa[]>([])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (user && !canRegistrar) {
      router.replace('/dashboard/gestao')
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
        const [empRes, colRes, catRes, formRes] = await Promise.all([
          supabase
            .from('empresas_parceiras')
            .select('id, nome')
            .eq('tenant_id', activeTenantId)
            .order('nome', { ascending: true }),
          supabase
            .from('colaboradores')
            .select('id, nome, email, setor_id')
            .eq('tenant_id', activeTenantId)
            .order('nome'),
          supabase
            .from('catalogo_treinamentos')
            .select('id, titulo, objetivo, conteudo_programatico, carga_horaria')
            .eq('tenant_id', activeTenantId)
            .eq('status', 'ativo')
            .order('titulo', { ascending: true }),
          supabase
            .from('pesquisa_formularios')
            .select('id, nome')
            .eq('tenant_id', activeTenantId)
            .eq('ativo', true)
            .order('nome', { ascending: true }),
        ])
        if (empRes.error) throw empRes.error
        if (colRes.error) throw colRes.error
        if (catRes.error) throw catRes.error
        if (formRes.error) throw formRes.error
        setEmpresas(empRes.data ?? [])
        setColaboradores((colRes.data as ColaboradorWithSetor[]) ?? [])
        setCatalogoItems((catRes.data as CatalogoItem[]) ?? [])
        setFormulariosPesquisa((formRes.data as FormularioPesquisa[]) ?? [])
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
            catalogoItems={catalogoItems}
            formulariosPesquisa={formulariosPesquisa}
            tenantId={activeTenantId}
            onSuccess={() => {
              toast.success('Treinamento salvo com sucesso.')
              router.push('/dashboard/gestao/historico')
            }}
          />
        </TabsContent>
        )}

        {canRegistrarColaborador && (
        <TabsContent value="colaborador" className="mt-6">
          <ColaboradorForm
            empresas={empresas}
            colaboradores={colaboradores}
            catalogoItems={catalogoItems}
            formulariosPesquisa={formulariosPesquisa}
            tenantId={activeTenantId}
            formatColaboradorLabel={formatColaboradorLabel}
            isColaboradorLimited={isColaboradorLimited}
            colaboradorLogado={colaboradorLogado}
            onSuccess={() => {
              toast.success('Treinamento salvo com sucesso.')
              router.push('/dashboard/gestao/historico')
            }}
          />
        </TabsContent>
        )}
      </Tabs>

      <TreinamentoImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        empresas={empresas}
        colaboradores={colaboradores.map((c) => ({ id: c.id, nome: c.nome, email: c.email }))}
        treinamentosExistentes={treinamentosExistentes}
        onImportParceiro={async (data) => {
          if (!activeTenantId) throw new Error('Tenant não identificado')
          const supabaseClient = createClient()
          for (const row of data) {
            const { data: inserted, error } = await supabaseClient
              .from('treinamentos')
              .insert({
                tipo: 'parceiro',
                nome: row.nome,
                conteudo: row.conteudo ?? '',
                objetivo: row.objetivo ?? '',
                carga_horaria: row.carga_horaria,
                empresa_parceira_id: row.empresa_parceira_id,
                quantidade_pessoas: 0,
                data_treinamento: row.data_treinamento,
                indice_satisfacao: row.indice_satisfacao,
                tenant_id: activeTenantId,
              })
              .select('id')
              .single()
            if (error) throw error
            const treinamentoId = (inserted as { id: string }).id
            const participantes = (row._participantes as { nome: string; email: string }[]) ?? []
            if (participantes.length > 0) {
              await supabaseClient.from('treinamento_parceiros').insert(
                participantes.map((p) => ({
                  treinamento_id: treinamentoId,
                  tenant_id: activeTenantId,
                  nome: p.nome,
                  email: p.email,
                }))
              )
              await supabaseClient
                .from('treinamentos')
                .update({ quantidade_pessoas: participantes.length })
                .eq('id', treinamentoId)
            }
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
                tenant_id: activeTenantId,
              })
              .select('id')
              .single()
            if (err1) throw err1
            const treinamentoId = (inserted as { id: string }).id
            const participantes = (row._participantes as { nome: string; email: string }[]) ?? []
            let colabIds: string[] = []
            if (participantes.length > 0) {
              const { data: colabs } = await supabaseClient
                .from('colaboradores')
                .select('id, email')
                .eq('tenant_id', activeTenantId)
                .in('email', participantes.map((p) => p.email))
              const emailToId = new Map((colabs ?? []).map((c) => [(c.email ?? '').toLowerCase(), c.id]))
              for (const p of participantes) {
                const id = emailToId.get(p.email.toLowerCase())
                if (id) colabIds.push(id)
              }
            }
            if (colabIds.length > 0) {
              const rows = colabIds.map((colaborador_id: string) => ({
                treinamento_id: treinamentoId,
                colaborador_id,
                tenant_id: activeTenantId,
              }))
              const { error: err2 } = await supabaseClient
                .from('treinamento_colaboradores')
                .insert(rows)
              if (err2) throw err2
              await supabaseClient
                .from('treinamentos')
                .update({ quantidade_pessoas: colabIds.length })
                .eq('id', treinamentoId)
            }
          }
        }}
        onSuccess={() => {
          toast.success('Treinamentos importados com sucesso.')
          router.push('/dashboard/gestao/historico')
        }}
      />
    </div>
  )
}

// ---------- Parceiro Form ----------
function ParceiroForm({
  empresas,
  catalogoItems,
  formulariosPesquisa,
  tenantId,
  onSuccess,
}: {
  empresas: EmpresaParceira[]
  catalogoItems: CatalogoItem[]
  formulariosPesquisa: FormularioPesquisa[]
  tenantId: string | null
  onSuccess: () => void
}) {
  const router = useRouter()
  const [catalogoItemSelecionado, setCatalogoItemSelecionado] = useState<string | null>(null)
  const [modoSatisfacao, setModoSatisfacao] = useState<'manual' | 'pesquisa'>('manual')
  const [formularioSelecionado, setFormularioSelecionado] = useState<string | null>(null)
  const [linksDialogOpen, setLinksDialogOpen] = useState(false)
  const [linksGerados, setLinksGerados] = useState<{ token: string; respondente_nome: string | null }[]>([])
  const [parceiros, setParceiros] = useState<{ nome: string; email: string }[]>([])
  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [importEtapa, setImportEtapa] = useState<1 | 2 | 3>(1)
  const [dadosLidos, setDadosLidos] = useState<{ nome: string; email: string }[]>([])
  const [fileImportado, setFileImportado] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleParseFile = async (file: File) => {
    try {
      const rows = await parseExcelFile(file)
      const aliases = { nome: ['Nome', 'nome'], email: ['E-mail', 'E-mail', 'email'] }
      const parsed: { nome: string; email: string }[] = []
      for (const row of rows) {
        const nome = String(getExcelValue(row, 'nome', aliases) ?? '').trim()
        const email = String(getExcelValue(row, 'email', aliases) ?? '').trim()
        if (!nome && !email) continue
        parsed.push({ nome, email })
      }
      const headerKeys = rows[0] ? Object.keys(rows[0]).map((k) => k.toLowerCase()) : []
      const hasNome = headerKeys.some((k) => k.includes('nome'))
      const hasEmail = headerKeys.some((k) => k.includes('e-mail') || k.includes('email'))
      if (!hasNome || !hasEmail) {
        toast.error('O arquivo deve ter colunas "Nome" e "E-mail".')
        setDadosLidos([])
        return
      }
      setDadosLidos(parsed)
      if (parsed.length === 0) toast.info('Nenhum dado válido encontrado na planilha.')
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique o formato.')
      setDadosLidos([])
    }
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
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
    const usarPesquisa = modoSatisfacao === 'pesquisa' && !!formularioSelecionado
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
          quantidade_pessoas: parceiros.length || 0,
          data_treinamento: data.dataTreinamento,
          indice_satisfacao: usarPesquisa ? null : data.indiceSatisfacao,
          tenant_id: tenantId,
        })
        .select('id')
        .single()

      if (error) throw error
      const novoTreinamentoId = (row as { id: string }).id

      if (parceiros.length > 0) {
        const { error: parceirosError } = await supabase.from('treinamento_parceiros').insert(
          parceiros.map((p) => ({
            treinamento_id: novoTreinamentoId,
            tenant_id: tenantId,
            nome: p.nome,
            email: p.email,
          }))
        )
        if (parceirosError) throw parceirosError
      }

      let abriuDialog = false
      if (usarPesquisa && formularioSelecionado) {
        try {
          const tokenRows =
            parceiros.length > 0
              ? parceiros.map((p) => ({
                  tenant_id: tenantId,
                  treinamento_id: novoTreinamentoId,
                  formulario_id: formularioSelecionado,
                  token: crypto.randomUUID(),
                  respondente_nome: p.nome?.trim() || null,
                  respondente_email: p.email?.trim() || null,
                  respondente_tipo: 'parceiro' as const,
                  usado: false,
                }))
              : [
                  {
                    tenant_id: tenantId,
                    treinamento_id: novoTreinamentoId,
                    formulario_id: formularioSelecionado,
                    token: crypto.randomUUID(),
                    respondente_nome: null,
                    respondente_email: null,
                    respondente_tipo: 'parceiro' as const,
                    usado: false,
                  },
                ]
          const { error: tokenError } = await supabase.from('pesquisa_tokens').insert(tokenRows)
          if (tokenError) throw tokenError
          setLinksGerados(tokenRows.map((r) => ({ token: r.token, respondente_nome: r.respondente_nome })))
          setLinksDialogOpen(true)
          abriuDialog = true
          fetch('/api/pesquisa/enviar-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              treinamento_id: novoTreinamentoId,
              tenant_id: tenantId,
              formulario_id: formularioSelecionado,
            }),
          })
            .then(async (res) => {
              const data = await res.json()
              if (res.ok) {
                toast.success(`E-mails da pesquisa enviados: ${data.enviados}`)
              }
            })
            .catch(() => {})
        } catch (tokenErr) {
          console.error('Erro ao gerar link de pesquisa:', tokenErr)
          toast.error('Treinamento salvo, mas não foi possível gerar o link de pesquisa.')
        }
      }

      if (!abriuDialog) onSuccess()
    } catch (error) {
      console.error('Erro ao salvar treinamento:', error)
      toast.error('Não foi possível salvar o treinamento. Tente novamente.')
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const copyLink = (token: string) => {
    const url = `${origin}/pesquisa/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado.'))
  }

  const copyAllLinks = () => {
    const urls = linksGerados.map((l) => `${origin}/pesquisa/${l.token}`).join('\n')
    navigator.clipboard.writeText(urls).then(() => toast.success('Todos os links copiados.'))
  }

  const handleFecharLinkDialog = () => {
    setLinksDialogOpen(false)
    setLinksGerados([])
    router.push('/dashboard/gestao/historico')
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5"
    >
      <FormField label="Nome do Treinamento" error={errors.nome?.message}>
        <Controller
          control={control}
          name="nome"
          render={({ field }) => (
            <Select
              value={catalogoItemSelecionado ?? (catalogoItems.find((i) => i.titulo === field.value)?.id ?? '')}
              onValueChange={(value) => {
                const item = catalogoItems.find((i) => i.id === value)
                if (item) {
                  setCatalogoItemSelecionado(item.id)
                  field.onChange(item.titulo)
                  setValue('objetivo', item.objetivo ?? '')
                  setValue('conteudo', item.conteudo_programatico ?? '')
                  setValue('cargaHoraria', item.carga_horaria ?? 0)
                } else {
                  setCatalogoItemSelecionado(null)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione do catálogo ou digite abaixo" />
              </SelectTrigger>
              <SelectContent>
                {catalogoItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {catalogoItems.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Nenhum item ativo no catálogo. <Link href="/dashboard/gestao/catalogo" className="text-primary underline">Catálogo</Link>
          </p>
        )}
      </FormField>

      <FormField label="Conteúdo Programático" error={errors.conteudo?.message}>
        <div className="relative">
          <Textarea
            placeholder="Descreva os temas e módulos abordados..."
            className={cn('min-h-[80px] resize-y', catalogoItemSelecionado && 'pr-10')}
            disabled={!!catalogoItemSelecionado}
            {...register('conteudo')}
          />
          {catalogoItemSelecionado && (
            <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
      </FormField>

      <FormField label="Objetivo" error={errors.objetivo?.message}>
        <div className="relative">
          <Textarea
            placeholder="Qual o objetivo deste treinamento?"
            className={cn('min-h-[80px] resize-y', catalogoItemSelecionado && 'pr-10')}
            disabled={!!catalogoItemSelecionado}
            {...register('objetivo')}
          />
          {catalogoItemSelecionado && (
            <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(100px,160px)_minmax(120px,1fr)_1fr] gap-4">
        <FormField label="Carga Horária (horas)" error={errors.cargaHoraria?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              className={cn('pr-14', catalogoItemSelecionado && 'pr-10')}
              disabled={!!catalogoItemSelecionado}
              {...register('cargaHoraria')}
            />
            {catalogoItemSelecionado && (
              <Lock className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            )}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              horas
            </span>
          </div>
        </FormField>
        <FormField label="Data do Treinamento" error={errors.dataTreinamento?.message}>
          <Input type="date" {...register('dataTreinamento')} />
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

      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Índice de Satisfação</Label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => { setModoSatisfacao('manual'); setFormularioSelecionado(null) }}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium transition-colors',
              modoSatisfacao === 'manual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => { setModoSatisfacao('pesquisa'); setValue('indiceSatisfacao', 0) }}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium transition-colors',
              modoSatisfacao === 'pesquisa'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            Via Pesquisa
          </button>
        </div>
        {modoSatisfacao === 'manual' && (
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
          </div>
        )}
        {modoSatisfacao === 'pesquisa' && (
          <div className="space-y-2">
            {formulariosPesquisa.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum formulário de pesquisa ativo. Crie um em{' '}
                <Link href="/dashboard/gestao/pesquisas" className="text-[#00C9A7] underline">
                  Pesquisas
                </Link>
                .
              </p>
            ) : (
              <FormField label="Formulário de pesquisa">
                <Select
                  value={formularioSelecionado ?? ''}
                  onValueChange={(v) => setFormularioSelecionado(v || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o formulário" />
                  </SelectTrigger>
                  <SelectContent>
                    {formulariosPesquisa.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">
          Participantes do Treinamento ({parceiros.length} importados)
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setImportEtapa(1)
              setDadosLidos([])
              setFileImportado(null)
              setImportWizardOpen(true)
            }}
            className="border-[#00C9A7] text-[#00C9A7] hover:bg-[#00C9A7]/10"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar Planilha
          </Button>
        </div>
        {parceiros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum participante importado ainda.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {parceiros.map((p, idx) => (
                  <TableRow key={`${p.email}-${idx}`}>
                    <TableCell>{p.nome}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setParceiros((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remover"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || (modoSatisfacao === 'pesquisa' && !formularioSelecionado && formulariosPesquisa.length > 0)}
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 transition-all"
      >
        {isSubmitting ? 'Salvando...' : 'Salvar Treinamento'}
      </Button>

      <Dialog
        open={importWizardOpen}
        onOpenChange={(open) => {
          if (!open) {
            setImportEtapa(1)
            setDadosLidos([])
            setFileImportado(null)
          }
          setImportWizardOpen(open)
        }}
      >
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Participantes — Passo {importEtapa} de 3</DialogTitle>
          </DialogHeader>
          {importEtapa === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Baixe o template, preencha com Nome e E-mail dos participantes e volte para fazer o upload.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const wb = XLSX.utils.book_new()
                  const ws = XLSX.utils.aoa_to_sheet([
                    ['Nome', 'E-mail'],
                    ['João da Silva', 'joao@email.com'],
                    ['Maria Santos', 'maria@email.com'],
                  ])
                  XLSX.utils.book_append_sheet(wb, ws, 'Participantes')
                  XLSX.writeFile(wb, 'template-participantes.xlsx')
                }}
                className="border-[#00C9A7] text-[#00C9A7] hover:bg-[#00C9A7]/10"
              >
                Baixar Template
              </Button>
            </div>
          )}
          {importEtapa === 2 && (
            <div className="space-y-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  dragActive ? 'border-[#00C9A7] bg-[#00C9A7]/5' : 'border-muted-foreground/30 hover:border-[#00C9A7]/50'
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  const f = e.dataTransfer.files[0]
                  if (f?.name.match(/\.(xlsx|xls)$/i)) {
                    setFileImportado(f)
                    handleParseFile(f)
                  } else {
                    toast.error('Formato inválido. Use .xlsx ou .xls')
                  }
                }}
                onClick={() => fileInputRef?.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setFileImportado(f)
                      handleParseFile(f)
                    }
                  }}
                />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {fileImportado ? fileImportado.name : 'Arraste o arquivo ou clique para selecionar'}
                </p>
              </div>
            </div>
          )}
          {importEtapa === 3 && (() => {
            const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            const emails = dadosLidos.map((r) => (r.email || '').toLowerCase().trim())
            const validacoes = dadosLidos.map((r, i) => {
              const nome = String(r.nome ?? '').trim()
              const email = String(r.email ?? '').trim()
              if (!nome) return { ...r, erro: 'Nome obrigatório' }
              if (!email) return { ...r, erro: 'E-mail obrigatório' }
              if (!EMAIL_REGEX.test(email)) return { ...r, erro: 'E-mail inválido' }
              const dupIdx = emails.indexOf(email.toLowerCase())
              if (dupIdx !== -1 && dupIdx !== i) return { ...r, erro: 'E-mail duplicado' }
              return { ...r, erro: null }
            })
            const validos = validacoes.filter((v) => !v.erro)
            const comErro = validacoes.filter((v) => v.erro)
            return (
              <div className="space-y-4">
                <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validacoes.map((v, i) => (
                        <TableRow key={i}>
                          <TableCell>{v.nome}</TableCell>
                          <TableCell>{v.email}</TableCell>
                          <TableCell>
                            {v.erro ? (
                              <span className="text-destructive text-sm">❌ Erro: {v.erro}</span>
                            ) : (
                              <span className="text-emerald-600 text-sm">✅ Válido</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  {validos.length} válidos, {comErro.length} com erro
                </p>
                {comErro.length > 0 && (
                  <p className="text-sm text-destructive">Corrija os erros na planilha antes de importar</p>
                )}
              </div>
            )
          })()}
          <DialogFooter>
            {importEtapa === 1 && (
              <Button
                type="button"
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                onClick={() => setImportEtapa(2)}
              >
                Continuar
              </Button>
            )}
            {importEtapa === 2 && (
              <Button
                type="button"
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                disabled={dadosLidos.length === 0}
                onClick={() => setImportEtapa(3)}
              >
                Continuar
              </Button>
            )}
            {importEtapa === 3 && (() => {
              const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              const emails = dadosLidos.map((r) => (r.email || '').toLowerCase().trim())
              const validacoes = dadosLidos.map((r, i) => {
                const nome = String(r.nome ?? '').trim()
                const email = String(r.email ?? '').trim()
                if (!nome) return true
                if (!email) return true
                if (!EMAIL_REGEX.test(email)) return true
                const dupIdx = emails.indexOf(email.toLowerCase())
                if (dupIdx !== -1 && dupIdx !== i) return true
                return false
              })
              const temErro = validacoes.some(Boolean)
              return (
                <Button
                  type="button"
                  className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                  disabled={temErro}
                  onClick={() => {
                    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    const emails = dadosLidos.map((r) => (r.email || '').toLowerCase().trim())
                    const dadosValidos = dadosLidos.filter((r, i) => {
                      const nome = String(r.nome ?? '').trim()
                      const email = String(r.email ?? '').trim()
                      if (!nome || !email || !EMAIL_REGEX.test(email)) return false
                      const dupIdx = emails.indexOf(email.toLowerCase())
                      return dupIdx === i
                    })
                    setParceiros(dadosValidos)
                    setImportWizardOpen(false)
                    setImportEtapa(1)
                    setDadosLidos([])
                    setFileImportado(null)
                  }}
                >
                  Finalizar
                </Button>
              )
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={linksDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleFecharLinkDialog()
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Links de pesquisa gerados</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {linksGerados.map((l) => (
              <div
                key={l.token}
                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
              >
                <span className="flex-1 truncate text-sm">
                  {l.respondente_nome ? `${l.respondente_nome}: ` : ''}
                  {origin}/pesquisa/{l.token}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => copyLink(l.token)}
                  aria-label="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={copyAllLinks}>
              Copiar todos os links
            </Button>
            <Button
              type="button"
              className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              onClick={handleFecharLinkDialog}
            >
              Fechar e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

// ---------- Colaborador Form ----------
function ColaboradorForm({
  empresas,
  colaboradores,
  catalogoItems,
  formulariosPesquisa,
  tenantId,
  formatColaboradorLabel,
  isColaboradorLimited,
  colaboradorLogado,
  onSuccess,
}: {
  empresas: EmpresaParceira[]
  colaboradores: ColaboradorWithSetor[]
  catalogoItems: CatalogoItem[]
  formulariosPesquisa: FormularioPesquisa[]
  tenantId: string | null
  formatColaboradorLabel: (c: ColaboradorWithSetor) => string
  isColaboradorLimited: boolean
  colaboradorLogado: { id: string; nome: string } | null
  onSuccess: () => void
}) {
  const router = useRouter()
  const [catalogoItemSelecionado, setCatalogoItemSelecionado] = useState<string | null>(null)
  const [modoSatisfacao, setModoSatisfacao] = useState<'manual' | 'pesquisa'>('manual')
  const [formularioSelecionado, setFormularioSelecionado] = useState<string | null>(null)
  const [linksDialogOpen, setLinksDialogOpen] = useState(false)
  const [linksGerados, setLinksGerados] = useState<{ token: string; respondente_nome: string | null }[]>([])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    watch,
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

  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [importEtapa, setImportEtapa] = useState<1 | 2 | 3>(1)
  const [dadosLidos, setDadosLidos] = useState<{ nome: string; email: string }[]>([])
  const [dadosValidados, setDadosValidados] = useState<
    { nome: string; email: string; status: 'valido' | 'erro'; motivo?: string; colaboradorId?: string }[]
  >([])
  const [dragActive, setDragActive] = useState(false)
  const [fileImportado, setFileImportado] = useState<File | null>(null)
  const [validando, setValidando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleParseFileColaborador = async (file: File) => {
    try {
      const rows = await parseExcelFile(file)
      const aliases = { nome: ['Nome', 'nome'], email: ['E-mail', 'E-mail', 'email'] }
      const parsed: { nome: string; email: string }[] = []
      for (const row of rows) {
        const nome = String(getExcelValue(row, 'nome', aliases) ?? '').trim()
        const email = String(getExcelValue(row, 'email', aliases) ?? '').trim()
        if (!nome && !email) continue
        parsed.push({ nome, email })
      }
      const headerKeys = rows[0] ? Object.keys(rows[0]).map((k) => k.toLowerCase()) : []
      const hasNome = headerKeys.some((k) => k.includes('nome'))
      const hasEmail = headerKeys.some((k) => k.includes('e-mail') || k.includes('email'))
      if (!hasNome || !hasEmail) {
        toast.error('O arquivo deve ter colunas "Nome" e "E-mail".')
        setDadosLidos([])
        return
      }
      setDadosLidos(parsed)
      if (parsed.length === 0) toast.info('Nenhum dado válido encontrado na planilha.')
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique o formato.')
      setDadosLidos([])
    }
  }

  useEffect(() => {
    if (isColaboradorLimited && colaboradorLogado) {
      reset({ colaboradores: [{ colaboradorId: colaboradorLogado.id }] }, { keepDefaultValues: false })
    }
  }, [isColaboradorLimited, colaboradorLogado, reset])

  useEffect(() => {
    if (importEtapa !== 3 || dadosLidos.length === 0) {
      setDadosValidados([])
      setValidando(false)
      return
    }
    if (!tenantId) {
      setDadosValidados(
        dadosLidos.map((r) => ({
          ...r,
          status: 'erro' as const,
          motivo: 'Tenant não identificado',
        }))
      )
      setValidando(false)
      return
    }
    const runValidation = async () => {
      setValidando(true)
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const emails = dadosLidos.map((r) => (r.email || '').toLowerCase().trim())
      const basic: { nome: string; email: string; status: 'valido' | 'erro'; motivo?: string }[] = dadosLidos.map((r, i) => {
        const nome = String(r.nome ?? '').trim()
        const email = String(r.email ?? '').trim()
        if (!nome) return { ...r, status: 'erro' as const, motivo: 'Nome obrigatório' }
        if (!email) return { ...r, status: 'erro' as const, motivo: 'E-mail obrigatório' }
        if (!EMAIL_REGEX.test(email)) return { ...r, status: 'erro' as const, motivo: 'E-mail inválido' }
        const dupIdx = emails.indexOf(email.toLowerCase())
        if (dupIdx !== -1 && dupIdx !== i) return { ...r, status: 'erro' as const, motivo: 'E-mail duplicado' }
        return { ...r, status: 'valido' as const }
      })
      const emailsValidos = basic.filter((b) => b.status === 'valido').map((b) => (b.email || '').toLowerCase().trim())
      const supabase = createClient()
      const colaboradoresExistentes = await Promise.all(
        emailsValidos.map((email) =>
          supabase
            .from('colaboradores')
            .select('id, nome, email')
            .eq('tenant_id', tenantId)
            .eq('email', email)
            .maybeSingle()
        )
      )
      const emailToColab = new Map<string | null, { id: string }>()
      colaboradoresExistentes.forEach((res, idx) => {
        const email = emailsValidos[idx]
        if (res.data?.id) emailToColab.set(email, { id: res.data.id })
      })
      const final: { nome: string; email: string; status: 'valido' | 'erro'; motivo?: string; colaboradorId?: string }[] = basic.map((b) => {
        if (b.status === 'erro') return { ...b, colaboradorId: undefined }
        const emailNorm = (b.email || '').toLowerCase().trim()
        const colab = emailToColab.get(emailNorm)
        if (!colab) return { ...b, status: 'erro' as const, motivo: 'Colaborador não cadastrado no sistema' }
        return { ...b, colaboradorId: colab.id }
      })
      setDadosValidados(final)
      setValidando(false)
    }
    runValidation()
  }, [importEtapa, dadosLidos, tenantId])

  const { fields, append, remove } = useFieldArray({ control, name: 'colaboradores' })

  const onSubmit = async (data: ColaboradorForm) => {
    if (!tenantId) {
      toast.error('Tenant não identificado. Selecione um tenant.')
      return
    }
    const supabase = createClient()
    const usarPesquisa = modoSatisfacao === 'pesquisa' && !!formularioSelecionado
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
          indice_satisfacao: usarPesquisa ? null : data.indiceSatisfacao,
          tenant_id: tenantId,
        })
        .select('id')
        .single()

      if (err1) throw err1
      if (!treinamento?.id) throw new Error('Falha ao criar treinamento')
      const novoTreinamentoId = (treinamento as { id: string }).id

      const colaboradorIds = data.colaboradores
        .map((c) => c.colaboradorId?.trim())
        .filter((id): id is string => !!id)
      const inserts = colaboradorIds.map((colaborador_id) => ({
        treinamento_id: novoTreinamentoId,
        colaborador_id,
        tenant_id: tenantId,
      }))

      if (inserts.length > 0) {
        const { error: err2 } = await supabase
          .from('treinamento_colaboradores')
          .insert(inserts)

        if (err2) throw err2

        try {
          await fetch('/api/notificacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              treinamentoNome: data.nome,
              tenantId,
              colaboradorIds,
            }),
          })
        } catch (e) {
          console.warn('Falha ao disparar notificações:', e)
        }
      }

      let abriuDialog = false
      if (usarPesquisa && formularioSelecionado) {
        try {
          if (colaboradorIds.length > 0) {
            const { data: colaboradoresData } = await supabase
              .from('colaboradores')
              .select('id, nome, email')
              .in('id', colaboradorIds)
              .eq('tenant_id', tenantId)
            const colaboradoresMap = new Map(
              (colaboradoresData ?? []).map((c: { id: string; nome: string | null; email: string | null }) => [
                c.id,
                { nome: c.nome?.trim() || null, email: c.email?.trim() || null },
              ])
            )
            const tokenRows = colaboradorIds.map((colaboradorId) => {
              const col = colaboradoresMap.get(colaboradorId)
              return {
                tenant_id: tenantId,
                treinamento_id: novoTreinamentoId,
                formulario_id: formularioSelecionado,
                token: crypto.randomUUID(),
                respondente_nome: col?.nome ?? null,
                respondente_email: col?.email ?? null,
                respondente_tipo: 'colaborador' as const,
                usado: false,
              }
            })
            const { error: tokenError } = await supabase.from('pesquisa_tokens').insert(tokenRows)
            if (tokenError) throw tokenError
            setLinksGerados(tokenRows.map((r) => ({ token: r.token, respondente_nome: r.respondente_nome })))
          } else {
            const token = crypto.randomUUID()
            const { error: tokenError } = await supabase.from('pesquisa_tokens').insert({
              tenant_id: tenantId,
              treinamento_id: novoTreinamentoId,
              formulario_id: formularioSelecionado,
              token,
              respondente_nome: null,
              respondente_email: null,
              respondente_tipo: 'colaborador',
              usado: false,
            })
            if (tokenError) throw tokenError
            setLinksGerados([{ token, respondente_nome: null }])
          }
          setLinksDialogOpen(true)
          abriuDialog = true
          fetch('/api/pesquisa/enviar-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              treinamento_id: novoTreinamentoId,
              tenant_id: tenantId,
              formulario_id: formularioSelecionado,
            }),
          })
            .then(async (res) => {
              const data = await res.json()
              if (res.ok) {
                toast.success(`E-mails da pesquisa enviados: ${data.enviados}`)
              }
            })
            .catch(() => {})
        } catch (tokenErr) {
          console.error('Erro ao gerar links de pesquisa:', tokenErr)
          toast.error('Treinamento salvo, mas não foi possível gerar os links de pesquisa.')
        }
      }

      if (!abriuDialog) onSuccess()
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

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const copyLink = (token: string) => {
    const url = `${origin}/pesquisa/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado.'))
  }
  const copyAllLinks = () => {
    const urls = linksGerados.map((l) => `${origin}/pesquisa/${l.token}`).join('\n')
    navigator.clipboard.writeText(urls).then(() => toast.success('Todos os links copiados.'))
  }

  const handleFecharLinkDialog = () => {
    setLinksDialogOpen(false)
    setLinksGerados([])
    router.push('/dashboard/gestao/historico')
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-5"
    >
      <FormField label="Nome do Treinamento" error={errors.nome?.message}>
        <Controller
          control={control}
          name="nome"
          render={({ field }) => (
            <Select
              value={catalogoItemSelecionado ?? (catalogoItems.find((i) => i.titulo === field.value)?.id ?? '')}
              onValueChange={(value) => {
                const item = catalogoItems.find((i) => i.id === value)
                if (item) {
                  setCatalogoItemSelecionado(item.id)
                  field.onChange(item.titulo)
                  setValue('objetivo', item.objetivo ?? '')
                  setValue('conteudo', item.conteudo_programatico ?? '')
                  setValue('cargaHoraria', item.carga_horaria ?? 0)
                } else {
                  setCatalogoItemSelecionado(null)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione do catálogo" />
              </SelectTrigger>
              <SelectContent>
                {catalogoItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {catalogoItems.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Nenhum item ativo no catálogo. <Link href="/dashboard/gestao/catalogo" className="text-primary underline">Catálogo</Link>
          </p>
        )}
      </FormField>

      <FormField label="Conteúdo Programático" error={errors.conteudo?.message}>
        <div className="relative">
          <Textarea
            placeholder="Descreva os temas e módulos abordados..."
            className={cn('min-h-[80px] resize-y', catalogoItemSelecionado && 'pr-10')}
            disabled={!!catalogoItemSelecionado}
            {...register('conteudo')}
          />
          {catalogoItemSelecionado && (
            <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
      </FormField>

      <FormField label="Objetivo" error={errors.objetivo?.message}>
        <div className="relative">
          <Textarea
            placeholder="Qual o objetivo deste treinamento?"
            className={cn('min-h-[80px] resize-y', catalogoItemSelecionado && 'pr-10')}
            disabled={!!catalogoItemSelecionado}
            {...register('objetivo')}
          />
          {catalogoItemSelecionado && (
            <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(100px,160px)_minmax(120px,1fr)_1fr] gap-4">
        <FormField label="Carga Horária (horas)" error={errors.cargaHoraria?.message}>
          <div className="relative">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="0"
              className={cn('pr-14', catalogoItemSelecionado && 'pr-10')}
              disabled={!!catalogoItemSelecionado}
              {...register('cargaHoraria')}
            />
            {catalogoItemSelecionado && (
              <Lock className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            )}
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              horas
            </span>
          </div>
        </FormField>
        <FormField label="Data do Treinamento" error={errors.dataTreinamento?.message}>
          <Input type="date" {...register('dataTreinamento')} />
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

      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Índice de Satisfação</Label>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => { setModoSatisfacao('manual'); setFormularioSelecionado(null) }}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium transition-colors',
              modoSatisfacao === 'manual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => { setModoSatisfacao('pesquisa'); setValue('indiceSatisfacao', 0) }}
            className={cn(
              'flex-1 px-3 py-2 text-sm font-medium transition-colors',
              modoSatisfacao === 'pesquisa'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            Via Pesquisa
          </button>
        </div>
        {modoSatisfacao === 'manual' && (
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
          </div>
        )}
        {modoSatisfacao === 'pesquisa' && (
          <div className="space-y-2">
            {formulariosPesquisa.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum formulário de pesquisa ativo. Crie um em{' '}
                <Link href="/dashboard/gestao/pesquisas" className="text-[#00C9A7] underline">
                  Pesquisas
                </Link>
                .
              </p>
            ) : (
              <FormField label="Formulário de pesquisa">
                <Select
                  value={formularioSelecionado ?? ''}
                  onValueChange={(v) => setFormularioSelecionado(v || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o formulário" />
                  </SelectTrigger>
                  <SelectContent>
                    {formulariosPesquisa.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
        )}
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
            <div className="flex items-center gap-2">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportEtapa(1)
                  setDadosLidos([])
                  setDadosValidados([])
                  setFileImportado(null)
                  setImportWizardOpen(true)
                }}
                className="gap-2 border-[#00C9A7] text-[#00C9A7] hover:bg-[#00C9A7]/10"
              >
                <Upload className="w-4 h-4" />
                Importar Planilha
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
        disabled={
          isSubmitting ||
          (isColaboradorLimited && !colaboradorLogado) ||
          (modoSatisfacao === 'pesquisa' && !formularioSelecionado && formulariosPesquisa.length > 0)
        }
        className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/20 transition-all"
      >
        {isSubmitting ? 'Salvando...' : 'Salvar Treinamento'}
      </Button>

      <Dialog
        open={importWizardOpen}
        onOpenChange={(open) => {
          if (!open) {
            setImportEtapa(1)
            setDadosLidos([])
            setDadosValidados([])
            setFileImportado(null)
          }
          setImportWizardOpen(open)
        }}
      >
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Colaboradores — Passo {importEtapa} de 3</DialogTitle>
          </DialogHeader>
          {importEtapa === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Baixe o template, preencha com Nome e E-mail dos colaboradores e volte para fazer o upload.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const wb = XLSX.utils.book_new()
                  const ws = XLSX.utils.aoa_to_sheet([
                    ['Nome', 'E-mail'],
                    ['João da Silva', 'joao@email.com'],
                    ['Maria Santos', 'maria@email.com'],
                  ])
                  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores')
                  XLSX.writeFile(wb, 'template-colaboradores.xlsx')
                }}
                className="border-[#00C9A7] text-[#00C9A7] hover:bg-[#00C9A7]/10"
              >
                Baixar Template
              </Button>
            </div>
          )}
          {importEtapa === 2 && (
            <div className="space-y-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  dragActive ? 'border-[#00C9A7] bg-[#00C9A7]/5' : 'border-muted-foreground/30 hover:border-[#00C9A7]/50'
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  const f = e.dataTransfer.files[0]
                  if (f?.name.match(/\.(xlsx|xls)$/i)) {
                    setFileImportado(f)
                    handleParseFileColaborador(f)
                  } else {
                    toast.error('Formato inválido. Use .xlsx ou .xls')
                  }
                }}
                onClick={() => fileInputRef?.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setFileImportado(f)
                      handleParseFileColaborador(f)
                    }
                  }}
                />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {fileImportado ? fileImportado.name : 'Arraste o arquivo ou clique para selecionar'}
                </p>
              </div>
            </div>
          )}
          {importEtapa === 3 && (
            <div className="space-y-4">
              {validando ? (
                <p className="text-sm text-muted-foreground">Validando colaboradores...</p>
              ) : (
                <>
                  <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosValidados.map((v, i) => (
                          <TableRow key={i}>
                            <TableCell>{v.nome}</TableCell>
                            <TableCell>{v.email}</TableCell>
                            <TableCell>
                              {v.status === 'erro' ? (
                                <span className="text-destructive text-sm">❌ Erro: {v.motivo}</span>
                              ) : (
                                <span className="text-emerald-600 text-sm">✅ Válido</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dadosValidados.filter((d) => d.status === 'valido').length} válidos,{' '}
                    {dadosValidados.filter((d) => d.status === 'erro').length} com erro
                  </p>
                  {dadosValidados.some((d) => d.status === 'erro') && (
                    <p className="text-sm text-destructive">Corrija todos os erros antes de importar</p>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {importEtapa === 1 && (
              <Button
                type="button"
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                onClick={() => setImportEtapa(2)}
              >
                Continuar
              </Button>
            )}
            {importEtapa === 2 && (
              <Button
                type="button"
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                disabled={dadosLidos.length === 0}
                onClick={() => setImportEtapa(3)}
              >
                Continuar
              </Button>
            )}
            {importEtapa === 3 && !validando && (
              <Button
                type="button"
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                disabled={dadosValidados.some((d) => d.status === 'erro')}
                onClick={() => {
                  const currentIds = (watch('colaboradores') ?? []).map((c) => c.colaboradorId).filter(Boolean) as string[]
                  for (const v of dadosValidados) {
                    if (v.status === 'valido' && v.colaboradorId && !currentIds.includes(v.colaboradorId)) {
                      append({ colaboradorId: v.colaboradorId })
                      currentIds.push(v.colaboradorId)
                    }
                  }
                  setImportWizardOpen(false)
                  setImportEtapa(1)
                  setDadosLidos([])
                  setDadosValidados([])
                  setFileImportado(null)
                }}
              >
                Finalizar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={linksDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleFecharLinkDialog()
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Links de pesquisa gerados</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {linksGerados.map((l) => (
              <div
                key={l.token}
                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
              >
                <span className="flex-1 truncate text-sm">
                  {l.respondente_nome ? `${l.respondente_nome}: ` : ''}
                  {origin}/pesquisa/{l.token}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => copyLink(l.token)}
                  aria-label="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={copyAllLinks}>
              Copiar todos os links
            </Button>
            <Button
              type="button"
              className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              onClick={handleFecharLinkDialog}
            >
              Fechar e continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
