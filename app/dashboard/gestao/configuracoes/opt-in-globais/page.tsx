'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

export default function OptInGlobaisPage() {
  const router = useRouter()
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()
  const canManage =
    user?.isMaster() ||
    user?.isAdmin?.() ||
    user?.hasPermission?.('gerenciar_catalogo')

  const [categorias, setCategorias] = useState<{ id: string; nome: string }[]>([])
  const [optMap, setOptMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard/gestao')
  }, [user, canManage, router])

  const load = useCallback(async () => {
    if (!activeTenantId) {
      setCategorias([])
      setOptMap({})
      setLoading(false)
      return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      const [{ data: cats, error: e1 }, { data: opts, error: e2 }] = await Promise.all([
        supabase.from('categorias').select('id, nome').eq('tenant_id', activeTenantId).order('nome'),
        supabase
          .from('tenant_catalogo_global_categorias')
          .select('categoria, opt_in')
          .eq('tenant_id', activeTenantId),
      ])
      if (e1) throw e1
      if (e2) throw e2
      setCategorias((cats as { id: string; nome: string }[]) ?? [])
      const m: Record<string, boolean> = {}
      for (const o of opts ?? []) {
        const row = o as { categoria: string; opt_in: boolean }
        m[row.categoria] = row.opt_in
      }
      setOptMap(m)
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível carregar as preferências.')
    } finally {
      setLoading(false)
    }
  }, [activeTenantId])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (nome: string, checked: boolean) => {
    if (!activeTenantId) return
    setSaving(nome)
    const supabase = createClient()
    try {
      const { error } = await supabase.from('tenant_catalogo_global_categorias').upsert(
        {
          tenant_id: activeTenantId,
          categoria: nome,
          opt_in: checked,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,categoria' }
      )
      if (error) throw error
      setOptMap((prev) => ({ ...prev, [nome]: checked }))
      toast.success(checked ? 'Categoria liberada na vitrine global.' : 'Opt-in desligado para esta categoria.')
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível salvar.')
    } finally {
      setSaving(null)
    }
  }

  if (!canManage) return null

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#00C9A71a', color: '#00C9A7' }}
        >
          <Globe className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Conteúdo global na vitrine</h1>
          <p className="text-sm text-muted-foreground">
            Por categoria, permita que colaboradores vejam treinamentos do catálogo global TrainHub no final da
            vitrine. Padrão: desligado (LGPD).
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 space-y-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Cadastre categorias em Configurações → Categorias para habilitar o opt-in por tipo de treinamento.
          </p>
        ) : (
          categorias.map((c) => {
            const on = optMap[c.nome] === true
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0"
              >
                <Label htmlFor={`opt-${c.id}`} className="text-sm font-medium cursor-pointer flex-1">
                  {c.nome}
                </Label>
                <Switch
                  id={`opt-${c.id}`}
                  checked={on}
                  disabled={saving === c.nome}
                  onCheckedChange={(v) => toggle(c.nome, v)}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
