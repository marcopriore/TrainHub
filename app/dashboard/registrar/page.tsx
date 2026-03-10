'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { PlusCircle, Trash2, Upload, Building2, Users, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ---------- Schemas ----------
const baseSchema = z.object({
  nome: z.string().min(3, 'Informe o nome do treinamento'),
  conteudo: z.string().min(10, 'Descreva o conteúdo programático'),
  objetivo: z.string().min(10, 'Informe o objetivo do treinamento'),
  cargaHoraria: z.coerce.number().min(1, 'Informe a carga horária'),
  empresaParceira: z.string().min(2, 'Informe a empresa parceira'),
  data: z.string().min(1, 'Selecione a data do treinamento'),
  satisfacao: z.coerce.number().min(0).max(100, 'Valor entre 0 e 100'),
  aprovacao: z.coerce.number().min(0).max(100, 'Valor entre 0 e 100'),
})

const parceiroSchema = baseSchema.extend({
  quantidadePessoas: z.coerce.number().min(1, 'Informe a quantidade de pessoas'),
})

const colaboradorSchema = baseSchema.extend({
  colaboradores: z
    .array(
      z.object({
        nome: z.string().min(2, 'Nome obrigatório'),
        setor: z.string().min(1, 'Selecione o setor'),
      })
    )
    .min(1, 'Adicione ao menos um colaborador'),
})

type ParceiroForm = z.infer<typeof parceiroSchema>
type ColaboradorForm = z.infer<typeof colaboradorSchema>

const setores = ['RH', 'TI', 'Financeiro', 'Operações', 'Comercial', 'Outro']

// ---------- Shared Field Components ----------
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="text-destructive text-xs mt-1">{message}</span>
}

function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

// ---------- Parceiro Tab Form ----------
function ParceiroForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
  } = useForm<ParceiroForm>({ resolver: zodResolver(parceiroSchema) })

  const onSubmit = async (_data: ParceiroForm) => {
    await new Promise((r) => setTimeout(r, 800))
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Nome do Treinamento" error={errors.nome?.message}>
          <Input placeholder="Ex.: Gestão de Projetos Ágeis" {...register('nome')} />
        </FormField>
        <FormField label="Empresa Parceira" error={errors.empresaParceira?.message}>
          <Input placeholder="Ex.: Accenture" {...register('empresaParceira')} />
        </FormField>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <FormField label="Carga Horária (horas)" error={errors.cargaHoraria?.message}>
          <div className="relative">
            <Input type="number" min={1} placeholder="0" className="pr-14" {...register('cargaHoraria')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">horas</span>
          </div>
        </FormField>
        <FormField label="Quantidade de Pessoas Treinadas" error={errors.quantidadePessoas?.message}>
          <Input type="number" min={1} placeholder="0" {...register('quantidadePessoas')} />
        </FormField>
        <FormField label="Data do Treinamento" error={errors.data?.message}>
          <Input type="date" {...register('data')} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Índice de Satisfação (%)" error={errors.satisfacao?.message}>
          <div className="relative">
            <Input type="number" min={0} max={100} placeholder="0" className="pr-8" {...register('satisfacao')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </FormField>
        <FormField label="Índice de Aprovação — Nota da Prova (%)" error={errors.aprovacao?.message}>
          <div className="relative">
            <Input type="number" min={0} max={100} placeholder="0" className="pr-8" {...register('aprovacao')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </FormField>
      </div>

      <FormField label="Upload de Arquivo (opcional)">
        <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors group">
          <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm text-muted-foreground">Clique para enviar certificado ou material</span>
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" />
        </label>
      </FormField>

      {isSubmitSuccessful && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" /> Treinamento salvo com sucesso!
        </div>
      )}

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

// ---------- Colaborador Tab Form ----------
function ColaboradorForm() {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
  } = useForm<ColaboradorForm>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: { colaboradores: [{ nome: '', setor: '' }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'colaboradores' })

  const onSubmit = async (_data: ColaboradorForm) => {
    await new Promise((r) => setTimeout(r, 800))
    reset({ colaboradores: [{ nome: '', setor: '' }] })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Nome do Treinamento" error={errors.nome?.message}>
          <Input placeholder="Ex.: Excel Avançado para Finanças" {...register('nome')} />
        </FormField>
        <FormField label="Empresa Parceira / Fornecedor" error={errors.empresaParceira?.message}>
          <Input placeholder="Ex.: Udemy, Interno" {...register('empresaParceira')} />
        </FormField>
      </div>

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
            <Input type="number" min={1} placeholder="0" className="pr-14" {...register('cargaHoraria')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">horas</span>
          </div>
        </FormField>
        <FormField label="Data do Treinamento" error={errors.data?.message}>
          <Input type="date" {...register('data')} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormField label="Índice de Satisfação (%)" error={errors.satisfacao?.message}>
          <div className="relative">
            <Input type="number" min={0} max={100} placeholder="0" className="pr-8" {...register('satisfacao')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </FormField>
        <FormField label="Índice de Aprovação — Nota da Prova (%)" error={errors.aprovacao?.message}>
          <div className="relative">
            <Input type="number" min={0} max={100} placeholder="0" className="pr-8" {...register('aprovacao')} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </FormField>
      </div>

      {/* Collaborators Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">Colaboradores</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ nome: '', setor: '' })}
            className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
          >
            <PlusCircle className="w-4 h-4" />
            Adicionar Colaborador
          </Button>
        </div>
        {(errors.colaboradores as { message?: string } | undefined)?.message && (
          <FieldError message={(errors.colaboradores as { message?: string }).message} />
        )}
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg border border-border">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Input
                    placeholder="Nome do colaborador"
                    {...register(`colaboradores.${index}.nome`)}
                    className="bg-card"
                  />
                  <FieldError message={errors.colaboradores?.[index]?.nome?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Select onValueChange={(v) => setValue(`colaboradores.${index}.setor`, v)}>
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.colaboradores?.[index]?.setor?.message} />
                </div>
              </div>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="mt-2 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remover colaborador"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <FormField label="Upload de Arquivo (opcional)">
        <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors group">
          <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm text-muted-foreground">Clique para enviar certificado ou material</span>
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" />
        </label>
      </FormField>

      {isSubmitSuccessful && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" /> Treinamento salvo com sucesso!
        </div>
      )}

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

// ---------- Main Page ----------
type Tab = 'parceiro' | 'colaborador'

export default function RegistrarPage() {
  const [activeTab, setActiveTab] = useState<Tab>('parceiro')

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Registrar Treinamento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Preencha os dados do treinamento realizado
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 bg-muted rounded-xl p-1.5 self-start">
        <button
          onClick={() => setActiveTab('parceiro')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'parceiro'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Building2 className="w-4 h-4" />
          Parceiro (Externo)
        </button>
        <button
          onClick={() => setActiveTab('colaborador')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'colaborador'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          Colaborador (Interno)
        </button>
      </div>

      {/* Form Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        {activeTab === 'parceiro' ? <ParceiroForm /> : <ColaboradorForm />}
      </div>
    </div>
  )
}
