'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Power, PowerOff, ArrowLeft, Trash2, Search, FileSpreadsheet, Download, Upload, Copy, KeyRound, Check } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { parseExcelFile, getExcelValue, downloadUserImportTemplate } from '@/lib/excel-utils'

interface Tenant {
  id: string
  nome: string
  slug: string
  ativo: boolean
  criado_em: string
}

interface Perfil {
  id: string
  nome: string
}

interface Usuario {
  id: string
  nome: string
  email: string
  ativo: boolean
  perfis: { nome: string } | null
}

const tenantSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  slug: z
    .string()
    .min(1, 'Slug obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Slug: apenas letras minúsculas, números e hífens'),
  ativo: z.boolean(),
})

const addUserSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().min(1, 'E-mail obrigatório').email('E-mail inválido'),
  perfil_id: z.string().min(1, 'Selecione o perfil'),
})

type TenantFormData = z.infer<typeof tenantSchema>
type AddUserFormData = z.infer<typeof addUserSchema>

type ImportStep = 1 | 2 | 3

interface ValidatedRow {
  nome: string
  email: string
  perfil: string
  perfilId: string
  valid: boolean
  error?: string
}

interface CreatedUser {
  nome: string
  email: string
  senha: string
}

const HEADER_ALIASES = {
  nome: ['Nome Completo', 'Nome'],
  email: ['E-mail', 'Email'],
  perfil: ['Perfil'],
} as const

function generateTempPassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function TenantEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string | undefined
  const { user, loading: userLoading } = useUser()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [deleteUserOpen, setDeleteUserOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importStep, setImportStep] = useState<ImportStep>(1)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importCreated, setImportCreated] = useState<CreatedUser[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importDragActive, setImportDragActive] = useState(false)
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [resetPasswordValue, setResetPasswordValue] = useState<string | null>(null)
  const [resetPasswordCopied, setResetPasswordCopied] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  const tenantForm = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
  })
  const addUserForm = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { nome: '', email: '', perfil_id: '' },
  })

  const supabase = createClient()

  useEffect(() => {
    if (!userLoading && (!user || !user.isMaster())) {
      router.push('/dashboard')
      return
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!id) return

    const fetch = async () => {
      setLoading(true)
      try {
        const { data: tenantData, error: tenantErr } = await supabase
          .from('tenants')
          .select('id, nome, slug, ativo, criado_em')
          .eq('id', id)
          .single()

        if (tenantErr || !tenantData) {
          toast.error('Tenant não encontrado')
          router.replace('/dashboard/configuracoes/tenants')
          return
        }

        setTenant(tenantData as Tenant)
        tenantForm.reset({
          nome: (tenantData as Tenant).nome,
          slug: (tenantData as Tenant).slug,
          ativo: (tenantData as Tenant).ativo,
        })

        const [usersRes, perfisRes] = await Promise.all([
          supabase
            .from('usuarios')
            .select('id, nome, email, ativo, perfis(nome)')
            .eq('tenant_id', id)
            .order('nome'),
          supabase.from('perfis').select('id, nome').eq('tenant_id', id).order('nome'),
        ])

        if (usersRes.error) throw usersRes.error
        if (perfisRes.error) throw perfisRes.error
        setUsuarios((usersRes.data as Usuario[]) ?? [])
        setPerfis((perfisRes.data as Perfil[]) ?? [])
      } catch (err) {
        console.error(err)
        toast.error('Erro ao carregar tenant')
        router.replace('/dashboard/configuracoes/tenants')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [id, router, supabase])

  const onSaveTenant = async (data: TenantFormData) => {
    if (!id) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ nome: data.nome, slug: data.slug, ativo: data.ativo })
        .eq('id', id)

      if (error) {
        if (error.code === '23505') toast.error('Slug já existe. Escolha outro.')
        else toast.error(error.message)
        return
      }
      toast.success('Tenant atualizado com sucesso.')
      setTenant((prev) => (prev ? { ...prev, ...data } : null))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleTenantAtivo = async () => {
    if (!tenant) return
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ ativo: !tenant.ativo })
        .eq('id', id)

      if (error) throw error
      toast.success(tenant.ativo ? 'Tenant desativado' : 'Tenant ativado')
      setTenant((prev) => (prev ? { ...prev, ativo: !prev.ativo } : null))
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const onAddUser = async (data: AddUserFormData) => {
    if (!id) return
    try {
      const senha = generateTempPassword()
      const response = await fetch('/api/admin/criar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.nome,
          email: data.email,
          senha,
          tenant_id: id,
          perfil_id: data.perfil_id,
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Erro ao criar usuário')

      setTempPassword(senha)
      toast.success('Usuário criado. Anote a senha temporária.')
      addUserForm.reset({ nome: '', email: '', perfil_id: '' })
      setAddUserOpen(false)

      const { data: usersData } = await supabase
        .from('usuarios')
        .select('id, nome, email, ativo, perfis(nome)')
        .eq('tenant_id', id)
        .order('nome')
      setUsuarios((usersData as Usuario[]) ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário')
    }
  }

  const toggleUsuarioAtivo = async (u: Usuario) => {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo: !u.ativo })
        .eq('id', u.id)

      if (error) throw error
      toast.success(u.ativo ? 'Usuário desativado' : 'Usuário ativado')
      setUsuarios((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, ativo: !x.ativo } : x))
      )
    } catch {
      toast.error('Erro ao atualizar usuário')
    }
  }

  const openDeleteUserDialog = (u: Usuario) => {
    setUserToDelete(u)
    setDeleteUserOpen(true)
  }

  const handleDeleteUser = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!userToDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/deletar-usuario?userId=${userToDelete.id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Erro ao excluir usuário')
      toast.success('Usuário excluído com sucesso')
      setUsuarios((prev) => prev.filter((x) => x.id !== userToDelete.id))
      setDeleteUserOpen(false)
      setUserToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir usuário')
    } finally {
      setDeleting(false)
    }
  }

  const usuariosFiltrados = useMemo(() => {
    if (!userSearch.trim()) return usuarios
    const q = userSearch.trim().toLowerCase()
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [usuarios, userSearch])

  const usuariosAtivos = useMemo(
    () => usuarios.filter((u) => u.ativo).length,
    [usuarios]
  )

  const usuariosPorPerfil = useMemo(() => {
    const map = new Map<string, number>()
    for (const u of usuarios) {
      const nome = u.perfis?.nome ?? 'Sem perfil'
      map.set(nome, (map.get(nome) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([nome, count]) => ({ nome, count }))
  }, [usuarios])

  const perfilByName = useMemo(() => {
    const map = new Map<string, string>()
    perfis.forEach((p) => map.set(p.nome.trim().toLowerCase(), p.id))
    return map
  }, [perfis])

  const handleDownloadImportTemplate = () => {
    downloadUserImportTemplate(perfis.map((p) => p.nome))
  }

  const validateImportRows = (rows: Record<string, unknown>[]): ValidatedRow[] => {
    const results: ValidatedRow[] = []
    const seenEmails = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const nome = String(getExcelValue(row, 'nome', HEADER_ALIASES) ?? '').trim()
      const email = String(getExcelValue(row, 'email', HEADER_ALIASES) ?? '').trim()
      const perfilNome = String(getExcelValue(row, 'perfil', HEADER_ALIASES) ?? '').trim()

      const v: ValidatedRow = {
        nome,
        email,
        perfil: perfilNome,
        perfilId: '',
        valid: false,
      }

      if (!nome) {
        v.error = 'Nome obrigatório'
      } else if (nome.length < 3) {
        v.error = 'Nome deve ter no mínimo 3 caracteres'
      } else if (!email) {
        v.error = 'E-mail obrigatório'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        v.error = 'E-mail inválido'
      } else if (seenEmails.has(email.toLowerCase())) {
        v.error = 'E-mail duplicado na planilha'
      } else if (!perfilNome) {
        v.error = 'Perfil obrigatório'
      } else {
        const perfilId = perfilByName.get(perfilNome.toLowerCase())
        if (!perfilId) {
          v.error = `Perfil "${perfilNome}" não encontrado. Use: ${perfis.map((p) => p.nome).join(', ')}`
        } else {
          v.perfilId = perfilId
          v.valid = true
          seenEmails.add(email.toLowerCase())
        }
      }
      results.push(v)
    }
    return results
  }

  const processImportFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Formato inválido. Use arquivo .xlsx ou .xls')
      return
    }
    try {
      const data = await parseExcelFile(file, { skipTitleRow: true })
      const rows = data.filter((r) => {
        const nome = getExcelValue(r, 'nome', HEADER_ALIASES)
        const email = getExcelValue(r, 'email', HEADER_ALIASES)
        return (nome && String(nome).trim()) || (email && String(email).trim())
      })
      if (rows.length === 0) {
        toast.error('O arquivo está vazio ou não possui dados válidos.')
        return
      }
      setImportFile(file)
      setValidatedRows(validateImportRows(rows))
      setImportStep(2)
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um Excel válido.')
    }
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processImportFile(f)
    e.target.value = ''
  }

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setImportDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processImportFile(f)
  }

  const handleConfirmImport = async () => {
    const toImport = validatedRows.filter((r) => r.valid)
    if (toImport.length === 0 || !id) return

    setImporting(true)
    setImportStep(3)
    setImportProgress(0)
    const created: CreatedUser[] = []
    const errors: string[] = []
    const total = toImport.length

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i]!
      const senha = generateTempPassword()
      try {
        const res = await fetch('/api/admin/criar-usuario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: row.nome,
            email: row.email,
            senha,
            tenant_id: id,
            perfil_id: row.perfilId,
          }),
        })
        const result = await res.json()
        if (res.ok) {
          created.push({ nome: row.nome, email: row.email, senha })
        } else {
          errors.push(`${row.email}: ${result.error ?? 'Erro ao criar'}`)
        }
      } catch (err) {
        errors.push(`${row.email}: ${err instanceof Error ? err.message : 'Erro ao criar'}`)
      }
      setImportProgress(Math.round(((i + 1) / total) * 100))
    }

    setImportCreated(created)
    setImportErrors(errors)
    setImporting(false)
  }

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false)
    setImportStep(1)
    setImportFile(null)
    setValidatedRows([])
    setImportCreated([])
    setImportErrors([])
    if (id) {
      supabase
        .from('usuarios')
        .select('id, nome, email, ativo, perfis(nome)')
        .eq('tenant_id', id)
        .order('nome')
        .then(({ data }) => setUsuarios((data as Usuario[]) ?? []))
    }
  }

  const handleResetPassword = async (u: Usuario) => {
    setResettingPassword(true)
    try {
      const novaSenha = generateTempPassword(10)
      const res = await fetch('/api/admin/resetar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, novaSenha }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Erro ao resetar senha')
      setResetPasswordValue(novaSenha)
      setResetPasswordOpen(true)
      setResetPasswordCopied(false)
      toast.success('Senha resetada com sucesso!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao resetar senha')
    } finally {
      setResettingPassword(false)
    }
  }

  const copyResetPassword = () => {
    if (!resetPasswordValue) return
    void navigator.clipboard.writeText(resetPasswordValue)
    setResetPasswordCopied(true)
    toast.success('Senha copiada para a área de transferência')
    setTimeout(() => setResetPasswordCopied(false), 2000)
  }

  const copyAllPasswords = () => {
    const text = importCreated
      .map((u) => `${u.nome}\t${u.email}\t${u.senha}`)
      .join('\n')
    void navigator.clipboard.writeText(text)
    toast.success('Senhas copiadas para a área de transferência')
  }

  const validCount = validatedRows.filter((r) => r.valid).length
  const errorCount = validatedRows.filter((r) => !r.valid).length

  if (userLoading || (!user || !user.isMaster())) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  if (loading || !tenant) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    )
  }

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/configuracoes/tenants" aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Editar Tenant</h1>
            <p className="text-muted-foreground text-sm mt-1">{tenant.nome}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTenantAtivo}
          className="gap-2 shrink-0"
        >
          {tenant.ativo ? (
            <>
              <PowerOff className="w-4 h-4" />
              Desativar
            </>
          ) : (
            <>
              <Power className="w-4 h-4 text-green-600" />
              Ativar
            </>
          )}
        </Button>
      </div>

      <form
        onSubmit={tenantForm.handleSubmit(onSaveTenant)}
        className="bg-card rounded-xl border border-border p-6 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-[6] min-w-0 space-y-4">
            <h3 className="font-semibold">Dados do tenant</h3>
            <div className="space-y-2">
              <Label htmlFor="tenant-nome">Nome *</Label>
              <Input id="tenant-nome" {...tenantForm.register('nome')} placeholder="Ex: Empresa ABC" className="h-8 text-sm" />
              {tenantForm.formState.errors.nome && (
                <p className="text-sm text-destructive">{tenantForm.formState.errors.nome.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug *</Label>
              <Input id="tenant-slug" {...tenantForm.register('slug')} placeholder="empresa-abc" className="font-mono h-8 text-sm" />
              <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens</p>
              {tenantForm.formState.errors.slug && (
                <p className="text-sm text-destructive">{tenantForm.formState.errors.slug.message}</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
          <div className="flex-[4] min-w-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-muted/30 p-5 flex flex-col justify-center min-h-[100px]">
                <p className="text-4xl font-bold text-[#00C9A7]">{usuariosAtivos}</p>
                <p className="text-sm text-muted-foreground mt-2">Usuários ativos</p>
              </div>
              {usuariosPorPerfil.slice(0, 3).map(({ nome, count }) => (
                <div key={nome} className="rounded-lg border border-border bg-muted/30 p-5 flex flex-col justify-center min-h-[100px]">
                  <p className="text-4xl font-bold text-[#00C9A7]">{count}</p>
                  <p className="text-sm text-muted-foreground mt-2 truncate" title={nome}>{nome}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <h3 className="font-semibold">Usuários do tenant</h3>
          <div className="flex gap-2">
            {usuarios.length > 0 && (
              <div className="relative flex-1 sm:flex-initial w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou e-mail"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setImportDialogOpen(true)} className="shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
              Importar Planilha
            </Button>
            <Button size="sm" onClick={() => setAddUserOpen(true)} className="shrink-0">
              <Plus className="w-4 h-4" />
              Adicionar Usuário
            </Button>
          </div>
        </div>
        {usuarios.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Nenhum usuário cadastrado
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Nenhum usuário encontrado para &quot;{userSearch}&quot;
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosFiltrados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{u.perfis?.nome ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? 'default' : 'secondary'} className="text-xs">
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleResetPassword(u)}
                              disabled={resettingPassword}
                              className="text-[#00C9A7] hover:text-[#00C9A7]/80 hover:bg-[#00C9A7]/10"
                              aria-label="Resetar senha"
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Resetar senha</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleUsuarioAtivo(u)}
                        title={u.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {u.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4 text-green-600" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteUserDialog(u)}
                        title="Excluir"
                        aria-label="Excluir usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          {tempPassword && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">Senha temporária (anote):</p>
              <p className="font-mono mt-1 break-all">{tempPassword}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setTempPassword(null)
                  setAddUserOpen(false)
                }}
              >
                Fechar
              </Button>
            </div>
          )}
          <form onSubmit={addUserForm.handleSubmit(onAddUser)} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input {...addUserForm.register('nome')} placeholder="Nome completo" />
              {addUserForm.formState.errors.nome && (
                <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.nome.message}</p>
              )}
            </div>
            <div>
              <Label>E-mail</Label>
              <Input {...addUserForm.register('email')} type="email" placeholder="email@exemplo.com" />
              {addUserForm.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label>Perfil</Label>
              <Select
                value={addUserForm.watch('perfil_id')}
                onValueChange={(v) => addUserForm.setValue('perfil_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addUserForm.formState.errors.perfil_id && (
                <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.perfil_id.message}</p>
              )}
            </div>
            <Button type="submit" disabled={addUserForm.formState.isSubmitting}>
              {addUserForm.formState.isSubmitting ? 'Criando...' : 'Criar usuário'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open && !importing) handleCloseImportDialog()
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importação em massa de usuários</DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex gap-2 text-sm">
            <span className={importStep >= 1 ? 'text-[#00C9A7] font-medium' : 'text-muted-foreground'}>
              1. Template
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={importStep >= 2 ? 'text-[#00C9A7] font-medium' : 'text-muted-foreground'}>
              2. Upload
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={importStep >= 3 ? 'text-[#00C9A7] font-medium' : 'text-muted-foreground'}>
              3. Resultado
            </span>
          </div>

          {importStep === 1 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Baixe o template Excel, preencha com os dados dos usuários e faça o upload na próxima etapa.
              </p>
              <Button onClick={handleDownloadImportTemplate} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar Template
              </Button>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setImportStep(2)}>Próximo</Button>
              </div>
            </div>
          )}

          {importStep === 2 && (
            <div className="space-y-4 py-4">
              <div
                className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  importDragActive ? 'border-[#00C9A7] bg-[#00C9A7]/5' : 'border-border hover:border-[#00C9A7]/50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setImportDragActive(true)
                }}
                onDragLeave={() => setImportDragActive(false)}
                onDrop={handleImportDrop}
                onClick={() => document.getElementById('import-file-input')?.click()}
              >
                <input
                  id="import-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportFileChange}
                />
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
              </div>

              {validatedRows.length > 0 && (
                <>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">{validCount} usuários válidos</span>
                    {errorCount > 0 && (
                      <span className="text-destructive font-medium">{errorCount} usuários com erro</span>
                    )}
                    {errorCount > 0 && validCount > 0 && (
                      <span className="text-amber-600 text-xs">
                        Serão importados apenas os {validCount} usuários válidos.
                      </span>
                    )}
                  </div>
                  <div className="border rounded-lg overflow-auto max-h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Perfil</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validatedRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.nome || '—'}</TableCell>
                            <TableCell>{r.email || '—'}</TableCell>
                            <TableCell>{r.perfil || '—'}</TableCell>
                            <TableCell>
                              {r.valid ? (
                                <Badge variant="default" className="bg-green-600">Válido</Badge>
                              ) : (
                                <span className="text-destructive text-xs">{r.error}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setImportStep(1)}>
                      Voltar
                    </Button>
                    <Button
                      onClick={handleConfirmImport}
                      disabled={validCount === 0 || importing}
                      className="bg-[#00C9A7] hover:bg-[#00C9A7]/90"
                    >
                      Confirmar importação
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {importStep === 3 && (
            <div className="space-y-4 py-4">
              {importing ? (
                <div className="space-y-2">
                  <p className="text-sm">Processando importação...</p>
                  <Progress value={importProgress} className="h-2 [&_[data-slot=progress-indicator]]:bg-[#00C9A7]" />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-green-600 font-medium">
                      {importCreated.length} usuários criados com sucesso
                    </p>
                    {importErrors.length > 0 && (
                      <p className="text-destructive font-medium">{importErrors.length} erros</p>
                    )}
                  </div>

                  {importCreated.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Senhas temporárias (guarde em local seguro):</p>
                        <Button variant="outline" size="sm" onClick={copyAllPasswords} className="gap-1">
                          <Copy className="w-3 h-3" />
                          Copiar tudo
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-auto max-h-[200px] p-3 space-y-1 text-sm font-mono bg-muted/30">
                        {importCreated.map((u, i) => (
                          <div key={i} className="flex gap-4">
                            <span>{u.nome}</span>
                            <span className="text-muted-foreground">{u.email}</span>
                            <span className="text-[#00C9A7] font-semibold">{u.senha}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={handleCloseImportDialog}>Fechar</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={(open) => {
        setResetPasswordOpen(open)
        if (!open) setResetPasswordValue(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha resetada com sucesso!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Nova senha (guarde em local seguro):</p>
              <p className="font-mono text-lg font-semibold text-[#00C9A7] bg-muted/50 rounded-lg px-4 py-3 break-all">
                {resetPasswordValue}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={copyResetPassword}
                className="gap-2 bg-[#00C9A7] hover:bg-[#00C9A7]/90"
              >
                {resetPasswordCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar senha
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteUserOpen} onOpenChange={(open) => {
        setDeleteUserOpen(open)
        if (!open) setUserToDelete(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => void handleDeleteUser(e)}
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
