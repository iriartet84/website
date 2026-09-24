import { EditableText } from '@/components/admin/editable'

export type PageHeaderField = 'eyebrow' | 'title' | 'description'

// `edit` switches on in-place editing for the admin page editors; the
// public pages never pass it, so their output is unchanged.
export function PageHeader({
  eyebrow,
  title,
  description,
  edit,
}: {
  eyebrow: string
  title: string
  description?: string
  edit?: {
    onChange: (field: PageHeaderField, value: string) => void
    // Fields that aren't stored anywhere editable (e.g. the CV page title,
    // which comes from lib/content.ts) can be left read-only.
    readOnly?: PageHeaderField[]
  }
}) {
  const editable = (field: PageHeaderField) => edit && !edit.readOnly?.includes(field)

  const eyebrowClass = 'text-xs font-medium uppercase tracking-[0.25em] text-steel-700'
  const titleClass = 'mt-4 font-serif text-4xl tracking-tight text-navy md:text-5xl'
  const descriptionClass =
    'mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground'

  return (
    <header className="bg-background pb-10 pt-32 md:pb-12 md:pt-40">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {editable('eyebrow') ? (
          <EditableText
            as="p"
            value={eyebrow}
            label="Page eyebrow"
            className={eyebrowClass}
            onChange={(value) => edit!.onChange('eyebrow', value)}
          />
        ) : (
          <p className={eyebrowClass}>{eyebrow}</p>
        )}
        {editable('title') ? (
          <EditableText
            as="h1"
            value={title}
            label="Page title"
            className={titleClass}
            onChange={(value) => edit!.onChange('title', value)}
          />
        ) : (
          <h1 className={titleClass}>{title}</h1>
        )}
        {editable('description') ? (
          <EditableText
            as="p"
            value={description ?? ''}
            label="Page description"
            multiline
            className={descriptionClass}
            onChange={(value) => edit!.onChange('description', value)}
          />
        ) : (
          description && <p className={descriptionClass}>{description}</p>
        )}
      </div>
    </header>
  )
}
