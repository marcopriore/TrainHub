import { Settings } from 'lucide-react'

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie as preferências da plataforma</p>
      </div>
      <div className="bg-card rounded-xl border border-border p-8 flex flex-col items-center gap-4 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <Settings className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Em breve</h2>
        <p className="text-muted-foreground text-sm max-w-sm text-balance leading-relaxed">
          As configurações da plataforma estarão disponíveis em breve. Aqui você poderá gerenciar usuários,
          notificações, integrações e muito mais.
        </p>
      </div>
    </div>
  )
}
