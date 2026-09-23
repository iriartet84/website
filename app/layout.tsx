import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { AppShell } from '@/components/app-shell'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif-display',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://toribioiriarte.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Toribio Iriarte — Economist',
    template: '%s — Toribio Iriarte',
  },
  description:
    'Graduate economist with experience in commodity, macroeconomic, financial markets, and geopolitical risk research, including work at the European Commission and the United Nations.',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'Toribio Iriarte',
    title: 'Toribio Iriarte — Economist',
    description:
      'Graduate economist with experience in commodity, macroeconomic, financial markets, and geopolitical risk research.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Toribio Iriarte — Economist',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`light ${inter.variable} ${fraunces.variable}`}>
      <body className="antialiased font-sans">
        <AppShell>{children}</AppShell>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
