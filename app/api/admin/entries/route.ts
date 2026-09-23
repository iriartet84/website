import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { clientKey, rateLimit } from "@/lib/rate-limit"
import { createPaperAction, createProjectAction } from "@/app/admin/actions"

async function guard(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
  const limited = rateLimit(clientKey(ip, "write"), 20, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  }
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return null
}

export async function POST(request: NextRequest) {
  const blocked = await guard(request)
  if (blocked) return blocked
  const formData = await request.formData()
  const kind = formData.get("kind")
  if (kind === "project") {
  await createProjectAction({}, formData)
  } else {
  await createPaperAction({}, formData)
  }
  return NextResponse.json({ ok: true })
}