'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Pencil, Trash2, Award, Upload } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
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
  Dialog,
  DialogContent,
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
import { cn } from '@/lib/utils'

interface CatalogoItem {
  id: string
  tenant_id: string
  titulo: string
  conteudo_programatico: string | null
  objetivo: string | null
  carga_horaria: number | null
  categoria: string | null
  nivel: string | null
  modalidade: string | null
  imagem_url: string | null
  status: string
  criado_em: string
  atualizado_em: string
  criado_por: string | null
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  inativo: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
  rascunho: { label: 'Rascunho', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
}

const nivelOptions = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
]

const modalidadeOptions = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
  { value: 'hibrido', label: 'Híbrido' },
]

const statusOptions = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
]

type FormValues = {
  titulo: string
  conteudo_programatico: string
  objetivo: string
  carga_horaria: number
  categoria: string
  nivel: string
  modalidade: string
  status: string
  imagem_url: string
}

export default function CatalogoPage() {
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const canManage =
    user?.isMaster() || user?.isAdmin?.() || user?.hasPermission?.('gerenciar_catalogo')

  const [items, setItems] = useState<CatalogoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTitulo, setFiltroTitulo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')
  const [filtroNivel, setFiltroNivel] = useState<string>('todos')
  const [filtroModalidade, setFiltroModalidade] = useState<string>('todas')
  const [filterSelectOpen, setFilterSelectOpen] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogoItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<CatalogoItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([])
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateUploading, setTemplateUploading] = useState(false)
  const [templateImageUrl, setTemplateImageUrl] = useState<string | null>(null)
  const [camposPosicoes, setCamposPosicoes] = useState({
    nome: { x: 50, y: 62 },
    treinamento: { x: 50, y: 72 },
    carga_horaria: { x: 50, y: 80 },
    data: { x: 50, y: 87 },
  })
  const previewRef = useRef<HTMLDivElement | null>(null)
  const draggingFieldRef = useRef<keyof typeof camposPosicoes | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)

  const supabase = createClient()

  const fetchCategorias = async () => {
    if (!activeTenantId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('categorias')
      .select('id, nome')
      .eq('tenant_id', activeTenantId)
      .order('nome', { ascending: true })
    setCategorias(data ?? [])
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      titulo: '',
      conteudo_programatico: '',
      objetivo: '',
      carga_horaria: 0,
      categoria: '',
      nivel: '',
      modalidade: '',
      status: 'rascunho',
      imagem_url: '',
    },
  })

  const categoriasDistintas = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => {
      if (i.categoria?.trim()) set.add(i.categoria.trim())
    })
    return Array.from(set).sort()
  }, [items])

  const fetchCatalogo = async (silent = false) => {
    if (!activeTenantId) {
      setItems([])
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('catalogo_treinamentos')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .order('criado_em', { ascending: false })

      if (error) throw error
      setItems((data as CatalogoItem[]) ?? [])
    } catch (error) {
      console.error('Erro ao carregar catálogo:', error)
      toast.error('Não foi possível carregar o catálogo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeTenantId || !user) return
    fetchCatalogo()
    fetchCategorias()
  }, [activeTenantId, user?.id])

  useEffect(() => {
    if (!activeTenantId) return

    const channel = supabase
      .channel('catalogo-treinamentos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'catalogo_treinamentos',
          filter: `tenant_id=eq.${activeTenantId}`,
        },
        () => fetchCatalogo(true)
      )
      .subscribe()

    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchCatalogo(true)
      }
    }, 15_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
    }
  }, [activeTenantId])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchTitulo =
        !filtroTitulo.trim() ||
        item.titulo?.toLowerCase().includes(filtroTitulo.trim().toLowerCase())
      const matchStatus = filtroStatus === 'todos' || item.status === filtroStatus
      const matchCategoria =
        filtroCategoria === 'todas' || (item.categoria ?? '').trim() === filtroCategoria
      const matchNivel = filtroNivel === 'todos' || item.nivel === filtroNivel
      const matchModalidade =
        filtroModalidade === 'todas' || item.modalidade === filtroModalidade
      return matchTitulo && matchStatus && matchCategoria && matchNivel && matchModalidade
    })
  }, [items, filtroTitulo, filtroStatus, filtroCategoria, filtroNivel, filtroModalidade])

  const loadTemplate = async () => {
    if (!activeTenantId) return
    setTemplateLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('certificado_templates')
        .select('imagem_url, campos_posicoes')
        .eq('tenant_id', activeTenantId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar template de certificado:', error)
        toast.error('Não foi possível carregar o template de certificado.')
        return
      }

      const typed = data as { imagem_url: string | null; campos_posicoes?: any } | null
      setTemplateImageUrl(typed?.imagem_url ?? null)

      if (typed?.campos_posicoes) {
        setCamposPosicoes((prev) => ({
          nome: {
            x: typed.campos_posicoes.nome?.x ?? prev.nome.x,
            y: typed.campos_posicoes.nome?.y ?? prev.nome.y,
          },
          treinamento: {
            x: typed.campos_posicoes.treinamento?.x ?? prev.treinamento.x,
            y: typed.campos_posicoes.treinamento?.y ?? prev.treinamento.y,
          },
          carga_horaria: {
            x: typed.campos_posicoes.carga_horaria?.x ?? prev.carga_horaria.x,
            y: typed.campos_posicoes.carga_horaria?.y ?? prev.carga_horaria.y,
          },
          data: {
            x: typed.campos_posicoes.data?.x ?? prev.data.x,
            y: typed.campos_posicoes.data?.y ?? prev.data.y,
          },
        }))
      } else {
        setCamposPosicoes({
          nome: { x: 50, y: 62 },
          treinamento: { x: 50, y: 72 },
          carga_horaria: { x: 50, y: 80 },
          data: { x: 50, y: 87 },
        })
      }
    } catch (error) {
      console.error('Erro ao buscar template de certificado:', error)
      toast.error('Não foi possível carregar o template de certificado.')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleTemplateFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !activeTenantId) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Apenas arquivos PNG ou JPG são permitidos.')
      event.target.value = ''
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Tamanho máximo do arquivo é 5MB.')
      event.target.value = ''
      return
    }

    setTemplateUploading(true)
    try {
      const supabase = createClient()
      const path = `${activeTenantId}/template.png`

      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        console.error('Erro ao fazer upload do template de certificado:', uploadError)
        toast.error('Erro ao enviar o arquivo. Tente novamente.')
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('certificados').getPublicUrl(path)

      const { error: upsertError } = await supabase.from('certificado_templates').upsert(
        {
          tenant_id: activeTenantId,
          imagem_url: publicUrl,
          campos_posicoes: camposPosicoes,
          ativo: true,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )

      if (upsertError) {
        console.error('Erro ao salvar template de certificado:', upsertError)
        toast.error('Erro ao salvar o template de certificado.')
        return
      }

      setTemplateImageUrl(publicUrl)
      toast.success('Template de certificado atualizado com sucesso.')
    } catch (error) {
      console.error('Erro ao processar template de certificado:', error)
      toast.error('Erro ao processar o template de certificado.')
    } finally {
      setTemplateUploading(false)
      event.target.value = ''
    }
  }

  const handleRemoveTemplate = async () => {
    if (!activeTenantId) return

    setTemplateUploading(true)
    try {
      const supabase = createClient()
      const path = `${activeTenantId}/template.png`

      const { error: storageError } = await supabase.storage
        .from('certificados')
        .remove([path])

      if (storageError) {
        console.error('Erro ao remover arquivo de certificado:', storageError)
      }

      const { error: updateError } = await supabase
        .from('certificado_templates')
        .update({ imagem_url: null, atualizado_em: new Date().toISOString() })
        .eq('tenant_id', activeTenantId)

      if (updateError) {
        console.error('Erro ao atualizar template de certificado:', updateError)
        toast.error('Não foi possível atualizar o template de certificado.')
        return
      }

      setTemplateImageUrl(null)
      toast.success('Template de certificado removido com sucesso.')
    } catch (error) {
      console.error('Erro ao remover template de certificado:', error)
      toast.error('Erro ao remover o template de certificado.')
    } finally {
      setTemplateUploading(false)
    }
  }

  const saveTemplatePositions = async (positions: typeof camposPosicoes) => {
    if (!activeTenantId) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('certificado_templates').upsert(
        {
          tenant_id: activeTenantId,
          imagem_url: templateImageUrl,
          campos_posicoes: positions,
          ativo: true,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      )
      if (error) {
        console.error('Erro ao salvar posições do template de certificado:', error)
        toast.error('Não foi possível salvar as posições do template.')
        return
      }
      toast.success('Template salvo com sucesso.')
    } catch (error) {
      console.error('Erro ao salvar posições do template de certificado:', error)
      toast.error('Erro ao salvar o template de certificado.')
    }
  }

  const handlePreviewMouseMove = (event: any) => {
    if (!draggingFieldRef.current || !previewRef.current) return

    const rect = previewRef.current.getBoundingClientRect()
    const offset = dragOffsetRef.current ?? { x: 0, y: 0 }

    const centerX = event.clientX - rect.left - offset.x
    const centerY = event.clientY - rect.top - offset.y

    if (rect.width <= 0 || rect.height <= 0) return

    let xPercent = (centerX / rect.width) * 100
    let yPercent = (centerY / rect.height) * 100

    xPercent = Math.min(95, Math.max(5, xPercent))
    yPercent = Math.min(95, Math.max(5, yPercent))

    const fieldKey = draggingFieldRef.current
    setCamposPosicoes((prev) => ({
      ...prev,
      [fieldKey]: {
        x: xPercent,
        y: yPercent,
      },
    }))
  }

  const handlePreviewMouseUp = async () => {
    if (!draggingFieldRef.current) return
    const positions = { ...camposPosicoes }
    draggingFieldRef.current = null
    dragOffsetRef.current = null
    await saveTemplatePositions(positions)
  }

  const handleFieldMouseDown = (
    event: any,
    field: keyof typeof camposPosicoes
  ) => {
    if (!previewRef.current) return
    event.preventDefault()
    const rect = previewRef.current.getBoundingClientRect()
    const elementRect = (event.currentTarget as HTMLDivElement).getBoundingClientRect()

    const elementCenterX = elementRect.left - rect.left + elementRect.width / 2
    const elementCenterY = elementRect.top - rect.top + elementRect.height / 2

    const offsetX = event.clientX - (rect.left + elementCenterX)
    const offsetY = event.clientY - (rect.top + elementCenterY)

    draggingFieldRef.current = field
    dragOffsetRef.current = { x: offsetX, y: offsetY }
  }

  const openNewSheet = () => {
    setEditingItem(null)
    reset({
      titulo: '',
      conteudo_programatico: '',
      objetivo: '',
      carga_horaria: 0,
      categoria: '',
      nivel: '',
      modalidade: '',
      status: 'rascunho',
      imagem_url: '',
    })
    setSheetOpen(true)
  }

  const openEditSheet = (item: CatalogoItem) => {
    setEditingItem(item)
    reset({
      titulo: item.titulo ?? '',
      conteudo_programatico: item.conteudo_programatico ?? '',
      objetivo: item.objetivo ?? '',
      carga_horaria: item.carga_horaria ?? 0,
      categoria: item.categoria ?? '',
      nivel: item.nivel ?? '',
      modalidade: item.modalidade ?? '',
      status: item.status ?? 'rascunho',
      imagem_url: item.imagem_url ?? '',
    })
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setEditingItem(null)
  }

  const onSave = async (values: FormValues) => {
    const tituloTrimmed = values.titulo?.trim()
    if (!tituloTrimmed) {
      setError('titulo', { message: 'Informe o título' })
      return
    }
    if (values.carga_horaria < 0) {
      setError('carga_horaria', { message: 'Carga horária deve ser >= 0' })
      return
    }
    if (!activeTenantId) {
      toast.error('Tenant não identificado.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        titulo: tituloTrimmed,
        conteudo_programatico: values.conteudo_programatico?.trim() || null,
        objetivo: values.objetivo?.trim() || null,
        carga_horaria: values.carga_horaria,
        categoria: values.categoria?.trim() || null,
        nivel: values.nivel || null,
        modalidade: values.modalidade || null,
        status: values.status || 'rascunho',
        imagem_url: values.imagem_url?.trim() || null,
        atualizado_em: new Date().toISOString(),
      }

      if (editingItem) {
        const { error } = await supabase
          .from('catalogo_treinamentos')
          .update(payload)
          .eq('id', editingItem.id)
        if (error) throw error
        toast.success('Treinamento atualizado com sucesso.')
      } else {
        const { error } = await supabase.from('catalogo_treinamentos').insert({
          ...payload,
          tenant_id: activeTenantId,
          criado_por: user?.id ?? null,
        })
        if (error) throw error
        toast.success('Treinamento cadastrado com sucesso.')
      }
      closeSheet()
      fetchCatalogo()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (item: CatalogoItem) => {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('catalogo_treinamentos')
        .delete()
        .eq('id', itemToDelete.id)
      if (error) throw error
      toast.success('Treinamento excluído com sucesso.')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
      fetchCatalogo()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      toast.error('Não foi possível excluir. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLimparFiltros = () => {
    setFiltroTitulo('')
    setFiltroStatus('todos')
    setFiltroCategoria('todas')
    setFiltroNivel('todos')
    setFiltroModalidade('todas')
  }

  if (!activeTenantId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Treinamentos</h1>
        <p className="text-muted-foreground text-sm">Selecione um tenant para continuar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Treinamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? '...' : filtered.length} treinamentos cadastrados
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Dialog
              open={templateDialogOpen}
              onOpenChange={(open) => {
                setTemplateDialogOpen(open)
                if (open) {
                  loadTemplate()
                }
              }}
            >
              <Button
                type="button"
                variant="outline"
                disabled={!activeTenantId}
                className="w-full sm:w-auto shrink-0 border-[#00C9A7] text-[#00C9A7] hover:bg-[#00C9A7]/5"
                onClick={() => setTemplateDialogOpen(true)}
              >
                <Award className="w-4 h-4 mr-1.5" />
                Template de Certificado
              </Button>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl font-bold">
                    Template de Certificado
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure a arte base do certificado para todos os treinamentos deste tenant.
                  </p>
                </DialogHeader>

                <div className="flex flex-col gap-6 pt-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Upload da arte</h3>
                    <div className="flex flex-col gap-3">
                      <label
                        htmlFor="certificado-template-upload"
                        className={cn(
                          'border border-dashed rounded-lg px-4 py-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
                          'border-muted-foreground/40 hover:border-[#00C9A7] hover:bg-[#00C9A7]/5'
                        )}
                      >
                        <Upload className="w-7 h-7 text-[#00C9A7] mb-2" />
                        <span className="text-sm font-medium text-foreground">
                          Arraste e solte uma imagem aqui
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          ou clique para selecionar um arquivo PNG ou JPG (até 5MB)
                        </span>
                        <input
                          id="certificado-template-upload"
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={handleTemplateFileChange}
                          disabled={templateUploading || templateLoading}
                        />
                      </label>
                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveTemplate}
                          disabled={templateUploading || templateLoading || !templateImageUrl}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Preview</h3>
                    {templateLoading ? (
                      <Skeleton className="w-full aspect-[16/9] rounded-lg" />
                    ) : templateImageUrl ? (
                      <div
                        ref={previewRef}
                        className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border bg-muted"
                        onMouseMove={handlePreviewMouseMove}
                        onMouseUp={handlePreviewMouseUp}
                        onMouseLeave={handlePreviewMouseUp}
                      >
                        <div
                          className="absolute inset-0 bg-center bg-cover"
                          style={{ backgroundImage: `url(${templateImageUrl})` }}
                        />
                        <div className="absolute inset-0 bg-black/10" />

                        {/* Nome */}
                        <div
                          className={cn(
                            'absolute text-center text-white font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                            'cursor-grab hover:outline hover:outline-1 hover:outline-dashed hover:outline-white/70'
                          )}
                          style={{
                            left: `${camposPosicoes.nome.x}%`,
                            top: `${camposPosicoes.nome.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onMouseDown={(event) => handleFieldMouseDown(event, 'nome')}
                        >
                          <span className="text-xl sm:text-2xl">João da Silva</span>
                        </div>

                        {/* Treinamento */}
                        <div
                          className={cn(
                            'absolute text-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                            'cursor-grab hover:outline hover:outline-1 hover:outline-dashed hover:outline-white/70'
                          )}
                          style={{
                            left: `${camposPosicoes.treinamento.x}%`,
                            top: `${camposPosicoes.treinamento.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onMouseDown={(event) => handleFieldMouseDown(event, 'treinamento')}
                        >
                          <span className="text-base sm:text-lg font-medium">
                            Nome do Treinamento
                          </span>
                        </div>

                        {/* Carga horária */}
                        <div
                          className={cn(
                            'absolute text-center text-white text-xs sm:text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                            'cursor-grab hover:outline hover:outline-1 hover:outline-dashed hover:outline-white/70'
                          )}
                          style={{
                            left: `${camposPosicoes.carga_horaria.x}%`,
                            top: `${camposPosicoes.carga_horaria.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onMouseDown={(event) => handleFieldMouseDown(event, 'carga_horaria')}
                        >
                          <span>40 horas</span>
                        </div>

                        {/* Data */}
                        <div
                          className={cn(
                            'absolute text-center text-white text-xs sm:text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                            'cursor-grab hover:outline hover:outline-1 hover:outline-dashed hover:outline-white/70'
                          )}
                          style={{
                            left: `${camposPosicoes.data.x}%`,
                            top: `${camposPosicoes.data.y}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          onMouseDown={(event) => handleFieldMouseDown(event, 'data')}
                        >
                          <span>
                            {new Date().toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-[16/9] rounded-lg border border-dashed border-muted-foreground/40 bg-muted flex items-center justify-center text-center px-6">
                        <p className="text-sm text-muted-foreground">
                          Faça upload da arte do certificado para visualizar o preview aqui.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-500 px-2 py-0.5">
                        <span className="text-[10px]">🔵</span>
                        Nome
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 text-green-500 px-2 py-0.5">
                        <span className="text-[10px]">🟢</span>
                        Treinamento
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 text-yellow-500 px-2 py-0.5">
                        <span className="text-[10px]">🟡</span>
                        Carga Horária
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-500 px-2 py-0.5">
                        <span className="text-[10px]">🔴</span>
                        Data
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Arraste os campos para posicioná-los na arte.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={() => saveTemplatePositions(camposPosicoes)}
                    disabled={templateUploading || templateLoading || !templateImageUrl}
                    className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                  >
                    Salvar Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={openNewSheet}
              className="w-full sm:w-auto shrink-0 bg-[#00C9A7] hover:bg-[#00C9A7]/90"
            >
              <Plus className="w-4 h-4" />
              Novo Treinamento
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <Input
            placeholder="Buscar por título"
            value={filtroTitulo}
            onChange={(e) => setFiltroTitulo(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filtroStatus}
            onValueChange={setFiltroStatus}
            open={filterSelectOpen === 'status'}
            onOpenChange={(open) => setFilterSelectOpen(open ? 'status' : null)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select
            value={filtroCategoria}
            onValueChange={setFiltroCategoria}
            open={filterSelectOpen === 'categoria'}
            onOpenChange={(open) => setFilterSelectOpen(open ? 'categoria' : null)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categoriasDistintas.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Nível</Label>
          <Select
            value={filtroNivel}
            onValueChange={setFiltroNivel}
            open={filterSelectOpen === 'nivel'}
            onOpenChange={(open) => setFilterSelectOpen(open ? 'nivel' : null)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Nível" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="basico">Básico</SelectItem>
              <SelectItem value="intermediario">Intermediário</SelectItem>
              <SelectItem value="avancado">Avançado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Modalidade</Label>
          <Select
            value={filtroModalidade}
            onValueChange={setFiltroModalidade}
            open={filterSelectOpen === 'modalidade'}
            onOpenChange={(open) => setFilterSelectOpen(open ? 'modalidade' : null)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleLimparFiltros}>
          Limpar Filtros
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-muted-foreground text-sm">Nenhum treinamento encontrado.</p>
            <p className="text-muted-foreground text-xs mt-1">
              {canManage ? 'Clique em Novo Treinamento para cadastrar.' : ''}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium w-24">Status</TableHead>
                <TableHead className="font-medium">Título</TableHead>
                <TableHead className="font-medium">Categoria</TableHead>
                <TableHead className="font-medium">Nível</TableHead>
                <TableHead className="font-medium">Modalidade</TableHead>
                <TableHead className="font-medium text-right w-28">C. Horária</TableHead>
                {canManage && (
                  <TableHead className="font-medium w-[140px] text-right">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const sc = statusConfig[item.status] ?? statusConfig.rascunho
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          sc.className
                        )}
                      >
                        {sc.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium max-w-52 truncate">{item.titulo}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.categoria ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {item.nivel ? nivelOptions.find((o) => o.value === item.nivel)?.label ?? item.nivel : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {item.modalidade ? modalidadeOptions.find((o) => o.value === item.modalidade)?.label ?? item.modalidade : '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.carga_horaria != null ? `${item.carga_horaria}h` : '—'}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditSheet(item)}
                            className="gap-1"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => openDeleteDialog(item)}
                            aria-label="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold">
              {editingItem ? 'Editar Treinamento' : 'Novo Treinamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-6 pt-2">
            <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input
                  id="titulo"
                  placeholder="Ex.: Gestão de Projetos"
                  {...register('titulo')}
                />
                {errors.titulo && (
                  <p className="text-destructive text-xs">{errors.titulo.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="conteudo">Conteúdo Programático</Label>
                <Textarea
                  id="conteudo"
                  className="min-h-[100px] resize-y"
                  placeholder="Descreva os temas..."
                  {...register('conteudo_programatico')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objetivo">Objetivo</Label>
                <Textarea
                  id="objetivo"
                  className="min-h-[100px] resize-y"
                  placeholder="Qual o objetivo?"
                  {...register('objetivo')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carga_horaria">Carga Horária (horas)</Label>
                <div className="relative">
                  <Input
                    id="carga_horaria"
                    type="number"
                    min={0}
                    step={0.5}
                    className="pr-14"
                    {...register('carga_horaria', { valueAsNumber: true })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    horas
                  </span>
                </div>
                {errors.carga_horaria && (
                  <p className="text-destructive text-xs">{errors.carga_horaria.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Controller
                  control={control}
                  name="categoria"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.nome}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Nível</Label>
                <Controller
                  control={control}
                  name="nivel"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {nivelOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Controller
                  control={control}
                  name="modalidade"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {modalidadeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imagem_url">Imagem/Capa (URL)</Label>
                <Input
                  id="imagem_url"
                  type="url"
                  placeholder="https://..."
                  {...register('imagem_url')}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeSheet}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="bg-[#00C9A7] hover:bg-[#00C9A7]/90">
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert Excluir */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treinamento do catálogo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{itemToDelete?.titulo}&quot;? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
