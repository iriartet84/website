import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getFeed } from '@/lib/analytics/queries'

// Live activity for /admin/analytics (polled by the dashboard). Admin-only:
// the check runs here, not just in the page that calls it.

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const after = Number(request.nextUrl.searchParams.get('after'))
  try {
    const events = await getFeed(Number.isSafeInteger(after) && after > 0 ? after : null)
    return NextResponse.json(
      {
        events: events.map((event) => ({
          id: event.id,
          createdAt: event.createdAt,
          type: event.type,
          name: event.name,
          label: event.label,
          path: event.path,
          target: event.target,
          country: event.country,
          sessionId: event.sessionId.slice(0, 8),
        })),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch {
    return NextResponse.json({ error: 'Analytics data is unavailable' }, { status: 503 })
  }
}
