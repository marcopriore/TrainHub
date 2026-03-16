'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Settings } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Formulario {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
}

interface Pergunta {
  id: string
  formulario_id: string
  texto: string
  tipo: string
  opcoes: string[] | null
  obrigatoria: boolean
  ordem: number
}

interface TokenRow {
  id: string
  formulario_id: string
  treinamento_id: string
  usado: boolean
  respondido_em: string | null
  criado_em: string
}

const tipoOptions = [
  { value: 'escala', label: 'Escala (1 a 5)' },
  { value: 'multipla_escolha', label: 'Múltipla Escolha' },
  { value: 'texto_livre', label: 'Texto Livre' },
]

type PerguntaFormValues = {
  texto: string
  tipo: string
  obrigatoria: boolean
}

export default function PesquisaIdPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { user, getActiveTenantId } = useUser()
  const canManage =
    user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('gerenciar_pesquisas')
  const activeTenantId = getActiveTenantId()

  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [perguntas, setPerguntas] = useState<Pergunta[]>([])
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [perguntaDialogOpen, setPerguntaDialogOpen] = useState(false)
  const [editingPergunta, setEditingPergunta] = useState<Pergunta | null>(null)
  const [opcoes, setOpcoes] = useState<string[]>([''])
  const [deletePerguntaDialogOpen, setDeletePerguntaDialogOpen] = useState(false)
  const [perguntaToDelete, setPerguntaToDelete] = useState<Pergunta | null>(null)
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null)
  const [respostasByToken, setRespostasByToken] = useState<Record<string, { pergunta_texto: string; valor: string }[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PerguntaFormValues>({
    defaultValues: { texto: '', tipo: 'escala', obrigatoria: true },
  })
  const tipoWatch = watch('tipo')

  const supabase = createClient()

  const fetchFormulario = async () => {
    if (!id || !activeTenantId) return
    const { data, error } = await supabase
      .from('pesquisa_formularios')
      .select('id, nome, descricao, ativo')
      .eq('id', id)
      .eq('tenant_id', activeTenantId)
      .maybeSingle()
    if (error) {
      console.error(error)
      toast.error('Erro ao carregar formulário.')
      router.replace('/dashboard/gestao/pesquisas')
      return
    }
    if (!data) {
      router.replace('/dashboard/gestao/pesquisas')
      return
    }
    setFormulario(data as Formulario)
  }

  const fetchPerguntas = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('pesquisa_perguntas')
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

  const fetchTokens = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('pesquisa_tokens')
      .select('id, formulario_id, treinamento_id, usado, respondido_em, criado_em')
      .eq('formulario_id', id)
      .order('criado_em', { ascending: false })
    if (error) {
      console.error(error)
      return
    }
    setTokens((data as TokenRow[]) ?? [])
  }

  const fetchRespostasForToken = async (tokenId: string) => {
    const { data } = await supabase
      .from('pesquisa_respostas')
      .select('pergunta_id, valor, pesquisa_perguntas(texto)')
      .eq('token_id', tokenId)
    const list = (data ?? []) as { pergunta_id: string; valor: string; pesquisa_perguntas: { texto: string } | null }[]
    const mapped = list.map((r) => ({
      pergunta_texto: r.pesquisa_perguntas?.texto ?? '—',
      valor: r.valor ?? '',
    }))
    setRespostasByToken((prev) => ({ ...prev, [tokenId]: mapped }))
  }

  useEffect(() => {
    if (!id || !activeTenantId) return
    setLoading(true)
    Promise.all([fetchFormulario(), fetchPerguntas(), fetchTokens()]).finally(() => setLoading(false))
  }, [id, activeTenantId])

  useEffect(() => {
    if (!formulario && !loading && id && activeTenantId) {
      router.replace('/dashboard/gestao/pesquisas')
    }
  }, [formulario, loading, id, activeTenantId, router])

  const openNewPergunta = () => {
    setEditingPergunta(null)
    reset({ texto: '', tipo: 'escala', obrigatoria: true })
    setOpcoes([''])
    setPerguntaDialogOpen(true)
  }

  const openEditPergunta = (p: Pergunta) => {
    setEditingPergunta(p)
    setValue('texto', p.texto)
    setValue('tipo', p.tipo)
    setValue('obrigatoria', p.obrigatoria)
    setOpcoes(p.opcoes?.length ? p.opcoes : [''])
    setPerguntaDialogOpen(true)
  }

  const closePerguntaDialog = () => {
    setPerguntaDialogOpen(false)
    setEditingPergunta(null)
    setOpcoes([''])
  }

  const addOpcao = () => setOpcoes((prev) => [...prev, ''])
  const removeOpcao = (idx: number) => setOpcoes((prev) => prev.filter((_, i) => i !== idx))
  const setOpcaoValue = (idx: number, v: string) =>
    setOpcoes((prev) => prev.map((o, i) => (i === idx ? v : o)))

  const onSavePergunta = async (values: PerguntaFormValues) => {
    const textoTrimmed = values.texto?.trim()
    if (!textoTrimmed) {
      toast.error('Informe o texto da pergunta.')
      return
    }
    const opcoesFiltered = tipoWatch === 'multipla_escolha' ? opcoes.map((o) => o.trim()).filter(Boolean) : null
    if (tipoWatch === 'multipla_escolha' && (!opcoesFiltered || opcoesFiltered.length === 0)) {
      toast.error('Adicione ao menos uma opção para Múltipla Escolha.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        texto: textoTrimmed,
        tipo: values.tipo,
        obrigatoria: values.obrigatoria,
        opcoes: opcoesFiltered,
      }
      if (editingPergunta) {
        const { error } = await supabase
          .from('pesquisa_perguntas')
          .update(payload)
          .eq('id', editingPergunta.id)
        if (error) throw error
        toast.success('Pergunta atualizada.')
      } else {
        const maxOrd = perguntas.length === 0 ? 0 : Math.max(...perguntas.map((p) => p.ordem), 0)
        const { error } = await supabase.from('pesquisa_perguntas').insert({
          ...payload,
          formulario_id: id,
          tenant_id: activeTenantId,
          ordem: maxOrd + 1,
        })
        if (error) throw error
        toast.success('Pergunta adicionada.')
      }
      closePerguntaDialog()
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
        .from('pesquisa_perguntas')
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
      await supabase.from('pesquisa_perguntas').update({ ordem: other.ordem }).eq('id', p.id)
      await supabase.from('pesquisa_perguntas').update({ ordem: p.ordem }).eq('id', other.id)
      fetchPerguntas()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível reordenar.')
    }
  }

  const toggleRespostas = (tokenId: string) => {
    if (expandedTokenId === tokenId) {
      setExpandedTokenId(null)
      return
    }
    setExpandedTokenId(tokenId)
    if (!respostasByToken[tokenId]) fetchRespostasForToken(tokenId)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  if (loading || !formulario) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/gestao/pesquisas"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1"
          >
            ← Voltar
          </Link>
          <h1 className="font-serif text-2xl font-bold text-foreground">{formulario.nome}</h1>
        </div>
      </div>

      {/* Seção 1 — Perguntas */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-row items-center justify-between">
          <h2 className="font-semibold text-foreground">Perguntas do formulário</h2>
          {canManage && (
            <Button onClick={openNewPergunta} size="sm" className="bg-[#00C9A7] hover:bg-[#00C9A7]/90">
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
                    <span className="text-xs text-muted-foreground">
                      {tipoOptions.find((o) => o.value === p.tipo)?.label ?? p.tipo}
                    </span>
                    {p.obrigatoria && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-600">
                        Obrigatória
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => movePergunta(p, 'up')} disabled={index === 0} aria-label="Subir">
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => movePergunta(p, 'down')} disabled={index === perguntas.length - 1} aria-label="Descer">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEditPergunta(p)} aria-label="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => openDeletePergunta(p)} aria-label="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Seção 2 — Respostas recebidas */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <h2 className="p-4 border-b border-border font-semibold text-foreground">Respostas recebidas</h2>
        {tokens.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma resposta recebida ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Treinamento</TableHead>
                <TableHead className="font-medium">Data</TableHead>
                <TableHead className="font-medium">Status</TableHead>
                <TableHead className="font-medium w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <React.Fragment key={t.id}>
                  <TableRow>
                    <TableCell className="text-muted-foreground">
                      {t.treinamento_id ? String(t.treinamento_id).slice(0, 8) + '…' : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(t.criado_em)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          t.usado ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {t.usado ? 'Respondido' : 'Pendente'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.usado && (
                        <Button variant="ghost" size="sm" onClick={() => toggleRespostas(t.id)}>
                          {expandedTokenId === t.id ? 'Ocultar respostas' : 'Ver respostas'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedTokenId === t.id && t.usado && (
                    <TableRow key={`${t.id}-expanded`}>
                      <TableCell colSpan={4} className="bg-muted/20 p-4">
                        {respostasByToken[t.id] ? (
                          <ul className="space-y-2 text-sm">
                            {respostasByToken[t.id].map((r, i) => (
                              <li key={i} className="flex flex-col gap-0.5">
                                <span className="text-muted-foreground font-medium">{r.pergunta_texto}</span>
                                <span className="text-foreground">{r.valor || '—'}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-muted-foreground">Carregando...</div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog Nova/Editar Pergunta */}
      <Dialog open={perguntaDialogOpen} onOpenChange={(o) => { setPerguntaDialogOpen(o); if (!o) closePerguntaDialog() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingPergunta ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSavePergunta)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="texto-pergunta">Texto da pergunta *</Label>
              <Textarea
                id="texto-pergunta"
                className="min-h-[80px] resize-y"
                placeholder="Ex.: Como você avalia o conteúdo?"
                {...register('texto')}
              />
              {errors.texto && <p className="text-destructive text-xs">{errors.texto.message}</p>}
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
            {tipoWatch === 'multipla_escolha' && (
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
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeOpcao(idx)} aria-label="Remover">
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
            <div className="flex items-center justify-between">
              <Label>Obrigatória</Label>
              <Controller
                control={control}
                name="obrigatoria"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePerguntaDialog} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#00C9A7] hover:bg-[#00C9A7]/90">
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePerguntaDialogOpen} onOpenChange={setDeletePerguntaDialogOpen}>
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
