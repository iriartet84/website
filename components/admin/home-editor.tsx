'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, ImageUp, Link2, Move, Plus, RotateCcw, SlidersHorizontal, Star, Trash2 } from 'lucide-react'
import { Hero } from '@/components/hero'
import { ResearchShowcase } from '@/components/research-showcase'
import { FeaturedProjects } from '@/components/featured-projects'
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
import { confirmLeaveWithUnsavedChanges } from '@/components/admin/unsaved-guard'
import {
  defaultHeroBackground,
  defaultHeroPhoto,
  type HeroBackground,
  type HeroPhoto,
  type HomeContent,
  type HomeResearchSection,
} from '@/lib/site-content-shared'
import type { PublicProject } from '@/lib/public-content'

// /admin/home: the public home page rendered with the same components
// (Hero, ResearchShowcase or FeaturedProjects, Skillset), in edit mode.
// Once any published project is featured (chosen on /admin/projects),
// Featured Projects replaces Research Focus on the public page; Research
// Focus stays editable here behind a toggle. Research card images, the
// hero photo and the hero background can be replaced: a new image is
// previewed locally, then uploaded to the private bucket through a
// presigned URL when the page is saved. The photo's size, side, alignment,
// shape and framing, and the background's opacity, size, position and fade
// are set from their settings popovers (the photo can also be dragged to
// reframe it).

type State = {
  content: HomeContent
  // Images picked but not uploaded yet, by research card id — or by
  // HERO_PHOTO / HERO_BACKGROUND for the hero's.
  images: Record<string, File>
}

const HERO_PHOTO = 'hero:photo'
const HERO_BACKGROUND = 'hero:background'

function build(content: HomeContent): State {
  return { content, images: {} }
}

