'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, ImageUp, Link2, Plus, RotateCcw } from 'lucide-react'
import { Hero } from '@/components/hero'
import { ResearchShowcase } from '@/components/research-showcase'
import { Skillset } from '@/components/skillset'
import { EditingBanner } from '@/components/admin/admin-bar'
import {
  AddItemButton,
  EditableItem,
  ItemToolbar,
  SaveBar,
  SettingsField,
  SettingsPopover,
  scrollToItem,
  settingsInput,
} from '@/components/admin/editor-ui'
import { uploadFile, validateFile } from '@/components/admin/upload'
import { focusItem, moveItem, newClientKey, useEditorState } from '@/components/admin/use-editor-state'
import { saveHomeContentAction } from '@/app/admin/editor-actions'
import type { HomeContent, HomeResearchSection } from '@/lib/site-content-shared'

// /admin/home: the public home page rendered with the same components
// (Hero, ResearchShowcase, Skillset), in edit mode. Research card images
// can be replaced: a new image is previewed locally, then uploaded to the
// private bucket through a presigned URL when the page is saved.

type State = {
  content: HomeContent
  // Images picked but not uploaded yet, by research card id.
  images: Record<string, File>
}

function build(content: HomeContent): State {
  return { content, images: {} }
}

export function HomeEditor({ content: initial }: { content: HomeContent }) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(initial, build)
  const [focusCard, setFocusCard] = useState<number | null>(null)
  const errorKey = status.kind === 'error' ? status.clientKey : undefined
  const { content } = state

  // Local previews for picked images.
  const previews = useMemo(() => {
    const urls: Record<string, string> = {}
    for (const [id, file] of Object.entries(state.images)) urls[id] = URL.createObjectURL(file)
    return urls
  }, [state.images])
  useEffect(() => () => Object.values(previews).forEach((url) => URL.revokeObjectURL(url)), [previews])

  const setContent = (update: (content: HomeContent) => HomeContent) =>
    setState((s) => ({ ...s, content: update(s.content) }))

  const updateSection = (index: number, patch: Partial<HomeResearchSection>) =>
    setContent((c) => ({
      ...c,
      research: {
        ...c.research,
        sections: c.research.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
      },
    }))

  const save = useCallback(async () => {
    const pending = Object.entries(state.images)
    setStatus({
      kind: 'saving',
      message: pending.length ? `Uploading ${pending.length} image${pending.length > 1 ? 's' : ''}…` : 'Saving…',
    })
    try {
      const uploaded: Record<string, string> = {}
      for (const [id, file] of pending) {
        const { key } = await uploadFile(file, 'image')
        uploaded[id] = `/api/files/${encodeURIComponent(key)}`
      }
      const next: HomeContent = {
        ...state.content,
        research: {
          ...state.content.research,
          sections: state.content.research.sections.map((section) =>
            uploaded[section.id] ? { ...section, image: uploaded[section.id] } : section,
          ),
        },
        skills: {
          ...state.content.skills,
          items: state.content.skills.items.map((skill) => ({
            ...skill,
            tags: skill.tags.map((tag) => tag.trim()).filter(Boolean),
          })),
        },
      }
      setStatus({ kind: 'saving', message: 'Saving…' })
      const result = await saveHomeContentAction(next)
      if (!result.ok) {
        // Keep the uploaded images so a retry doesn't upload them again.
        setState((s) => ({ ...s, content: next, images: {} }))
        setStatus({ kind: 'error', message: result.error, clientKey: result.clientKey })
        return
      }
      const saved = { content: next, images: {} }
      setState(saved)
      markSaved(saved)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Saving failed.' })
    }
  }, [state, setState, setStatus, markSaved])

  const displayResearch = {
    ...content.research,
    sections: content.research.sections.map((section) =>
      previews[section.id] ? { ...section, image: previews[section.id] } : section,
    ),
  }
  const sectionCount = content.research.sections.length
  const skillCount = content.skills.items.length

  return (
    <>
      <EditingBanner page="Home">
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
          Open the home page <ExternalLink className="size-3" />
        </a>
      </EditingBanner>

      <main className="pb-32">
        <Hero
          content={content.hero}
          edit={{
            onChange: (field, value) => setContent((c) => ({ ...c, hero: { ...c.hero, [field]: value } })),
          }}
        />

        <ResearchShowcase
          content={displayResearch}
          edit={{
            focusIndex: focusCard,
            onHeaderChange: (field, value) =>
              setContent((c) => ({ ...c, research: { ...c.research, [field]: value } })),
            onItemChange: updateSection,
            headerActions: (
              <button
                type="button"
                onClick={() => {
                  const id = newClientKey('research')
                  setContent((c) => ({
                    ...c,
                    research: {
                      ...c.research,
                      sections: [
                        ...c.research.sections,
                        { id, label: 'New area', title: 'New research area', description: 'Describe this research area.', image: '' },
                      ],
                    },
                  }))
                  setFocusCard(sectionCount)
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-steel/40 px-4 font-sans text-sm font-medium text-steel-700 transition-colors hover:border-steel hover:bg-steel/5"
              >
                <Plus className="size-4" />
                Add card
              </button>
            ),
            wrapItem: (section, index, card) => (
              <EditableItem
                id={`item-${section.id}`}
                highlighted={errorKey === section.id}
                className="h-full w-full max-w-md"
                toolbarClassName="top-3 right-3"
                toolbar={
                  <ItemToolbar
                    itemLabel="card"
                    direction="horizontal"
                    canMoveBack={index > 0}
                    canMoveForward={index < sectionCount - 1}
                    onMoveBack={() => {
                      setContent((c) => ({ ...c, research: { ...c.research, sections: moveItem(c.research.sections, index, index - 1) } }))
                      setFocusCard(index - 1)
                    }}
                    onMoveForward={() => {
                      setContent((c) => ({ ...c, research: { ...c.research, sections: moveItem(c.research.sections, index, index + 1) } }))
                      setFocusCard(index + 1)
                    }}
                    onRemove={() => {
                      setContent((c) => ({
                        ...c,
                        research: { ...c.research, sections: c.research.sections.filter((s) => s.id !== section.id) },
                      }))
                      setState((s) => {
                        const images = { ...s.images }
                        delete images[section.id]
                        return { ...s, images }
                      })
                      setFocusCard(Math.max(0, index - 1))
                    }}
                  />
                }
              >
                {card}
              </EditableItem>
            ),
            imageControl: (section, index) => (
              <ImageControl
                hasPending={Boolean(state.images[section.id])}
                image={section.image}
                onPick={(file) => setState((s) => ({ ...s, images: { ...s.images, [section.id]: file } }))}
                onUndo={() =>
                  setState((s) => {
                    const images = { ...s.images }
                    delete images[section.id]
                    return { ...s, images }
                  })
                }
                onUrl={(image) => {
                  updateSection(index, { image })
                  setState((s) => {
                    const images = { ...s.images }
                    delete images[section.id]
                    return { ...s, images }
                  })
                }}
                storedImage={content.research.sections[index]?.image ?? ''}
              />
            ),
          }}
        />

        <Skillset
          content={content.skills}
          edit={{
            onEyebrowChange: (value) => setContent((c) => ({ ...c, skills: { ...c.skills, eyebrow: value } })),
            onItemChange: (index, patch) =>
              setContent((c) => ({
                ...c,
                skills: {
                  ...c.skills,
                  items: c.skills.items.map((skill, i) => (i === index ? { ...skill, ...patch } : skill)),
                },
              })),
            wrapItem: (skill, index, card) => (
              <EditableItem
                id={`item-${skill.id}`}
                highlighted={errorKey === skill.id}
                className="h-full"
                toolbarClassName="-top-4 right-0"
                toolbar={
                  <ItemToolbar
                    itemLabel="skill"
                    direction="horizontal"
                    canMoveBack={index > 0}
                    canMoveForward={index < skillCount - 1}
                    onMoveBack={() =>
                      setContent((c) => ({ ...c, skills: { ...c.skills, items: moveItem(c.skills.items, index, index - 1) } }))
                    }
                    onMoveForward={() =>
                      setContent((c) => ({ ...c, skills: { ...c.skills, items: moveItem(c.skills.items, index, index + 1) } }))
                    }
                    onRemove={() =>
                      setContent((c) => ({ ...c, skills: { ...c.skills, items: c.skills.items.filter((s) => s.id !== skill.id) } }))
                    }
                  />
                }
              >
                {card}
              </EditableItem>
            ),
            after: (
              <AddItemButton
                className="min-h-48"
                onClick={() => {
                  const id = newClientKey('skill')
                  setContent((c) => ({
                    ...c,
                    skills: {
                      ...c.skills,
                      items: [...c.skills.items, { id, title: 'New skill', description: 'Describe this skill.', tags: [] }],
                    },
                  }))
                  focusItem(`item-${id}`)
                }}
              >
                <Plus className="size-4" />
                Add skill
              </AddItemButton>
            ),
          }}
        />
      </main>

      <SaveBar
        dirty={dirty}
        status={status}
        onSave={save}
        onDiscard={() => {
          discard()
          setFocusCard(null)
        }}
        onShowError={errorKey ? () => scrollToItem(`item-${errorKey}`) : undefined}
      />
    </>
  )
}

// Controls over a research card's image: upload a replacement (previewed
// immediately, uploaded on save) or point it at an image URL/site path.
function ImageControl({
  hasPending,
  image,
  storedImage,
  onPick,
  onUndo,
  onUrl,
}: {
  hasPending: boolean
  image: string
  storedImage: string
  onPick: (file: File) => void
  onUndo: () => void
  onUrl: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState(storedImage)
  const chip =
    'inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-sans text-xs font-medium text-navy shadow-sm backdrop-blur transition-colors hover:bg-white'

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1.5">
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            const problem = validateFile(file, 'image')
            setError(problem)
            if (!problem) onPick(file)
          }}
        />
        <button type="button" className={chip} onClick={() => inputRef.current?.click()}>
          <ImageUp className="size-3.5" />
          {hasPending ? 'Change' : 'Replace image'}
        </button>
        {hasPending ? (
          <button type="button" className={chip} onClick={onUndo}>
            <RotateCcw className="size-3.5" />
            Undo
          </button>
        ) : (
          <SettingsPopover
            title="Image address"
            triggerLabel="Use an image address instead"
            trigger={
              <span className={chip}>
                <Link2 className="size-3.5" />
              </span>
            }
          >
            <SettingsField
              label="Image path or URL"
              hint="A path on this site (e.g. /research/commodity.png) or an https:// address. Leave empty for a placeholder."
            >
              <input className={settingsInput} value={url} onChange={(event) => setUrl(event.target.value)} />
            </SettingsField>
            <button
              type="button"
              onClick={() => onUrl(url.trim())}
              disabled={url.trim() === image}
              className="rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              Use this image
            </button>
          </SettingsPopover>
        )}
      </div>
      {hasPending && <span className="rounded-full bg-navy/80 px-2 py-0.5 font-sans text-[11px] text-white">Uploads on save</span>}
      {error && <span className="rounded bg-white px-2 py-0.5 font-sans text-[11px] text-destructive">{error}</span>}
    </div>
  )
}
