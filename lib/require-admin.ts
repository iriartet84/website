import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export async function getSession() {
  try {
    return await auth.api.getSession({
      headers: await headers(),
    })
  } catch {
    return null
  }
}

export async function requireAdmin() {
  const session = await getSession()
  if (!session?.user) {
    return null
  }
  const allowlist = process.env.ADMIN_EMAIL
  if (allowlist && session.user.email !== allowlist) {
    return null
  }
  return session
}
