import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { hashPassword } from "better-auth/crypto"

const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const databaseUrl = process.env.DATABASE_URL

if (!email || !password || !databaseUrl) {
  console.error("Set DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const passwordHash = await hashPassword(password)
const userId = randomUUID()
const accountId = randomUUID()

await pool.query(
  `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
   values ($1, $2, $3, true, now(), now())
   on conflict (email) do nothing`,
  [userId, "Admin", email],
)

const user = await pool.query(`select id from "user" where email = $1`, [email])
const id = user.rows[0].id

await pool.query(
  `insert into account (
      id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
    ) values ($1, $2, 'credential', $3, $4, now(), now())
    on conflict do nothing`,
  [accountId, id, id, passwordHash],
)

console.log(`Admin ready: ${email}`)
await pool.end()
