'use client'

import { usePathname } from 'next/navigation'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { AnalyticsTracker } from '@/components/analytics-tracker'

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
      {/* Public pages only: admin and login are never tracked. */}
      <AnalyticsTracker />
    </>
  )
}
