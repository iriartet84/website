import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL

export const pool = new Pool(
  connectionString
    ? { connectionString }
    : { connectionString: "postgres://127.0.0.1:1/unused" },
)

export const db = drizzle(pool, { schema })
