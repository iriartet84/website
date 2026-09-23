const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): { ok: boolean; remaining: number } {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0 }
  }

  current.count += 1
  return { ok: true, remaining: limit - current.count }
}

export function clientKey(ip: string | null, route: string) {
  return `${route}:${ip ?? "unknown"}`
}
