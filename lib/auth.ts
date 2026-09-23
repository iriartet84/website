import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { pool } from "@/lib/db"

const siteUrl =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.URL ? process.env.URL : "http://localhost:3000")

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: siteUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  trustedOrigins: [
    "http://localhost:3000",
    siteUrl,
    ...(process.env.URL ? [process.env.URL] : []),
    ...(process.env.DEPLOY_PRIME_URL ? [process.env.DEPLOY_PRIME_URL] : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
})
