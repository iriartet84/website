export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <header className="bg-background pb-10 pt-32 md:pb-12 md:pt-40">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-navy md:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </header>
  )
}
