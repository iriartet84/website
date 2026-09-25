// Scheduled safety net for the project pipeline. Each project's GitHub
// Actions workflow pings /api/projects/refresh right after it publishes new
// output, so updates normally appear within a minute. This function re-checks
// every project every 6 hours in case a ping was missed (a failed workflow
// step, the site mid-deploy). Deliberately not hourly: each run wakes the
// database, and Neon bills compute time while it's awake.
//
// Runs only on the published production deploy. Needs the same
// PROJECT_REFRESH_SECRET environment variable as the site; `URL` is set by
// Netlify to the site's main address.

export default async () => {
  const base = process.env.URL
  const secret = process.env.PROJECT_REFRESH_SECRET
  if (!base || !secret) {
    console.log("refresh-project-outputs: URL or PROJECT_REFRESH_SECRET not set; skipped")
    return
  }

  const response = await fetch(`${base}/api/projects/refresh`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ all: true }),
    signal: AbortSignal.timeout(25_000),
  })
  const body = (await response.json().catch(() => null)) as {
    refreshed?: number
    failed?: number
    results?: { slug: string; ok: boolean; error?: string }[]
  } | null

  console.log(
    `refresh-project-outputs: HTTP ${response.status}, refreshed ${body?.refreshed ?? "?"}, failed ${body?.failed ?? "?"}`,
  )
  for (const result of body?.results ?? []) {
    if (!result.ok) console.log(`  ${result.slug}: ${result.error}`)
  }
}

export const config = {
  schedule: "0 */6 * * *",
}
