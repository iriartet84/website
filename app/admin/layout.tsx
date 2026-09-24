import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import { AdminBar } from '@/components/admin/admin-bar'

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
      <AdminBar email={session.user.email} />
      {children}
    </div>
  )
}
