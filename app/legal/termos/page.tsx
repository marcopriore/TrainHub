import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import { LEGAL_PATHS } from '@/lib/termos-plataforma'

export default function TermosUsoPage() {
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
        <h1 className="font-serif text-3xl font-bold">Termos de uso</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Documento provisório. Substitua pelo texto revisado pelo jurídico antes da comercialização.
        </p>
        <div className="mt-8 text-sm leading-relaxed space-y-4 text-foreground/90">
          <p>
            Ao utilizar o TrainHub, a organização contratante e seus utilizadores concordam em cumprir as
            condições do serviço descritas no contrato comercial e nestes termos, quando publicados na versão
            final.
          </p>
          <p>
            O texto definitivo deve abrangir: objeto do serviço, contas e responsabilidades, uso aceitável,
            propriedade intelectual, limitação de responsabilidade, dados pessoais (com referência à política
            de privacidade), suspensão e lei aplicável.
          </p>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          Política de privacidade:{' '}
          <Link href={LEGAL_PATHS.privacidade} className="text-primary hover:underline">
            {LEGAL_PATHS.privacidade}
          </Link>
        </p>
      </div>
    </main>
  )
}
