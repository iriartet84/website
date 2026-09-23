'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')
    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    })
    setPending(false)
    if (authError) {
      setError('Invalid credentials or too many attempts. Try again shortly.')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5">
      <form
        action={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm shadow-navy/10"
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">
          Admin
        </p>
        <h1 className="mt-3 font-serif text-3xl text-navy">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Private access for content publishing. There is no public signup.
        </p>
        <label className="mt-6 block text-sm font-medium text-navy">
          Email
          <input
            required
            type="email"
            name="email"
            autoComplete="username"
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-navy">
          Password
          <input
            required
            type="password"
            name="password"
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
