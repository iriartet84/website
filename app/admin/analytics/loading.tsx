// Skeleton while the dashboard's queries run.
export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8" aria-busy="true" aria-label="Loading analytics">
      <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
      <div className="mt-4 h-10 w-56 animate-pulse rounded bg-secondary" />
      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm shadow-navy/5" />
        ))}
      </div>
      <div className="mt-5 h-72 animate-pulse rounded-2xl bg-white shadow-sm shadow-navy/5" />
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-white shadow-sm shadow-navy/5" />
        ))}
      </div>
    </main>
  )
}
