'use client'

import { usePathname } from 'next/navigation'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname.startsWith('/admin') || pathname.startsWith('/login')

  if (bare) {
    return <>{children}</>
  }

  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  )
}
