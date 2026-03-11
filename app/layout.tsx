import type { Metadata } from 'next'
import { Sora, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { UserProvider } from '@/components/user-provider'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TrainHub — Plataforma de Gestão de Treinamentos',
  description: 'Gerencie e acompanhe os programas de treinamento de colaboradores e parceiros da sua empresa.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased">
        <UserProvider>
          {children}
          <Toaster richColors position="top-right" />
          <Analytics />
        </UserProvider>
      </body>
    </html>
  )
}
