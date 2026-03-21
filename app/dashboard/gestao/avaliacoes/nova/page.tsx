'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

interface Treinamento {
  id: string
  codigo: string
  nome: string
}

interface PerguntaLocal {
  tempId: string
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

const dadosGeraisSchema = z.object({
  treinamento_id: z.string().min(1, 'Selecione o treinamento'),
  titulo: z.string().min(1, 'Informe o título'),
  descricao: z.string().optional(),
  nota_minima: z.coerce.number().min(0).max(100),
})

type DadosGeraisValues = z.infer<typeof dadosGeraisSchema>

type PerguntaFormValues = {
  texto: string
  tipo: string
  peso: number
  obrigatoria: boolean
}

export default function NovaAvaliacaoPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const canManage =
    user?.isMaster?.() ||
    user?.isAdmin?.() ||
    user?.hasPermission?.('gerenciar_avaliacoes')
  const activeTenantId = getActiveTenantId()

  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([])
  const [loadingTreinamentos, setLoadingTreinamentos] = useState(true)
  const [perguntas, setPerguntas] = useState<PerguntaLocal[]>([])
  const [perguntaSheetOpen, setPerguntaSheetOpen] = useState(false)
  const [editingPergunta, setEditingPergunta] = useState<PerguntaLocal | null>(null)
  const [opcoes, setOpcoes] = useState<string[]>([''])
  const [respostaCorreta, setRespostaCorreta] = useState('')
  const [deletePerguntaDialogOpen, setDeletePerguntaDialogOpen] = useState(false)
  const [perguntaToDelete, setPerguntaToDelete] = useState<PerguntaLocal | null>(null)
  const [submittingPergunta, setSubmittingPergunta] = useState(false)
  const [submittingFormulario, setSubmittingFormulario] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosGeraisValues>({
    resolver: zodResolver(dadosGeraisSchema),
    defaultValues: {
      treinamento_id: '',
      titulo: '',
      descricao: '',
      nota_minima: 70,
    },
  })

  const {
    control: controlPergunta,
    handleSubmit: handleSubmitPergunta,
    reset: resetPergunta,
    setValue: setValuePergunta,
    watch: watchPergunta,
    formState: { errors: errorsPergunta },
  } = useForm<PerguntaFormValues>({
    defaultValues: { texto: '', tipo: 'multipla_escolha', peso: 1, obrigatoria: true },
  })
  const tipoWatch = watchPergunta('tipo')

  const supabase = createClient()

  const fetchTreinamentos = async () => {
    if (!activeTenantId) return
    setLoadingTreinamentos(true)
    try {
      const { data, error } = await supabase
        .from('treinamentos')
        .select('id, codigo, nome')
        .eq('tenant_id', activeTenantId)
        .order('codigo', { ascending: true })
      if (error) throw error
      setTreinamentos((data as Treinamento[]) ?? [])
    } catch (error) {
      console.error('Erro ao carregar treinamentos:', error)
      toast.error('Não foi possível carregar treinamentos.')
    } finally {
      setLoadingTreinamentos(false)
    }
  }

  useEffect(() => {
    if (!activeTenantId || !user) return
    fetchTreinamentos()
  }, [activeTenantId, user?.id])

  const openNewPergunta = () => {
    setEditingPergunta(null)
    resetPergunta({ texto: '', tipo: 'multipla_escolha', peso: 1, obrigatoria: true })
    setOpcoes([''])
    setRespostaCorreta('')
    setPerguntaSheetOpen(true)
  }