export function HomeEditor({ content: initial, featured }: { content: HomeContent; featured: PublicProject[] }) {
  const { state, setState, dirty, status, setStatus, discard, markSaved } = useEditorState(initial, build)
  const [focusCard, setFocusCard] = useState<number | null>(null)
  const [showResearch, setShowResearch] = useState(false)
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

  const updatePhoto = (patch: Partial<HeroPhoto>) =>
    setContent((c) => ({ ...c, hero: { ...c.hero, photo: { ...c.hero.photo, ...patch } } }))
  const updateBackground = (patch: Partial<HeroBackground>) =>
    setContent((c) => ({ ...c, hero: { ...c.hero, background: { ...c.hero.background, ...patch } } }))
  const dropPending = (key: string) =>
    setState((s) => {
      const images = { ...s.images }
      delete images[key]
      return { ...s, images }
    })
  const pick = (key: string) => (file: File) => setState((s) => ({ ...s, images: { ...s.images, [key]: file } }))

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
        hero: {
          ...state.content.hero,
          photo: uploaded[HERO_PHOTO]
            ? { ...state.content.hero.photo, image: uploaded[HERO_PHOTO] }
            : state.content.hero.photo,
          background: uploaded[HERO_BACKGROUND]
            ? { ...state.content.hero.background, image: uploaded[HERO_BACKGROUND] }
            : state.content.hero.background,
        },
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
  const displayHero = {
    ...content.hero,
    photo: previews[HERO_PHOTO] ? { ...content.hero.photo, image: previews[HERO_PHOTO] } : content.hero.photo,
    background: previews[HERO_BACKGROUND]
      ? { ...content.hero.background, image: previews[HERO_BACKGROUND] }
      : content.hero.background,
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
          content={displayHero}
          edit={{
            onChange: (field, value) => setContent((c) => ({ ...c, hero: { ...c.hero, [field]: value } })),
            photoControl: (
              <HeroPhotoControl
                photo={displayHero.photo}
                hasPending={Boolean(state.images[HERO_PHOTO])}
                onChange={updatePhoto}
                onPick={pick(HERO_PHOTO)}
                onUndo={() => dropPending(HERO_PHOTO)}
                onImage={(image) => {
                  updatePhoto({ image })
                  dropPending(HERO_PHOTO)
                }}
              />
            ),
            backgroundControl: (
              <HeroBackgroundControl
                background={displayHero.background}
                hasPending={Boolean(state.images[HERO_BACKGROUND])}
                onChange={updateBackground}
                onPick={pick(HERO_BACKGROUND)}
                onUndo={() => dropPending(HERO_BACKGROUND)}
                onImage={(image) => {
                  updateBackground({ image })
                  dropPending(HERO_BACKGROUND)
                }}
              />
            ),
          }}
        />

        {featured.length > 0 && (
          <>
            <FeaturedProjects
              content={content.featured}
              projects={featured}
              edit={{
                onHeaderChange: (field, value) =>
                  setContent((c) => ({ ...c, featured: { ...c.featured, [field]: value } })),
                headerActions: (
                  <Link
                    href="/admin/projects"
                    onClick={(event) => {
                      if (!confirmLeaveWithUnsavedChanges()) event.preventDefault()
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-steel/40 px-4 font-sans text-sm font-medium text-steel-700 transition-colors hover:border-steel hover:bg-steel/5"
                  >
                    <Star className="size-4" />
                    Choose featured projects
                  </Link>
                ),
              }}
            />
            <div className="border-y border-steel/20 bg-steel/5">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 font-sans text-xs text-steel-700 sm:px-8">
                <span>
                  Research Focus is hidden from visitors while projects are featured. It comes back if you
                  un-feature them all.
                </span>
                <button
                  type="button"
                  aria-expanded={showResearch}
                  onClick={() => setShowResearch((value) => !value)}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {showResearch ? 'Hide Research Focus' : 'Edit Research Focus anyway'}
                </button>
              </div>
            </div>
          </>
        )}

        {(featured.length === 0 || showResearch) && (
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
        )}

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

// ---- Hero photo & background ------------------------------------------------

const heroChip =
  'inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 font-sans text-xs font-medium text-navy shadow-sm ring-1 ring-navy/10 backdrop-blur transition-colors hover:bg-white'

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-medium text-navy">
        {label}
        <span className="tabular-nums text-muted-foreground">
          {Math.round(value)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-[var(--steel)]"
      />
    </label>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <span className="text-xs font-medium text-navy">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-1 flex gap-1 rounded-lg bg-secondary p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? 'flex-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-navy shadow-sm'
                : 'flex-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-navy'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// "Replace" (pick a file — previewed now, uploaded on save) + "Undo". The
// image-address field lives in the settings popover (ImageAddressField).
function ImagePicker({
  label,
  hasPending,
  image,
  onPick,
  onUndo,
}: {
  label: string
  hasPending: boolean
  image: string
  onPick: (file: File) => void
  onUndo: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
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
      <button type="button" className={heroChip} onClick={() => inputRef.current?.click()}>
        <ImageUp className="size-3.5" />
        {hasPending ? 'Change' : image ? `Replace ${label}` : `Add ${label}`}
      </button>
      {hasPending && (
        <button type="button" className={heroChip} onClick={onUndo}>
          <RotateCcw className="size-3.5" />
          Undo
        </button>
      )}
      {hasPending && <span className="rounded-full bg-navy/80 px-2 py-0.5 font-sans text-[11px] text-white">Uploads on save</span>}
      {error && <span className="rounded bg-white px-2 py-0.5 font-sans text-[11px] text-destructive">{error}</span>}
    </>
  )
}

function ImageAddressField({ image, onImage, hint }: { image: string; onImage: (url: string) => void; hint: string }) {
  const [url, setUrl] = useState(image.startsWith('blob:') ? '' : image)
  return (
    <div className="space-y-2">
      <SettingsField label="Image path or URL" hint={hint}>
        <input className={settingsInput} value={url} onChange={(event) => setUrl(event.target.value)} />
      </SettingsField>
      <button
        type="button"
        onClick={() => onImage(url.trim())}
        disabled={url.trim() === image}
        className="rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:opacity-50"
      >
        Use this address
      </button>
    </div>
  )
}

// Over the hero photo: drag it to reframe (moves the focal point); chips
// to replace it and open its settings.
function HeroPhotoControl({
  photo,
  hasPending,
  onChange,
  onPick,
  onUndo,
  onImage,
}: {
  photo: HeroPhoto
  hasPending: boolean
  onChange: (patch: Partial<HeroPhoto>) => void
  onPick: (file: File) => void
  onUndo: () => void
  onImage: (url: string) => void
}) {
  const drag = useRef<{ x: number; y: number; fx: number; fy: number; w: number; h: number } | null>(null)
  const clamp = (value: number) => Math.min(100, Math.max(0, value))

  return (
    <div
      className={
        photo.image
          ? 'group/photo absolute inset-0 cursor-move touch-none'
          : 'absolute inset-0 flex items-center justify-center'
      }
      title={photo.image ? 'Drag to reframe the photo' : undefined}
      onPointerDown={(event) => {
        if (!photo.image || event.button !== 0 || event.target !== event.currentTarget) return
        const box = event.currentTarget.getBoundingClientRect()
        drag.current = { x: event.clientX, y: event.clientY, fx: photo.focusX, fy: photo.focusY, w: box.width, h: box.height }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (!start) return
        // Dragging the picture right reveals more of its left side.
        const k = 100 / (photo.zoom / 100)
        onChange({
          focusX: Math.round(clamp(start.fx - ((event.clientX - start.x) / start.w) * k)),
          focusY: Math.round(clamp(start.fy - ((event.clientY - start.y) / start.h) * k)),
        })
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
    >
      {photo.image && (
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-navy/75 px-2 py-0.5 font-sans text-[11px] text-white opacity-0 transition-opacity group-hover/photo:opacity-100">
          <Move className="size-3" />
          Drag to reframe
        </span>
      )}
      <div
        className={
          photo.image
            ? 'absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-end gap-1.5'
            : 'flex flex-col items-center gap-1.5 p-2 text-center'
        }
      >
        <ImagePicker label="photo" hasPending={hasPending} image={photo.image} onPick={onPick} onUndo={onUndo} />
        <SettingsPopover
          title="Photo"
          triggerLabel="Photo settings"
          trigger={
            <span className={heroChip}>
              <SlidersHorizontal className="size-3.5" />
            </span>
          }
        >
          <RangeField label="Size (tablet & desktop)" value={photo.width} min={160} max={440} step={4} unit="px" onChange={(width) => onChange({ width })} />
          <Segmented
            label="Side"
            value={photo.side}
            options={[
              { value: 'left', label: 'Left of name' },
              { value: 'right', label: 'Right of name' },
            ]}
            onChange={(side) => onChange({ side })}
          />
          <Segmented
            label="Vertical position"
            value={photo.align}
            options={[
              { value: 'top', label: 'Top' },
              { value: 'center', label: 'Middle' },
              { value: 'bottom', label: 'Bottom' },
            ]}
            onChange={(align) => onChange({ align })}
          />
          <Segmented
            label="Shape"
            value={photo.shape}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'square', label: 'Square' },
              { value: 'circle', label: 'Circle' },
            ]}
            onChange={(shape) => onChange({ shape })}
          />
          <RangeField label="Zoom" value={photo.zoom} min={100} max={300} step={5} unit="%" onChange={(zoom) => onChange({ zoom })} />
          <RangeField label="Framing — horizontal" value={photo.focusX} min={0} max={100} unit="%" onChange={(focusX) => onChange({ focusX })} />
          <RangeField label="Framing — vertical" value={photo.focusY} min={0} max={100} unit="%" onChange={(focusY) => onChange({ focusY })} />
          <ImageAddressField
            image={photo.image}
            onImage={onImage}
            hint="A path on this site (e.g. /profile/toribio-iriarte.jpg) or an https:// address."
          />
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onChange({ focusX: 50, focusY: 50, zoom: 100 })}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-navy hover:bg-secondary"
            >
              <RotateCcw className="size-3" />
              Reset framing
            </button>
            <button
              type="button"
              onClick={() => {
                onUndo()
                onChange(defaultHeroPhoto)
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-navy hover:bg-secondary"
            >
              Restore default
            </button>
            {photo.image && (
              <button
                type="button"
                onClick={() => onImage('')}
                className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="size-3" />
                Remove photo
              </button>
            )}
          </div>
        </SettingsPopover>
      </div>
    </div>
  )
}

// Bottom-left of the hero: replace the background and open its settings.
function HeroBackgroundControl({
  background,
  hasPending,
  onChange,
  onPick,
  onUndo,
  onImage,
}: {
  background: HeroBackground
  hasPending: boolean
  onChange: (patch: Partial<HeroBackground>) => void
  onPick: (file: File) => void
  onUndo: () => void
  onImage: (url: string) => void
}) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1.5 sm:left-8">
      <span className="rounded-full bg-navy/75 px-2 py-0.5 font-sans text-[11px] font-medium text-white">Background</span>
      <ImagePicker
        label="background"
        hasPending={hasPending}
        image={background.image}
        onPick={onPick}
        onUndo={onUndo}
      />
      <SettingsPopover
        title="Background"
        triggerLabel="Background settings"
        trigger={
          <span className={heroChip}>
            <SlidersHorizontal className="size-3.5" />
          </span>
        }
      >
        <RangeField label="Opacity" value={background.opacity} min={0} max={100} unit="%" onChange={(opacity) => onChange({ opacity })} />
        <RangeField label="Size" value={background.zoom} min={40} max={300} step={5} unit="%" onChange={(zoom) => onChange({ zoom })} />
        <RangeField label="Position — horizontal" value={background.positionX} min={0} max={100} unit="%" onChange={(positionX) => onChange({ positionX })} />
        <RangeField label="Position — vertical" value={background.positionY} min={0} max={100} unit="%" onChange={(positionY) => onChange({ positionY })} />
        <label className="flex items-start gap-2 text-xs text-navy">
          <input
            type="checkbox"
            checked={background.fade}
            onChange={(event) => onChange({ fade: event.target.checked })}
            className="mt-0.5 accent-[var(--steel)]"
          />
          <span>
            <span className="font-medium">Fade out behind the text</span>
            <span className="block text-muted-foreground">Shows the image only along the bottom of the hero.</span>
          </span>
        </label>
        <ImageAddressField
          image={background.image}
          onImage={onImage}
          hint="A path on this site (e.g. /hero/term-structure.svg) or an https:// address."
        />
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              onUndo()
              onChange(defaultHeroBackground)
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-navy hover:bg-secondary"
          >
            <RotateCcw className="size-3" />
            Restore default
          </button>
          {background.image && (
            <button
              type="button"
              onClick={() => onImage('')}
              className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-3" />
              Remove background
            </button>
          )}
        </div>
      </SettingsPopover>
    </div>
  )
}
