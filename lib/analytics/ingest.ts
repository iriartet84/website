import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { pool } from '@/lib/db'
import { RETENTION_DAYS, SESSION_GAP_MINUTES } from './config'
import { classifyReferrer, type CleanEvent } from './validate'

// Stores a batch of validated events from one request. Visitors are
// recognised for one day at most (HMAC under a daily salt that is deleted
// the next day), and sessions are assigned here, on the server, so the
// browser keeps no identifier at all.

let saltCache: { day: string; salt: string } | null = null

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

async function dailySalt(): Promise<string> {
  const day = utcDay()
  if (saltCache?.day === day) return saltCache.salt
  const candidate = randomBytes(32).toString('hex')
  // Concurrent first requests of the day race on the insert; the loser
  // reads the winner's salt.
  await pool.query(
    `INSERT INTO analytics_salts (day, salt) VALUES ($1, $2) ON CONFLICT (day) DO NOTHING`,
    [day, candidate],
  )
  const { rows } = await pool.query<{ salt: string }>(`SELECT salt FROM analytics_salts WHERE day = $1`, [day])
  // Yesterday's and older salts are destroyed: their hashes can no longer
  // be reproduced from an IP address.
  await pool.query(`DELETE FROM analytics_salts WHERE day < $1`, [day])
  saltCache = { day, salt: rows[0].salt }
  return rows[0].salt
}

export function visitorHashFor(salt: string, ip: string, userAgent: string, host: string) {
  return createHmac('sha256', salt).update(`${ip}|${userAgent}|${host}`).digest('hex').slice(0, 32)
}

export async function storeEvents(input: {
  events: CleanEvent[]
  ip: string
  userAgent: string
  siteHost: string
  country: string | null
  device: string
}) {
  if (input.events.length === 0) return { stored: 0 }
  const salt = await dailySalt()
  const visitorHash = visitorHashFor(salt, input.ip, input.userAgent, input.siteHost)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Serialise requests from the same visitor so two simultaneous batches
    // can't both open a new session.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [visitorHash])

    const { rows: last } = await client.query<{
      sessionId: string
      referrerHost: string | null
      channel: string | null
    }>(
      `SELECT "sessionId", "referrerHost", channel FROM analytics_events
        WHERE "visitorHash" = $1 AND "createdAt" > now() - make_interval(mins => $2)
        ORDER BY "createdAt" DESC LIMIT 1`,
      [visitorHash, SESSION_GAP_MINUTES],
    )

    let sessionId: string
    let referrerHost: string | null
    let channel: string | null
    if (last[0]) {
      ;({ sessionId, referrerHost, channel } = last[0])
    } else {
      sessionId = randomUUID()
      const landing = input.events.find((event) => event.type === 'pageview')
      if (landing) {
        ;({ referrerHost, channel } = classifyReferrer(landing.referrer, input.siteHost, landing.utmSource))
      } else {
        referrerHost = null
        channel = 'unknown'
      }
    }

    const columns = 13
    const values: unknown[] = []
    const tuples = input.events.map((event, i) => {
      values.push(
        sessionId,
        visitorHash,
        event.type,
        event.name,
        event.label,
        event.path,
        event.target,
        referrerHost,
        channel,
        input.country,
        input.device,
        event.value,
        // Keep the order of a batch even when ages are equal.
        Math.max(0, event.ageMs - i * 0.001),
      )
      const o = i * columns
      const p = (n: number) => `$${o + n}`
      return `(${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ${p(7)}, ${p(8)}, ${p(9)}, ${p(10)}, ${p(11)}, ${p(12)}, clock_timestamp() - make_interval(secs => ${p(13)}::double precision / 1000))`
    })
    await client.query(
      `INSERT INTO analytics_events
        ("sessionId", "visitorHash", type, name, label, path, target, "referrerHost", channel, country, device, value, "createdAt")
       VALUES ${tuples.join(', ')}`,
      values,
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }

  // Retention: about one request in a hundred also deletes expired events,
  // so no scheduled job is needed.
  if (Math.random() < 0.01) {
    await deleteEventsOlderThan(RETENTION_DAYS).catch(() => {})
  }
  return { stored: input.events.length }
}

export async function deleteEventsOlderThan(days: number) {
  const result = await pool.query(
    `DELETE FROM analytics_events WHERE "createdAt" < now() - make_interval(days => $1)`,
    [days],
  )
  return result.rowCount ?? 0
}
