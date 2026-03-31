'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Pencil, Trash2, Award, Upload, Globe, Download } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { useCatalogoModuloPlataforma } from '@/lib/use-catalogo-modulo-plataforma'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  POOL_GLOBAL_TERMO_TEXTO,
  POOL_GLOBAL_TERMO_VERSAO,
  termoPoolGlobalAtual,
} from '@/lib/catalogo-pool-global'
import { NIVEL_LABEL } from '@/lib/catalogo'
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
import { ScrollArea } from '@/components/ui/scroll-area'

type CamposPosicoes = {
  corpo: { x: number; y: number; texto: string; fontSize: number; maxWidth: number }
  data: { x: number; y: number; texto: string; fontSize: number; maxWidth: number }
}

const defaultCamposPosicoes: CamposPosicoes = {
  corpo: {
    x: 50,
    y: 55,
    texto:
      'Certificamos que {{nome}} participou do treinamento "{{treinamento}}" com carga horária de {{carga_horaria}} horas.',
    fontSize: 16,
    maxWidth: 80,
  },
  data: {
    x: 50,
    y: 80,
    texto: '{{data}}',
    fontSize: 13,
    maxWidth: 40,
  },
}

export async function gerarCertificadoPDF(params: {
  templateImageUrl: string
  camposPosicoes: CamposPosicoes
  nomeColaborador: string
  nomeTreinamento: string
  cargaHoraria: string
  dataConclusao: string
}) {
  const {
    templateImageUrl,
    camposPosicoes,
    nomeColaborador,
    nomeTreinamento,
    cargaHoraria,
    dataConclusao,
  } = params

  if (typeof document === 'undefined') return

  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas')).default

  const PDF_WIDTH = 1122
  const previewWidthMeta = (camposPosicoes as any)._previewWidth ?? 800
  const scaleFactor = PDF_WIDTH / previewWidthMeta

  const corpoFontSize = Math.round((camposPosicoes.corpo.fontSize ?? 16) * scaleFactor)
  const dataFontSize = Math.round((camposPosicoes.data.fontSize ?? 13) * scaleFactor)

  let dataExtenso = dataConclusao
  try {
    const dateObj = dataConclusao ? new Date(dataConclusao) : new Date()
    if (!isNaN(dateObj.getTime())) {
      dataExtenso = dateObj.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
  } catch {
    dataExtenso = new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const substituir = (texto: string) =>
    (texto ?? '')
      .replace(/\{\{\s*nome\s*\}\}/g, nomeColaborador)
      .replace(/\{\{\s*treinamento\s*\}\}/g, nomeTreinamento)
      .replace(/\{\{\s*carga_horaria\s*\}\}/g, cargaHoraria)
      .replace(/\{\{\s*data\s*\}\}/g, dataExtenso)

  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:-9999px;width:1122px;height:794px;border:none;'
  document.body.appendChild(iframe)

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) throw new Error('Não foi possível acessar o iframe')

    iframeDoc.open()
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1122px;
    height: 794px;
    background-image: url('${templateImageUrl}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    background-color: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
    position: relative;
    overflow: hidden;
  }
  .campo {
    word-wrap: break-word;
  }
</style>
</head>
<body>
  <div class="campo" style="
    left: ${camposPosicoes.corpo.x}%;
    top: ${camposPosicoes.corpo.y}%;
    width: ${camposPosicoes.corpo.maxWidth ?? 80}%;
    font-size: ${corpoFontSize}px;
    color: #1a1a1a;
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.4;
    position: absolute;
    transform: translate(-50%, -50%);
  ">${substituir(camposPosicoes.corpo.texto ?? '')}</div>
  <div class="campo" style="
    left: ${camposPosicoes.data.x}%;
    top: ${camposPosicoes.data.y}%;
    width: ${camposPosicoes.data.maxWidth ?? 40}%;
    font-size: ${dataFontSize}px;
    color: #1a1a1a;
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.4;
    position: absolute;
    transform: translate(-50%, -50%);
  ">${substituir(camposPosicoes.data.texto ?? '')}</div>
</body>
</html>`)
    iframeDoc.close()

    await new Promise((resolve) => setTimeout(resolve, 800))

    const canvas = await html2canvas(iframeDoc.body, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      width: 1122,
      height: 794,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

    const safeNome = nomeColaborador.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    const safeTreinamento = nomeTreinamento.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    pdf.save(`certificado-${safeNome}-${safeTreinamento}.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}

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
  pool_global_consentimento?: boolean | null
  pool_global_consentimento_em?: string | null
  pool_global_termo_versao?: string | null
  pool_global_linhagem_id?: string | null
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
  pool_global_consentimento: boolean
}

