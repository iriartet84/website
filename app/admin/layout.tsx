import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()
  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <p className="font-serif text-lg text-navy">Content admin</p>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
      </header>
      {children}
    </div>
  )
}
