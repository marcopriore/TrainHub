'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'

interface TenantItem {
  id: string
  nome: string
  slug: string
}

export function TenantSelector() {
  const { user, selectedTenant, setSelectedTenant } = useUser()
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.isMaster()) return
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('tenants')
          .select('id, nome, slug')
          .eq('ativo', true)
          .order('nome', { ascending: true })
        if (error) throw error
        setTenants((data as TenantItem[]) ?? [])
      } catch {
        setTenants([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.isMaster()])

  if (!user?.isMaster()) return null

  const isViewingOwnTenant =
    user.tenant && selectedTenant && user.tenant.id === selectedTenant.id

  return (
    <div className="px-4 py-3 border-b border-sidebar-border space-y-2">
      <label className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wide">
        Tenant
      </label>
      <Select
        value={selectedTenant?.id ?? ''}
        onValueChange={(id) => {
          const t = tenants.find((x) => x.id === id) ?? null
          setSelectedTenant(t)
        }}
        disabled={loading}
      >
        <SelectTrigger className="w-full bg-sidebar-accent/20 border-sidebar-border text-white h-9">
          <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione o tenant'} />
        </SelectTrigger>
        <SelectContent>
          {tenants.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#00C9A7]" />
                {t.nome}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedTenant && !isViewingOwnTenant && (
        <Badge
          variant="secondary"
          className="w-full justify-center bg-[#00C9A7]/20 text-[#00C9A7] border-[#00C9A7]/30"
        >
          Visualizando: {selectedTenant.nome}
        </Badge>
      )}
    </div>
  )
}
