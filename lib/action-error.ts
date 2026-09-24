import { ZodError } from "zod"

// Zod v4 dropped `ZodError.errors` (the v3 alias) in favor of `.issues`, and
// ZodError no longer extends Error — so this check has to come first and
// can't fall through to the generic `instanceof Error` branch below it.
export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((e) => e.message).join(", ")
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Something went wrong. Please try again."
}
