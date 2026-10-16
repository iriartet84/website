'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { pool } from '@/lib/db'
import { requireAdmin } from '@/lib/require-admin'
import { OPT_OUT_COOKIE } from '@/lib/analytics/config'
import { deleteEventsOlderThan } from '@/lib/analytics/ingest'

// Admin-only maintenance for /admin/analytics. Each action re-checks the
// session itself (server actions are callable endpoints in their own right).

function back(notice: string): never {
  redirect(`/admin/analytics?notice=${encodeURIComponent(notice)}#data`)
}

export async function setExcludeThisBrowser(formData: FormData) {
  if (!(await requireAdmin())) redirect('/login')
  const store = await cookies()
  if (formData.get('exclude') === '1') {
    store.set(OPT_OUT_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 730,
    })
    back('This browser is now excluded from analytics, even when signed out.')
  }
  store.delete(OPT_OUT_COOKIE)
  back('This browser is counted again when you are signed out.')
}

export async function purgeOldEvents(formData: FormData) {
  if (!(await requireAdmin())) redirect('/login')
  const days = Number(formData.get('days'))
  if (!Number.isInteger(days) || days < 1 || days > 3650) back('Choose a number of days between 1 and 3650.')
  let deleted = 0
  try {
    deleted = await deleteEventsOlderThan(days)
  } catch {
    back('Could not delete events — is the database reachable?')
  }
  back(`Deleted ${deleted.toLocaleString('en-GB')} events older than ${days} days.`)
}

export async function deleteAllEvents(formData: FormData) {
  if (!(await requireAdmin())) redirect('/login')
  if (formData.get('confirm') !== 'DELETE') back('Type DELETE to confirm removing all analytics events.')
  try {
    await pool.query('DELETE FROM analytics_events')
  } catch {
    back('Could not delete events — is the database reachable?')
  }
  back('All analytics events were deleted.')
}