  const openEditPergunta = (p: PerguntaLocal) => {
    setEditingPergunta(p)
    setValuePergunta('texto', p.texto)
    setValuePergunta('tipo', p.tipo)
    setValuePergunta('peso', p.peso)
    setValuePergunta('obrigatoria', p.obrigatoria)
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

  const onSavePergunta = (values: PerguntaFormValues) => {
    const textoTrimmed = values.texto?.trim()
    if (!textoTrimmed) {
      toast.error('Informe o texto da pergunta.')
      return
    }

    const opcoesFiltered =
      mostrarOpcoes ? opcoesFiltradas : tipoWatch === 'verdadeiro_falso' ? ['Verdadeiro', 'Falso'] : null
    if (mostrarOpcoes && (!opcoesFiltered || opcoesFiltered.length < 2)) {
      toast.error('Adicione pelo menos 2 opções para Múltipla Escolha.')
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
    if (isNaN(pesoVal) || pesoVal < 1 || pesoVal > 10) {
      toast.error('Peso deve ser entre 1 e 10.')
      return
    }

    const ordem = editingPergunta ? editingPergunta.ordem : perguntas.length
    const novaPergunta: PerguntaLocal = {
      tempId: editingPergunta?.tempId ?? `temp-${Date.now()}`,
      texto: textoTrimmed,
      tipo: values.tipo,
      opcoes: opcoesFiltered,
      resposta_correta: respostaCorretaVal,
      peso: pesoVal,
      obrigatoria: values.obrigatoria,
      ordem,
    }

    if (editingPergunta) {
      setPerguntas((prev) =>
        prev.map((p) => (p.tempId === editingPergunta.tempId ? novaPergunta : p))
      )
      toast.success('Pergunta atualizada.')
    } else {
      setPerguntas((prev) => [...prev, novaPergunta])
      toast.success('Pergunta adicionada.')
    }
    closePerguntaSheet()
  }

  const openDeletePergunta = (p: PerguntaLocal) => {
    setPerguntaToDelete(p)
    setDeletePerguntaDialogOpen(true)
  }

  const handleDeletePergunta = () => {
    if (!perguntaToDelete) return
    setPerguntas((prev) => {
      const filtradas = prev.filter((p) => p.tempId !== perguntaToDelete.tempId)
      return filtradas.map((p, i) => ({ ...p, ordem: i }))
    })
    setDeletePerguntaDialogOpen(false)
    setPerguntaToDelete(null)
  }

  const movePergunta = (p: PerguntaLocal, dir: 'up' | 'down') => {
    const idx = perguntas.findIndex((x) => x.tempId === p.tempId)
    if (idx < 0) return
    const otherIdx = dir === 'up' ? idx - 1 : idx + 1
    if (otherIdx < 0 || otherIdx >= perguntas.length) return
    const sorted = [...perguntas]
    ;[sorted[idx], sorted[otherIdx]] = [sorted[otherIdx], sorted[idx]]
    setPerguntas(sorted.map((item, i) => ({ ...item, ordem: i })))
  }

  const onSaveFormulario = async (values: DadosGeraisValues) => {
    if (!activeTenantId) {
      toast.error('Tenant não identificado.')
      return
    }
    if (perguntas.length < 1) {
      toast.error('Adicione pelo menos uma pergunta.')
      return
    }

    setSubmittingFormulario(true)
    try {
      const { data: formularioData, error: errForm } = await supabase
        .from('avaliacao_formularios')
        .insert({
          tenant_id: activeTenantId,
          treinamento_id: values.treinamento_id,
          titulo: values.titulo.trim(),
          descricao: values.descricao?.trim() || null,
          nota_minima: values.nota_minima,
          ativo: true,
        })
        .select('id')
        .maybeSingle()

      if (errForm) throw errForm
      const formularioId = formularioData?.id
      if (!formularioId) throw new Error('Formulário não retornou ID')

      const inserts = perguntas.map((p) => ({
        formulario_id: formularioId,
        tenant_id: activeTenantId,
        texto: p.texto,
        tipo: p.tipo,
        opcoes: p.opcoes,
        resposta_correta: p.resposta_correta,
        peso: p.peso,
        obrigatoria: p.obrigatoria,
        ordem: p.ordem,
      }))

      const { error: errPerguntas } = await supabase
        .from('avaliacao_perguntas')
        .insert(inserts)

      if (errPerguntas) throw errPerguntas

      toast.success('Avaliação criada com sucesso.')
      router.push('/dashboard/gestao/avaliacoes')
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error)
      toast.error('Não foi possível salvar a avaliação. Tente novamente.')
    } finally {
      setSubmittingFormulario(false)
    }
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/dashboard/gestao/avaliacoes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Voltar
        </Link>
        <h1 className="font-serif text-2xl font-bold text-foreground">Nova Avaliação</h1>
        <p className="text-muted-foreground text-sm">
          Você não tem permissão para gerenciar avaliações.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-24">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/gestao/avaliacoes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          ← Voltar
        </Link>
        <h1 className="font-serif text-2xl font-bold text-foreground">Nova Avaliação</h1>
      </div>

      <form onSubmit={handleSubmit(onSaveFormulario)} className="flex flex-col gap-8">
        {/* Seção 1 — Dados gerais */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Dados gerais</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="treinamento">Treinamento *</Label>
              <Controller
                control={control}
                name="treinamento_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingTreinamentos}
                  >
                    <SelectTrigger id="treinamento">
                      <SelectValue placeholder="Selecione o treinamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {treinamentos.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.codigo} — {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.treinamento_id && (
                <p className="text-destructive text-xs">{errors.treinamento_id.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                placeholder="Ex.: Avaliação de Conhecimento"
                {...register('titulo')}
              />
              {errors.titulo && (
                <p className="text-destructive text-xs">{errors.titulo.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Controller
                control={control}
                name="descricao"
                render={({ field }) => (
                  <Textarea
                    id="descricao"
                    placeholder="Descrição opcional"
                    className="min-h-[80px] resize-y"
                    {...field}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nota_minima">Nota Mínima (%)</Label>
              <Input
                id="nota_minima"
                type="number"
                min={0}
                max={100}
                {...register('nota_minima')}
              />
              {errors.nota_minima && (
                <p className="text-destructive text-xs">{errors.nota_minima.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Seção 2 — Perguntas */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex flex-row items-center justify-between">
            <h2 className="font-semibold text-foreground">Perguntas</h2>
            <Button
              type="button"
              onClick={openNewPergunta}
              size="sm"
              className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
            >
              <Plus className="w-4 h-4" />
              Nova Pergunta
            </Button>
          </div>
          {perguntas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma pergunta. Clique em &quot;Nova Pergunta&quot; para adicionar.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {perguntas.map((p, index) => (
                <li key={p.tempId} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => movePergunta(p, 'up')}
                      disabled={index === 0}
                      aria-label="Subir"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => movePergunta(p, 'down')}
                      disabled={index === perguntas.length - 1}
                      aria-label="Descer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditPergunta(p)}
                      aria-label="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => openDeletePergunta(p)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Botão fixo rodapé */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-10">
          <div className="max-w-4xl mx-auto flex justify-end">
            <Button
              type="submit"
              disabled={submittingFormulario}
              className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
            >
              {submittingFormulario ? 'Salvando...' : 'Salvar Avaliação'}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={perguntaSheetOpen}
        onOpenChange={(o) => {
          setPerguntaSheetOpen(o)
          if (!o) closePerguntaSheet()
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingPergunta ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmitPergunta(onSavePergunta)}
            className="space-y-4 py-4 flex flex-col"
          >
            <div className="space-y-2">
              <Label htmlFor="texto-pergunta">Texto da pergunta *</Label>
              <Controller
                control={controlPergunta}
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
              {errorsPergunta.texto && (
                <p className="text-destructive text-xs">{errorsPergunta.texto.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Controller
                control={controlPergunta}
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
                control={controlPergunta}
                name="peso"
                render={({ field }) => (
                  <Input
                    id="peso-pergunta"
                    type="number"
                    min={1}
                    max={10}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                  />
                )}
              />
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={controlPergunta}
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
            <DialogFooter className="mt-auto pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closePerguntaSheet}
                disabled={submittingPergunta}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingPergunta}
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              >
                {submittingPergunta ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePergunta}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