type CatalogoGlobalRow = {
  id: string
  titulo: string
  categoria: string | null
  nivel: string | null
  versao: number
}

export default function CatalogoPage() {
  const { user, getActiveTenantId } = useUser()
  const { catalogoModuloPlataformaAtivo, loadingCatalogoPlataforma } =
    useCatalogoModuloPlataforma()
  const poolGlobalUiDisponivel =
    !loadingCatalogoPlataforma && catalogoModuloPlataformaAtivo
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
  const [camposPosicoes, setCamposPosicoes] = useState<CamposPosicoes>(defaultCamposPosicoes)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const draggingFieldRef = useRef<keyof CamposPosicoes | null>(null)
  const [templateTestingPdf, setTemplateTestingPdf] = useState(false)
  const [poolTermoDialogOpen, setPoolTermoDialogOpen] = useState(false)
  const [poolTermoAceito, setPoolTermoAceito] = useState(false)
  const [importGlobalOpen, setImportGlobalOpen] = useState(false)
  const [importGlobalLoading, setImportGlobalLoading] = useState(false)
  const [importGlobalRows, setImportGlobalRows] = useState<CatalogoGlobalRow[]>([])
  const [importGlobalSearch, setImportGlobalSearch] = useState('')
  const [importingGlobalId, setImportingGlobalId] = useState<string | null>(null)
  const [globalIdsJaImportados, setGlobalIdsJaImportados] = useState<Set<string>>(new Set())

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
    setValue,
    watch,
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
      pool_global_consentimento: false,
    },
  })

  const statusWatch = watch('status')

  useEffect(() => {
    if (statusWatch !== 'ativo') {
      setValue('pool_global_consentimento', false)
      setPoolTermoAceito(false)
    }
  }, [statusWatch, setValue])

  const categoriasDistintas = useMemo(() => {
    const set = new Set<string>()
    items.forEach((i) => {
      if (i.categoria?.trim()) set.add(i.categoria.trim())
    })
    return Array.from(set).sort()
  }, [items])

  const importGlobalFiltrados = useMemo(() => {
    const t = importGlobalSearch.trim().toLowerCase()
    if (!t) return importGlobalRows
    return importGlobalRows.filter(
      (r) =>
        r.titulo.toLowerCase().includes(t) || (r.categoria ?? '').toLowerCase().includes(t)
    )
  }, [importGlobalRows, importGlobalSearch])

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

      const typed = data as {
        imagem_url: string | null
        campos_posicoes?: Partial<CamposPosicoes>
      } | null

      if (typed?.imagem_url) {
        setTemplateImageUrl(`${typed.imagem_url}?t=${Date.now()}`)
      } else {
        setTemplateImageUrl(null)
      }

      if (typed?.campos_posicoes) {
        setCamposPosicoes((prev) => ({
          corpo: {
            x: typed.campos_posicoes.corpo?.x ?? prev.corpo.x,
            y: typed.campos_posicoes.corpo?.y ?? prev.corpo.y,
            texto: typed.campos_posicoes.corpo?.texto ?? prev.corpo.texto,
            fontSize: typed.campos_posicoes.corpo?.fontSize ?? prev.corpo.fontSize ?? 16,
            maxWidth: typed.campos_posicoes.corpo?.maxWidth ?? prev.corpo.maxWidth ?? 80,
          },
          data: {
            x: typed.campos_posicoes.data?.x ?? prev.data.x,
            y: typed.campos_posicoes.data?.y ?? prev.data.y,
            texto: typed.campos_posicoes.data?.texto ?? prev.data.texto,
            fontSize: typed.campos_posicoes.data?.fontSize ?? prev.data.fontSize ?? 13,
            maxWidth: typed.campos_posicoes.data?.maxWidth ?? prev.data.maxWidth ?? 40,
          },
        }))
      } else {
        setCamposPosicoes(defaultCamposPosicoes)
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

      const urlComCache = `${publicUrl}?t=${Date.now()}`
      setTemplateImageUrl(urlComCache)
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

  const saveTemplatePositions = async (positions: CamposPosicoes) => {
    if (!activeTenantId) return
    try {
      const supabase = createClient()
      const previewWidth = previewRef.current?.getBoundingClientRect().width ?? 800
      const { error } = await supabase.from('certificado_templates').upsert(
        {
          tenant_id: activeTenantId,
          imagem_url: templateImageUrl,
          campos_posicoes: {
            ...positions,
            _previewWidth: previewWidth,
          } as any,
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
    if (!previewRef.current || !draggingFieldRef.current) return

    const rect = previewRef.current.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const relativeX = ((event.clientX - rect.left) / rect.width) * 100
    const relativeY = ((event.clientY - rect.top) / rect.height) * 100

    const xPercent = Math.min(95, Math.max(5, relativeX))
    const yPercent = Math.min(95, Math.max(5, relativeY))

    const fieldKey = draggingFieldRef.current
    setCamposPosicoes((prev) => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        x: xPercent,
        y: yPercent,
      },
    }))
  }

  const handlePreviewMouseUp = async () => {
    if (!draggingFieldRef.current) return
    const positions = { ...camposPosicoes }
    draggingFieldRef.current = null
    await saveTemplatePositions(positions)
  }

  const handleFieldMouseDown = (event: any, field: keyof CamposPosicoes) => {
    event.preventDefault()
    draggingFieldRef.current = field
  }

  const openNewSheet = () => {
    setEditingItem(null)
    setPoolTermoAceito(false)
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
      pool_global_consentimento: false,
    })
    setSheetOpen(true)
  }

  const openEditSheet = (item: CatalogoItem) => {
    setEditingItem(item)
    setPoolTermoAceito(
      termoPoolGlobalAtual(!!item.pool_global_consentimento, item.pool_global_termo_versao ?? null)
    )
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
      pool_global_consentimento: !!item.pool_global_consentimento,
    })
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setEditingItem(null)
  }

  const loadImportGlobalLista = async () => {
    if (!activeTenantId) return
    setImportGlobalLoading(true)
    try {
      const [globRes, localRes] = await Promise.all([
        supabase
          .from('catalogo_treinamentos_globais')
          .select('id, titulo, categoria, nivel, modalidade, carga_horaria, versao')
          .eq('status', 'publicado')
          .order('titulo', { ascending: true }),
        supabase
          .from('catalogo_treinamentos')
          .select('copiado_de_global_id')
          .eq('tenant_id', activeTenantId)
          .not('copiado_de_global_id', 'is', null),
      ])
      if (globRes.error) throw globRes.error
      if (localRes.error) throw localRes.error
      setImportGlobalRows((globRes.data as CatalogoGlobalRow[]) ?? [])
      const s = new Set<string>()
      for (const r of localRes.data ?? []) {
        const id = (r as { copiado_de_global_id: string | null }).copiado_de_global_id
        if (id) s.add(id)
      }
      setGlobalIdsJaImportados(s)
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar o catálogo global.')
      setImportGlobalRows([])
    } finally {
      setImportGlobalLoading(false)
    }
  }

  const importarDoGlobal = async (globalId: string) => {
    if (!activeTenantId || !user?.id) return
    if (globalIdsJaImportados.has(globalId)) return
    setImportingGlobalId(globalId)
    try {
      const { data: full, error: fe } = await supabase
        .from('catalogo_treinamentos_globais')
        .select(
          'id, titulo, conteudo_programatico, objetivo, carga_horaria, categoria, nivel, modalidade, imagem_url'
        )
        .eq('id', globalId)
        .eq('status', 'publicado')
        .maybeSingle()
      if (fe) throw fe
      if (!full) {
        toast.error('Item não disponível.')
        return
      }
      const row = full as Record<string, unknown>
      const { error } = await supabase.from('catalogo_treinamentos').insert({
        tenant_id: activeTenantId,
        titulo: row.titulo as string,
        conteudo_programatico: (row.conteudo_programatico as string | null) ?? null,
        objetivo: (row.objetivo as string | null) ?? null,
        carga_horaria: (row.carga_horaria as number | null) ?? null,
        categoria: (row.categoria as string | null) ?? null,
        nivel: (row.nivel as string | null) ?? null,
        modalidade: (row.modalidade as string | null) ?? null,
        imagem_url: (row.imagem_url as string | null) ?? null,
        status: 'rascunho',
        criado_por: user.id,
        copiado_de_global_id: row.id as string,
        pool_global_consentimento: false,
        pool_global_consentimento_em: null,
        pool_global_termo_versao: null,
        pool_global_linhagem_id: null,
      })
      if (error) throw error
      toast.success('Cópia criada em rascunho. Revise os dados e publique quando quiser.')
      setGlobalIdsJaImportados((prev) => {
        const next = new Set(prev)
        next.add(globalId)
        return next
      })
      setImportGlobalOpen(false)
      setImportGlobalSearch('')
      fetchCatalogo()
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível importar.')
    } finally {
      setImportingGlobalId(null)
    }
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

    if (poolGlobalUiDisponivel) {
      const consentEfetivoCheck =
        values.status === 'ativo' ? values.pool_global_consentimento : false
      if (values.status === 'ativo' && consentEfetivoCheck) {
        const aceiteOk =
          poolTermoAceito ||
          (!!editingItem &&
            termoPoolGlobalAtual(
              !!editingItem.pool_global_consentimento,
              editingItem.pool_global_termo_versao ?? null
            ))
        if (!aceiteOk) {
          toast.error('Leia e aceite o termo do catálogo global antes de salvar.')
          setPoolTermoDialogOpen(true)
          return
        }
      }
    }

    setSubmitting(true)
    try {
      const agora = new Date().toISOString()

      let consentEfetivo: boolean
      let consentEm: string | null
      let poolTermoVersaoVal: string | null

      if (poolGlobalUiDisponivel) {
        consentEfetivo = values.status === 'ativo' ? values.pool_global_consentimento : false
        consentEm = consentEfetivo
          ? editingItem?.pool_global_consentimento
            ? editingItem.pool_global_consentimento_em ?? agora
            : agora
          : null
        poolTermoVersaoVal = consentEfetivo ? POOL_GLOBAL_TERMO_VERSAO : null
      } else if (values.status === 'ativo' && editingItem) {
        consentEfetivo = !!editingItem.pool_global_consentimento
        consentEm = editingItem.pool_global_consentimento_em ?? null
        poolTermoVersaoVal = editingItem.pool_global_termo_versao ?? null
      } else {
        consentEfetivo = false
        consentEm = null
        poolTermoVersaoVal = null
      }

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
        atualizado_em: agora,
        pool_global_consentimento: consentEfetivo,
        pool_global_consentimento_em: consentEm,
        pool_global_termo_versao: poolTermoVersaoVal,
      }

      let catalogId: string
      let linhagemId: string

      if (editingItem) {
        linhagemId = editingItem.pool_global_linhagem_id ?? editingItem.id
        const { error } = await supabase
          .from('catalogo_treinamentos')
          .update({
            ...payload,
            pool_global_linhagem_id: linhagemId,
          })
          .eq('id', editingItem.id)
        if (error) throw error
        catalogId = editingItem.id
      } else {
        const { data: inserted, error } = await supabase
          .from('catalogo_treinamentos')
          .insert({
            ...payload,
            pool_global_linhagem_id: null,
            tenant_id: activeTenantId,
            criado_por: user?.id ?? null,
          })
          .select('id')
          .single()
        if (error) throw error
        catalogId = inserted.id
        linhagemId = catalogId
        const { error: lineageErr } = await supabase
          .from('catalogo_treinamentos')
          .update({ pool_global_linhagem_id: linhagemId })
          .eq('id', catalogId)
        if (lineageErr) throw lineageErr
      }

      let mensagemOk = editingItem
        ? 'Treinamento atualizado com sucesso.'
        : 'Treinamento cadastrado com sucesso.'

      if (
        poolGlobalUiDisponivel &&
        values.status === 'ativo' &&
        consentEfetivo &&
        !user?.isMaster?.()
      ) {
        const { data: maxGlob } = await supabase
          .from('catalogo_treinamentos_globais')
          .select('versao')
          .eq('linhagem_id', linhagemId)
          .order('versao', { ascending: false })
          .limit(1)
          .maybeSingle()
        const nextVersao = (maxGlob?.versao ?? 0) + 1

        await supabase
          .from('catalogo_global_submissoes')
          .delete()
          .eq('catalogo_local_id', catalogId)
          .eq('status', 'pendente')

        const { error: subErr } = await supabase.from('catalogo_global_submissoes').insert({
          tenant_id: activeTenantId,
          catalogo_local_id: catalogId,
          linhagem_id: linhagemId,
          versao: nextVersao,
          titulo: tituloTrimmed,
          conteudo_programatico: values.conteudo_programatico?.trim() || null,
          objetivo: values.objetivo?.trim() || null,
          carga_horaria: values.carga_horaria,
          categoria: values.categoria?.trim() || null,
          nivel: values.nivel || null,
          modalidade: values.modalidade || null,
          imagem_url: values.imagem_url?.trim() || null,
          status: 'pendente',
        })
        if (subErr) {
          console.error('Pool global — submissão:', subErr)
          toast.error('Salvo localmente, mas não foi possível enviar à fila global do TrainHub.')
        } else {
          mensagemOk += ' Enviado à moderação do catálogo global.'
        }
      }

      toast.success(mensagemOk)
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

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-foreground">Configurar Textos</h3>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Texto principal</Label>
                        <Textarea
                          rows={3}
                          value={camposPosicoes.corpo.texto ?? ''}
                          onChange={(e) =>
                            setCamposPosicoes((prev) => ({
                              ...prev,
                              corpo: { ...prev.corpo, texto: e.target.value ?? '' },
                            }))
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
                          <Input
                            type="number"
                            min={8}
                            max={48}
                            step={1}
                            value={camposPosicoes.corpo.fontSize}
                            onChange={(e) =>
                              setCamposPosicoes((prev) => ({
                                ...prev,
                                corpo: {
                                  ...prev.corpo,
                                  fontSize: Math.min(
                                    48,
                                    Math.max(8, Number(e.target.value) || prev.corpo.fontSize)
                                  ),
                                },
                              }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Largura da caixa (%)
                          </Label>
                          <Input
                            type="number"
                            min={10}
                            max={100}
                            step={5}
                            value={camposPosicoes.corpo.maxWidth}
                            onChange={(e) =>
                              setCamposPosicoes((prev) => {
                                const val = Number(e.target.value)
                                const clamped = Math.min(100, Math.max(10, val || prev.corpo.maxWidth))
                                return {
                                  ...prev,
                                  corpo: {
                                    ...prev.corpo,
                                    maxWidth: clamped,
                                  },
                                }
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Formato da data</Label>
                        <Input
                          value={camposPosicoes.data.texto ?? ''}
                          onChange={(e) =>
                            setCamposPosicoes((prev) => ({
                              ...prev,
                              data: { ...prev.data, texto: e.target.value ?? '' },
                            }))
                          }
                          className="text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
                          <Input
                            type="number"
                            min={8}
                            max={48}
                            step={1}
                            value={camposPosicoes.data.fontSize}
                            onChange={(e) =>
                              setCamposPosicoes((prev) => ({
                                ...prev,
                                data: {
                                  ...prev.data,
                                  fontSize: Math.min(
                                    48,
                                    Math.max(8, Number(e.target.value) || prev.data.fontSize)
                                  ),
                                },
                              }))
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Largura da caixa (%)
                          </Label>
                          <Input
                            type="number"
                            min={10}
                            max={100}
                            step={5}
                            value={camposPosicoes.data.maxWidth}
                            onChange={(e) =>
                              setCamposPosicoes((prev) => {
                                const val = Number(e.target.value)
                                const clamped = Math.min(100, Math.max(10, val || prev.data.maxWidth))
                                return {
                                  ...prev,
                                  data: {
                                    ...prev.data,
                                    maxWidth: clamped,
                                  },
                                }
                              })
                            }
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {['{{nome}}', '{{treinamento}}', '{{carga_horaria}}', '{{data}}'].map(
                            (variable) => (
                              <button
                                key={variable}
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(variable)
                                    toast.success('Variável copiada!')
                                  } catch {
                                    toast.error('Não foi possível copiar a variável.')
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded-full bg-[#00C9A7]/10 text-[#00C9A7] px-2 py-0.5 hover:bg-[#00C9A7]/20 transition-colors"
                              >
                                <span className="text-[11px] font-mono">{variable}</span>
                              </button>
                            )
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use as variáveis acima para inserir dados dinâmicos.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-foreground">Preview</h3>
                      {templateLoading ? (
                        <Skeleton className="w-full rounded-lg" style={{ aspectRatio: '1122/794' }} />
                      ) : templateImageUrl ? (
                        <div
                          ref={previewRef}
                          className="relative w-full rounded-lg overflow-hidden border border-border bg-muted"
                          style={{ aspectRatio: '1122/794' }}
                          onMouseMove={handlePreviewMouseMove}
                          onMouseUp={handlePreviewMouseUp}
                          onMouseLeave={handlePreviewMouseUp}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${templateImageUrl})`,
                              backgroundSize: 'contain',
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'center',
                            }}
                          />
                        <div className="absolute inset-0 bg-black/10" />

                        {/* Corpo */}
                        <div
                          className={cn(
                            'absolute text-center text-xs sm:text-sm',
                            'cursor-grab',
                            draggingFieldRef.current === 'corpo' &&
                              'outline outline-2 outline-dashed outline-[#00C9A7] outline-offset-4'
                          )}
                          style={{
                            left: `${camposPosicoes.corpo.x}%`,
                            top: `${camposPosicoes.corpo.y}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${camposPosicoes.corpo.maxWidth}%`,
                            color: '#1a1a1a',
                            textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                            fontSize: `${camposPosicoes.corpo.fontSize}px`,
                          }}
                          onMouseDown={(event) => handleFieldMouseDown(event, 'corpo')}
                        >
                          <span className="leading-snug block text-center">
                            {(camposPosicoes.corpo?.texto ?? '')
                              .replace(/{{\s*nome\s*}}/g, 'João da Silva')
                              .replace(/{{\s*treinamento\s*}}/g, 'Nome do Treinamento')
                              .replace(/{{\s*carga_horaria\s*}}/g, '40')
                              .replace(
                                /{{\s*data\s*}}/g,
                                new Date().toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })
                              )}
                          </span>
                        </div>

                        {/* Data */}
                        <div
                          className={cn(
                            'absolute text-center text-xs sm:text-sm',
                            'cursor-grab',
                            draggingFieldRef.current === 'data' &&
                              'outline outline-2 outline-dashed outline-[#00C9A7] outline-offset-4'
                          )}
                          style={{
                            left: `${camposPosicoes.data.x}%`,
                            top: `${camposPosicoes.data.y}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${camposPosicoes.data.maxWidth}%`,
                            color: '#1a1a1a',
                            textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                            fontSize: `${camposPosicoes.data.fontSize}px`,
                          }}
                          onMouseDown={(event) => handleFieldMouseDown(event, 'data')}
                        >
                          <span className="block text-center">
                            {(camposPosicoes.data?.texto ?? '').replace(
                              /{{\s*data\s*}}/g,
                              new Date().toLocaleDateString('pt-BR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })
                            )}
                          </span>
                        </div>
                        </div>
                      ) : (
                        <div
                          className="w-full rounded-lg border border-dashed border-muted-foreground/40 bg-muted flex items-center justify-center text-center px-6"
                          style={{ aspectRatio: '1122/794' }}
                        >
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
                          Texto Principal
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-500 px-2 py-0.5">
                          <span className="text-[10px]">🔴</span>
                          Data
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Arraste as caixas de texto para posicioná-las na arte.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      templateUploading || templateLoading || !templateImageUrl || templateTestingPdf
                    }
                    onClick={async () => {
                      if (!templateImageUrl) return
                      setTemplateTestingPdf(true)
                      try {
                        const hojeISO = new Date().toISOString().split('T')[0]
                        await gerarCertificadoPDF({
                          templateImageUrl,
                          camposPosicoes: {
                            ...(camposPosicoes as CamposPosicoes),
                            _previewWidth:
                              previewRef.current?.getBoundingClientRect().width ?? 800,
                          } as any,
                          nomeColaborador: 'João da Silva',
                          nomeTreinamento: 'Nome do Treinamento',
                          cargaHoraria: '40',
                          dataConclusao: hojeISO,
                        })
                      } catch (error) {
                        console.error('Erro ao gerar PDF de teste do certificado:', error)
                        toast.error('Não foi possível gerar o PDF de teste.')
                      } finally {
                        setTemplateTestingPdf(false)
                      }
                    }}
                  >
                    {templateTestingPdf ? 'Gerando PDF...' : 'Testar PDF'}
                  </Button>
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

            {poolGlobalUiDisponivel && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!activeTenantId}
                  className="w-full sm:w-auto shrink-0 border-[#00C9A7]/60 text-[#00C9A7] hover:bg-[#00C9A7]/5"
                  onClick={() => {
                    setImportGlobalOpen(true)
                    void loadImportGlobalLista()
                  }}
                >
                  <Globe className="w-4 h-4 mr-1.5" />
                  Importar do global
                </Button>
                <Dialog
                  open={importGlobalOpen}
                  onOpenChange={(open) => {
                    setImportGlobalOpen(open)
                    if (!open) setImportGlobalSearch('')
                    if (open) void loadImportGlobalLista()
                  }}
                >
                  <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="font-serif text-2xl">Importar do catálogo global</DialogTitle>
                      <DialogDescription>
                        Cria um <strong className="text-foreground font-medium">rascunho</strong> no seu
                        catálogo local com metadados e conteúdo programático. Você pode editar antes de
                        publicar. Cada origem global só pode ser importada uma vez por tenant (exclua a cópia
                        se precisar importar de novo).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                      <Input
                        placeholder="Buscar por título ou categoria..."
                        value={importGlobalSearch}
                        onChange={(e) => setImportGlobalSearch(e.target.value)}
                        className="max-w-md"
                      />
                      {importGlobalLoading ? (
                        <div className="space-y-2 py-4">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : importGlobalFiltrados.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6">
                          {importGlobalRows.length === 0
                            ? 'Nenhum treinamento publicado no catálogo global no momento.'
                            : 'Nenhum resultado para a busca.'}
                        </p>
                      ) : (
                        <ScrollArea className="h-[min(420px,50vh)] border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                                <TableHead className="hidden md:table-cell">Nível</TableHead>
                                <TableHead className="text-right w-[120px]">Ação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importGlobalFiltrados.map((r) => {
                                const ja = globalIdsJaImportados.has(r.id)
                                const niv = r.nivel
                                  ? NIVEL_LABEL[r.nivel as keyof typeof NIVEL_LABEL] ?? r.nivel
                                  : '—'
                                return (
                                  <TableRow key={r.id}>
                                    <TableCell>
                                      <span className="font-medium line-clamp-2">{r.titulo}</span>
                                      <span className="sm:hidden text-xs text-muted-foreground block mt-1">
                                        {r.categoria ?? '—'} · v{r.versao}
                                      </span>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                                      {r.categoria ?? '—'}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                      {niv}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {ja ? (
                                        <span className="text-xs text-muted-foreground">Já importado</span>
                                      ) : (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          className="gap-1"
                                          disabled={importingGlobalId !== null}
                                          onClick={() => importarDoGlobal(r.id)}
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          {importingGlobalId === r.id ? '...' : 'Importar'}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setImportGlobalOpen(false)}>
                        Fechar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

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
                    <TableCell className="font-medium max-w-[14rem]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{item.titulo}</span>
                        {item.copiado_de_global_id ? (
                          <span
                            className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#00C9A7]/15 text-[#00C9A7]"
                            title="Cópia importada do catálogo global"
                          >
                            Global
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
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
              {poolGlobalUiDisponivel && statusWatch === 'ativo' && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Controller
                      control={control}
                      name="pool_global_consentimento"
                      render={({ field }) => (
                        <Checkbox
                          id="pool_global_consent"
                          checked={field.value}
                          className="mt-1"
                          onCheckedChange={(c) => {
                            const on = c === true
                            if (on) {
                              const jaNoDb =
                                editingItem &&
                                termoPoolGlobalAtual(
                                  !!editingItem.pool_global_consentimento,
                                  editingItem.pool_global_termo_versao ?? null
                                )
                              if (jaNoDb) {
                                field.onChange(true)
                                setPoolTermoAceito(true)
                              } else {
                                setPoolTermoDialogOpen(true)
                              }
                            } else {
                              field.onChange(false)
                              setPoolTermoAceito(false)
                            }
                          }}
                        />
                      )}
                    />
                    <div className="space-y-1 min-w-0">
                      <Label
                        htmlFor="pool_global_consent"
                        className="text-sm font-medium leading-snug cursor-pointer"
                      >
                        Enviar para o catálogo global TrainHub (após aprovação da equipe Master)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Inclui apenas metadados e conteúdo programático que você cadastrou aqui, sem dados
                        pessoais. Itens em rascunho ou inativos não entram na fila.
                      </p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-[#00C9A7]"
                        onClick={() => setPoolTermoDialogOpen(true)}
                      >
                        Ler termo de consentimento (versão {POOL_GLOBAL_TERMO_VERSAO})
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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

      {poolGlobalUiDisponivel && (
        <Dialog open={poolTermoDialogOpen} onOpenChange={setPoolTermoDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Catálogo global TrainHub</DialogTitle>
              <DialogDescription>Termo de consentimento — versão {POOL_GLOBAL_TERMO_VERSAO}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{POOL_GLOBAL_TERMO_TEXTO}</p>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPoolTermoDialogOpen(false)
                  setValue('pool_global_consentimento', false)
                  setPoolTermoAceito(false)
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                onClick={() => {
                  setPoolTermoAceito(true)
                  setValue('pool_global_consentimento', true)
                  setPoolTermoDialogOpen(false)
                  if (statusWatch !== 'ativo') {
                    toast.message('Altere o status para "Ativo" para enfileirar no global.')
                  }
                }}
              >
                Li e aceito
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
