import { skills } from '@/lib/content'

export function Skillset() {
  return (
    <section className="bg-background py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">
          Skillset
        </p>

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {skills.map((skill) => (
            <div key={skill.index} className="flex flex-col">
              <span className="font-serif text-8xl leading-none text-steel md:text-9xl">
                {skill.index}
              </span>
              <h3 className="mt-5 font-serif text-2xl tracking-tight text-navy">
                {skill.title}
              </h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                {skill.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {skill.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-steel/10 px-3 py-1 text-xs font-semibold text-steel-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
