import { createHash, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { clientKey, rateLimit } from "@/lib/rate-limit"
import { refreshProjects } from "@/lib/project-refresh"

// POST /api/projects/refresh — tells the portfolio to re-fetch a project's
// output file now (see lib/project-refresh.ts).
//
//   Authorization: Bearer <PROJECT_REFRESH_SECRET>
//   { "slug": "euro-area-nowcast" }   one project
//   { "all": true }                    every project with an output URL
//
// Callers: a project's GitHub Actions workflow after each deploy, and the
// scheduled Netlify function. The body only names a project — the URL that
// gets fetched always comes from the database, never from the request.

export const dynamic = "force-dynamic"

const bodySchema = z.union([
  z.object({ slug: z.string().trim().min(1).max(200) }),
  z.object({ all: z.literal(true) }),
])

function digest(value: string) {
  return createHash("sha256").update(value).digest()
}

function authorized(request: NextRequest, secret: string) {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return false
  // Compare fixed-length digests so neither length nor content leaks timing.
  return timingSafeEqual(digest(match[1].trim()), digest(secret))
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  if (!rateLimit(clientKey(ip, "project-refresh"), 30, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  const secret = process.env.PROJECT_REFRESH_SECRET
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Refreshing is not configured on this site." }, { status: 503 })
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Send {"slug": "<project-slug>"} or {"all": true}.' },
      { status: 400 },
    )
  }

  try {
    const results = await refreshProjects(parsed.data)
    if (results === null) {
      return NextResponse.json(
        { error: "No project with that slug has an output URL." },
        { status: 404 },
      )
    }
    const failed = results.filter((r) => !r.ok).length
    return NextResponse.json(
      { ok: failed === 0, refreshed: results.length, failed, results },
      // One named project that failed validation → 422, so a CI step fails.
      { status: "slug" in parsed.data && failed > 0 ? 422 : 200 },
    )
  } catch {
    return NextResponse.json({ error: "Refresh failed — the database is unavailable." }, { status: 500 })
  }
}
