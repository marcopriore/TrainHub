import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { LEGAL_PATHS } from '@/lib/termos-plataforma'

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8"
        >
          <GraduationCap className="w-5 h-5 text-primary" />
          Voltar ao login
        </Link>
        <h1 className="font-serif text-3xl font-bold">Política de privacidade</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Documento provisório. Substitua pelo texto revisado pelo jurídico (LGPD e operação real do produto).
        </p>
        <div className="mt-8 text-sm leading-relaxed space-y-4 text-foreground/90">
          <p>
            Esta política descreve como o TrainHub trata dados pessoais em nome da sua organização. A
            controladora frente aos titulares (por exemplo colaboradores) é normalmente a empresa cliente; o
            TrainHub atua como operador na medida em que processa dados para prestar o serviço.
          </p>
          <p>
            O texto definitivo deve incluir: bases legais, categorias de dados, finalidades, compartilhamentos
            (suboperadores como hospedagem/e-mail), prazos de retenção, direitos dos titulares e canal de
            contato do encarregado/DPO quando aplicável.
          </p>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          Termos de uso:{' '}
          <Link href={LEGAL_PATHS.termos} className="text-primary hover:underline">
            {LEGAL_PATHS.termos}
          </Link>
        </p>
      </div>
    </main>
  )
}
