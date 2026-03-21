'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface Formulario {
  id: string
  titulo: string
  descricao: string | null
  nota_minima: number
  ativo: boolean
  treinamentos: { codigo: string; nome: string } | null
}

interface Pergunta {
  id: string
  formulario_id: string
  texto: string
  tipo: string
  opcoes: string[] | null
  resposta_correta: string | null
  peso: number
  obrigatoria: boolean
  ordem: number
}

const tipoOptions = [
  { value: 'multipla_escolha', label: 'Múltipla Escolha' },
  { value: 'verdadeiro_falso', label: 'Verdadeiro ou Falso' },
]

type PerguntaFormValues = {
  texto: string
  tipo: string
  peso: number
  obrigatoria: boolean
}

export default function AvaliacaoIdPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { user, getActiveTenantId } = useUser()
  const canManage =
    user?.isMaster?.() ||
    user?.isAdmin?.() ||
    user?.hasPermission?.('gerenciar_avaliacoes')
  const activeTenantId = getActiveTenantId()

  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [perguntas, setPerguntas] = useState<Pergunta[]>([])
  const [loading, setLoading] = useState(true)
  const [perguntaSheetOpen, setPerguntaSheetOpen] = useState(false)
  const [editingPergunta, setEditingPergunta] = useState<Pergunta | null>(null)
  const [opcoes, setOpcoes] = useState<string[]>([''])
  const [respostaCorreta, setRespostaCorreta] = useState('')
  const [deletePerguntaDialogOpen, setDeletePerguntaDialogOpen] = useState(false)
  const [perguntaToDelete, setPerguntaToDelete] = useState<Pergunta | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PerguntaFormValues>({
    defaultValues: { texto: '', tipo: 'multipla_escolha', peso: 1, obrigatoria: true },
  })
  const tipoWatch = watch('tipo')

  const supabase = createClient()

  const fetchFormulario = async () => {
    if (!id || !activeTenantId) return
    const { data, error } = await supabase
      .from('avaliacao_formularios')
      .select('id, titulo, descricao, nota_minima, ativo, treinamentos(codigo, nome)')
      .eq('id', id)
      .eq('tenant_id', activeTenantId)
      .maybeSingle()
    if (error) {
      console.error(error)
      toast.error('Erro ao carregar avaliação.')
      router.replace('/dashboard/gestao/avaliacoes')
      return
    }
    if (!data) {
      router.replace('/dashboard/gestao/avaliacoes')
      return
    }
    setFormulario(data as unknown as Formulario)
  }

  const fetchPerguntas = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('avaliacao_perguntas')
      .select('*')
      .eq('formulario_id', id)
      .order('ordem', { ascending: true })
    if (error) {
      console.error(error)
      toast.error('Erro ao carregar perguntas.')
      return
    }
    setPerguntas((data as Pergunta[]) ?? [])
  }

  useEffect(() => {
    if (!id || !activeTenantId) return
    setLoading(true)
    Promise.all([fetchFormulario(), fetchPerguntas()]).finally(() => setLoading(false))
  }, [id, activeTenantId])

  useEffect(() => {
    if (!formulario && !loading && id && activeTenantId) {
      router.replace('/dashboard/gestao/avaliacoes')
    }
  }, [formulario, loading, id, activeTenantId, router])

  const openNewPergunta = () => {
    setEditingPergunta(null)
    reset({ texto: '', tipo: 'multipla_escolha', peso: 1, obrigatoria: true })
    setOpcoes([''])
    setRespostaCorreta('')
    setPerguntaSheetOpen(true)
  }

  const openEditPergunta = (p: Pergunta) => {
    setEditingPergunta(p)
    setValue('texto', p.texto)
    setValue('tipo', p.tipo)
    setValue('peso', p.peso)
    setValue('obrigatoria', p.obrigatoria)
    setOpcoes(p.opcoes?.length ? p.opcoes : [''])
    setRespostaCorreta(p.resposta_correta ?? '')
    setPerguntaSheetOpen(true)
  }

  const closePerguntaSheet = () => {
    setPerguntaSheetOpen(false)
    setEditingPergunta(null)
    setOpcoes([''])
    setRespostaCorreta('')
  }

  const addOpcao = () => setOpcoes((prev) => [...prev, ''])
  const removeOpcao = (idx: number) => setOpcoes((prev) => prev.filter((_, i) => i !== idx))
  const setOpcaoValue = (idx: number, v: string) =>
    setOpcoes((prev) => prev.map((o, i) => (i === idx ? v : o)))

  const opcoesFiltradas = opcoes.map((o) => o.trim()).filter(Boolean)
  const mostrarOpcoes = tipoWatch === 'multipla_escolha'
  const mostrarRespostaCorreta =
    tipoWatch === 'multipla_escolha' || tipoWatch === 'verdadeiro_falso'

  const onSavePergunta = async (values: PerguntaFormValues) => {
    const textoTrimmed = values.texto?.trim()
    if (!textoTrimmed) {
      toast.error('Informe o texto da pergunta.')
      return
    }

    const opcoesFiltered =
      mostrarOpcoes ? opcoesFiltradas : tipoWatch === 'verdadeiro_falso' ? ['Verdadeiro', 'Falso'] : null
    if (mostrarOpcoes && (!opcoesFiltered || opcoesFiltered.length === 0)) {
      toast.error('Adicione ao menos uma opção para Múltipla Escolha.')
      return
    }

    const respostaCorretaVal =
      mostrarRespostaCorreta && respostaCorreta ? respostaCorreta : null
    if (mostrarRespostaCorreta && tipoWatch === 'verdadeiro_falso' && !respostaCorretaVal) {
      toast.error('Selecione a resposta correta.')
      return
    }
    if (
      mostrarRespostaCorreta &&
      tipoWatch === 'multipla_escolha' &&
      opcoesFiltered &&
      !opcoesFiltered.includes(respostaCorretaVal ?? '')
    ) {
      toast.error('A resposta correta deve ser uma das opções.')
      return
    }

    const pesoVal = Number(values.peso)
    if (isNaN(pesoVal) || pesoVal < 0) {
      toast.error('Peso deve ser um número positivo.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        texto: textoTrimmed,
        tipo: values.tipo,
        obrigatoria: values.obrigatoria,
        peso: pesoVal,
        opcoes: opcoesFiltered,
        resposta_correta: respostaCorretaVal,
      }
      if (editingPergunta) {
        const { error } = await supabase
          .from('avaliacao_perguntas')
          .update(payload)
          .eq('id', editingPergunta.id)
        if (error) throw error
        toast.success('Pergunta atualizada.')
      } else {
        const maxOrd =
          perguntas.length === 0 ? 0 : Math.max(...perguntas.map((p) => p.ordem), 0)
        const { error } = await supabase.from('avaliacao_perguntas').insert({
          ...payload,
          formulario_id: id,
          tenant_id: activeTenantId,
          ordem: maxOrd + 1,
        })
        if (error) throw error
        toast.success('Pergunta adicionada.')
      }
      closePerguntaSheet()
      fetchPerguntas()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível salvar a pergunta.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeletePergunta = (p: Pergunta) => {
    setPerguntaToDelete(p)
    setDeletePerguntaDialogOpen(true)
  }

  const handleDeletePergunta = async () => {
    if (!perguntaToDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('avaliacao_perguntas')
        .delete()
        .eq('id', perguntaToDelete.id)
      if (error) throw error
      toast.success('Pergunta excluída.')
      setDeletePerguntaDialogOpen(false)
      setPerguntaToDelete(null)
      fetchPerguntas()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível excluir.')
    } finally {
      setSubmitting(false)
    }
  }

  const movePergunta = async (p: Pergunta, dir: 'up' | 'down') => {
    const idx = perguntas.findIndex((x) => x.id === p.id)
    if (idx < 0) return
    const otherIdx = dir === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= perguntas.length) return
    const other = perguntas[otherIdx]
    try {
      await supabase.from('avaliacao_perguntas').update({ ordem: other.ordem }).eq('id', p.id)
      await supabase.from('avaliacao_perguntas').update({ ordem: p.ordem }).eq('id', other.id)
      fetchPerguntas()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível reordenar.')
    }
  }

  if (loading || !formulario) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const treinamentoNome =
    formulario.treinamentos?.nome ?? '—'
  const treinamentoCodigo = formulario.treinamentos?.codigo ?? ''

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/gestao/avaliacoes"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1"
          >
            ← Voltar
          </Link>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            {formulario.titulo}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {treinamentoNome} ({treinamentoCodigo}) — Nota mínima: {formulario.nota_minima}%
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-row items-center justify-between">
          <h2 className="font-semibold text-foreground">Perguntas da avaliação</h2>
          {canManage && (
            <Button
              onClick={openNewPergunta}
              size="sm"
              className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
            >
              <Plus className="w-4 h-4" />
              Nova Pergunta
            </Button>
          )}
        </div>
        {perguntas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma pergunta. {canManage && 'Clique em "Nova Pergunta" para adicionar.'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {perguntas.map((p, index) => (
              <li key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{p.texto}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {tipoOptions.find((o) => o.value === p.tipo)?.label ?? p.tipo}
                    </Badge>
                    {p.obrigatoria && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-0">
                        Obrigatória
                      </Badge>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => movePergunta(p, 'up')}
                      disabled={index === 0}
                      aria-label="Subir"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => movePergunta(p, 'down')}
                      disabled={index === perguntas.length - 1}
                      aria-label="Descer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditPergunta(p)}
                      aria-label="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => openDeletePergunta(p)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet
        open={perguntaSheetOpen}
        onOpenChange={(o) => {
          setPerguntaSheetOpen(o)
          if (!o) closePerguntaSheet()
        }}
      >
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif">
              {editingPergunta ? 'Editar Pergunta' : 'Nova Pergunta'}
            </SheetTitle>
          </SheetHeader>
          <form
            onSubmit={handleSubmit(onSavePergunta)}
            className="space-y-4 py-6 flex flex-col"
          >
            <div className="space-y-2">
              <Label htmlFor="texto-pergunta">Texto da pergunta *</Label>
              <Controller
                control={control}
                name="texto"
                rules={{ required: 'Informe o texto' }}
                render={({ field }) => (
                  <Textarea
                    id="texto-pergunta"
                    className="min-h-[80px] resize-y"
                    placeholder="Ex.: Qual é a capital do Brasil?"
                    {...field}
                  />
                )}
              />
              {errors.texto && (
                <p className="text-destructive text-xs">{errors.texto.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {mostrarOpcoes && (
              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="space-y-2">
                  {opcoes.map((op, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={op}
                        onChange={(e) => setOpcaoValue(idx, e.target.value)}
                        placeholder={`Opção ${idx + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOpcao(idx)}
                        aria-label="Remover"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addOpcao}>
                    + Adicionar opção
                  </Button>
                </div>
              </div>
            )}
            {mostrarRespostaCorreta && (
              <div className="space-y-2">
                <Label>Resposta Correta</Label>
                {tipoWatch === 'verdadeiro_falso' ? (
                  <Select value={respostaCorreta} onValueChange={setRespostaCorreta}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Verdadeiro">Verdadeiro</SelectItem>
                      <SelectItem value="Falso">Falso</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={respostaCorreta} onValueChange={setRespostaCorreta}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a opção correta" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesFiltradas.map((op, idx) => (
                        <SelectItem key={idx} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="peso-pergunta">Peso</Label>
              <Controller
                control={control}
                name="peso"
                render={({ field }) => (
                  <Input
                    id="peso-pergunta"
                    type="number"
                    min={0}
                    step={0.5}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                  />
                )}
              />
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="obrigatoria"
                render={({ field }) => (
                  <Checkbox
                    id="obrigatoria-pergunta"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="obrigatoria-pergunta" className="font-normal cursor-pointer">
                Obrigatória
              </Label>
            </div>
            <SheetFooter className="mt-auto pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closePerguntaSheet}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deletePerguntaDialogOpen}
        onOpenChange={setDeletePerguntaDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pergunta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta pergunta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePergunta}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
