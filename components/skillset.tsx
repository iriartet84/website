import type { ReactNode } from 'react'
import { EditableTags, EditableText } from '@/components/admin/editable'
import { indexLabel, type HomeContent, type HomeSkill } from '@/lib/site-content-shared'

type SkillsContent = HomeContent['skills']

const tagClass = 'rounded-full bg-steel/10 px-3 py-1 text-xs font-semibold text-steel-700'

// `edit` is only passed by the admin Home editor; `wrapItem` lets it put its
// toolbar (reorder/delete) around each card without this component knowing
// about it.
export function Skillset({
  content,
  edit,
}: {
  content: SkillsContent
  edit?: {
    onEyebrowChange: (value: string) => void
    onItemChange: (index: number, patch: Partial<HomeSkill>) => void
    wrapItem: (skill: HomeSkill, index: number, card: ReactNode) => ReactNode
    after?: ReactNode
  }
}) {
  return (
    <section className="bg-background py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {edit ? (
          <EditableText
            as="p"
            value={content.eyebrow}
            label="Skillset eyebrow"
            className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700"
            onChange={edit.onEyebrowChange}
          />
        ) : (
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-steel-700">
            {content.eyebrow}
          </p>
        )}

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {content.items.map((skill, index) => {
            const card = (
              <div key={skill.id} className={edit ? 'flex h-full flex-col' : 'flex flex-col'}>
                <span className="font-serif text-8xl leading-none text-steel md:text-9xl">
                  {indexLabel(index)}
                </span>
                {edit ? (
                  <>
                    <EditableText
                      as="h3"
                      value={skill.title}
                      label="Skill title"
                      className="mt-5 font-serif text-2xl tracking-tight text-navy"
                      onChange={(value) => edit.onItemChange(index, { title: value })}
                    />
                    <EditableText
                      as="p"
                      value={skill.description}
                      label="Skill description"
                      multiline
                      className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground"
                      onChange={(value) => edit.onItemChange(index, { description: value })}
                    />
                    <div className="mt-6 flex flex-wrap gap-2">
                      <EditableTags
                        tags={skill.tags}
                        chipClassName={tagClass}
                        onChange={(tags) => edit.onItemChange(index, { tags })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="mt-5 font-serif text-2xl tracking-tight text-navy">
                      {skill.title}
                    </h3>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {skill.description}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {skill.tags.map((tag) => (
                        <span key={tag} className={tagClass}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
            return edit ? (
              <div key={skill.id}>{edit.wrapItem(skill, index, card)}</div>
            ) : (
              card
            )
          })}
          {edit?.after}
        </div>
      </div>
    </section>
  )
}
