'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/use-user'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogoShell } from '@/components/catalogo/catalogo-shell'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { UsuarioCatalogoPreferencias } from '@/lib/catalogo'
import { preferenciasPreenchidas } from '@/lib/catalogo'
import { MODALIDADE_LABEL, NIVEL_LABEL } from '@/lib/catalogo'

const NIVELS = ['basico', 'intermediario', 'avancado'] as const
const MODS = ['presencial', 'online', 'hibrido'] as const

const BASE = '/dashboard/catalogo'

export default function CatalogoPreferenciasPage() {
  const { user, getActiveTenantId } = useUser()
  const activeTenantId = getActiveTenantId()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categoriasOpts, setCategoriasOpts] = useState<{ id: string; nome: string }[]>([])
  const [selectedCat, setSelectedCat] = useState<Set<string>>(new Set())
  const [selectedNivel, setSelectedNivel] = useState<Set<string>>(new Set())
  const [selectedMod, setSelectedMod] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!activeTenantId) {
      setLoading(false)
      return
    }
    const supabase = createClient()

    const run = async () => {
      setLoading(true)
      try {
        const { data: cats } = await supabase
          .from('categorias')
          .select('id, nome')
          .eq('tenant_id', activeTenantId)
          .order('nome')

        setCategoriasOpts((cats as { id: string; nome: string }[]) ?? [])

        if (user?.id) {
          const { data: pref } = await supabase
            .from('usuario_catalogo_preferencias')
            .select('categorias, niveis, modalidades')
            .eq('usuario_id', user.id)
            .eq('tenant_id', activeTenantId)
            .maybeSingle()

          const p = pref as { categorias: string[]; niveis: string[]; modalidades: string[] } | null
          if (p) {
            setSelectedCat(new Set(p.categorias ?? []))
            setSelectedNivel(new Set(p.niveis ?? []))
            setSelectedMod(new Set(p.modalidades ?? []))
          }
        }
      } catch {
        toast.error('Erro ao carregar dados.')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [activeTenantId, user?.id])

  const toggle = (set: Set<string>, key: string, fn: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    fn(next)
  }

  const onSave = async () => {
    if (!activeTenantId || !user?.id) return
    const supabase = createClient()
    setSaving(true)
    try {
      const row = {
        usuario_id: user.id,
        tenant_id: activeTenantId,
        categorias: [...selectedCat],
        niveis: [...selectedNivel],
        modalidades: [...selectedMod],
      }
      const { error } = await supabase.from('usuario_catalogo_preferencias').upsert(row, {
        onConflict: 'usuario_id,tenant_id',
      })
      if (error) throw error
      toast.success('Preferências salvas.')
    } catch {
      toast.error('Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const preview: UsuarioCatalogoPreferencias | null =
    user?.id && activeTenantId
      ? {
          id: '',
          usuario_id: user.id,
          tenant_id: activeTenantId,
          categorias: [...selectedCat],
          niveis: [...selectedNivel],
          modalidades: [...selectedMod],
          atualizado_em: '',
        }
      : null

  return (
    <CatalogoShell
      title="Preferências de aprendizado"
      subtitle="Usamos essas informações apenas para sugerir treinamentos do catálogo do seu tenant, junto com o histórico que você já tem na empresa."
    >
      <Button
        variant="ghost"
        size="sm"
        className="w-fit -mt-2 mb-2 text-slate-300 hover:text-white hover:bg-white/10"
        asChild
      >
        <Link href={BASE}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao catálogo
        </Link>
      </Button>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-xl bg-white/10" />
      ) : !activeTenantId ? (
        <p className="text-slate-400 text-sm">Tenant não selecionado.</p>
      ) : (
        <div className="space-y-10 max-w-2xl">
          <section className="space-y-3">
            <Label className="text-base font-semibold text-white">Categorias de interesse</Label>
            <p className="text-sm text-slate-400">
              Escolha uma ou mais categorias cadastradas pela gestão (alinhadas aos treinamentos do catálogo).
            </p>
            <div className="flex flex-wrap gap-2">
              {categoriasOpts.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nenhuma categoria cadastrada. Peça à gestão para criar em Configurações → Categorias.
                </p>
              ) : (
                categoriasOpts.map((c) => {
                  const on = selectedCat.has(c.nome)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(selectedCat, c.nome, setSelectedCat)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm border transition-colors',
                        on
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-white/10 border-white/20 text-slate-200 hover:border-[#00C9A7]/50'
                      )}
                    >
                      {on && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                      {c.nome}
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="space-y-3">
            <Label className="text-base font-semibold text-white">Níveis</Label>
            <div className="flex flex-wrap gap-2">
              {NIVELS.map((n) => {
                const on = selectedNivel.has(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(selectedNivel, n, setSelectedNivel)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors',
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white/10 border-white/20 text-slate-200 hover:border-[#00C9A7]/50'
                    )}
                  >
                    {NIVEL_LABEL[n]}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <Label className="text-base font-semibold text-white">Modalidades</Label>
            <div className="flex flex-wrap gap-2">
              {MODS.map((m) => {
                const on = selectedMod.has(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggle(selectedMod, m, setSelectedMod)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors',
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-white/10 border-white/20 text-slate-200 hover:border-[#00C9A7]/50'
                    )}
                  >
                    {MODALIDADE_LABEL[m]}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={onSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? 'Salvando…' : 'Salvar preferências'}
            </Button>
            <Button
              variant="outline"
              asChild
              className="border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white"
            >
              <Link href={BASE}>Cancelar</Link>
            </Button>
          </div>

          {preview && preferenciasPreenchidas(preview) && (
            <p className="text-xs text-slate-500 border-t border-white/10 pt-6">
              As sugestões no catálogo combinam essas opções com os treinamentos que você já realizou (vínculo por
              e-mail de colaborador). Você pode alterar ou limpar suas escolhas a qualquer momento.
            </p>
          )}
        </div>
      )}
    </CatalogoShell>
  )
}
