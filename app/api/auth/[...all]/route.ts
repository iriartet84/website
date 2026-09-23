import { NextRequest, NextResponse } from "next/server"
import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"
import { clientKey, rateLimit } from "@/lib/rate-limit"

const handler = toNextJsHandler(auth)

export const GET = handler.GET

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
  const url = request.nextUrl.pathname
  if (url.includes("sign-in") || url.includes("sign-up")) {
    const limited = rateLimit(clientKey(ip, "auth"), 8, 60_000)
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      )
    }
  }
  return handler.POST(request)
}
