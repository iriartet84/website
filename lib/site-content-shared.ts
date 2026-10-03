import { z } from "zod"
import {
  profile,
  researchSections as staticResearchSections,
  skills as staticSkills,
} from "@/lib/content"

// Shapes, built-in defaults and validation for the editable page copy
// stored in the `site_content` table (see lib/db/schema.ts). This module
// is client-safe (no database imports) so the admin editors can use the
// same types and defaults; the server-side getters live in
// lib/site-content.ts.

// ---- Validation ---------------------------------------------------------

// Images are either a path on this site ("/research/commodity.png", or an
// uploaded file served through "/api/files/<key>"), or an https URL.
const imageSchema = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => value === "" || value.startsWith("/") || value.startsWith("https://"),
    "Images must be a site path or an https:// URL",
  )

const shortText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} can't be empty`).max(max, `${label} is too long`)

const longText = (label: string, max = 1500) =>
  z.string().trim().min(1, `${label} can't be empty`).max(max, `${label} is too long`)

const tagsSchema = z.array(z.string().trim().min(1).max(60)).max(20)

export const pageHeaderSchema = z.object({
  eyebrow: shortText("Eyebrow", 80),
  title: shortText("Title", 160),
  description: longText("Description", 600),
})

export const homeResearchSectionSchema = z.object({
  id: z.string().min(1).max(80),
  label: shortText("Card label", 60),
  title: shortText("Card title", 120),
  description: longText("Card description", 800),
  image: imageSchema,
})

export const homeSkillSchema = z.object({
  id: z.string().min(1).max(80),
  title: shortText("Skill title", 80),
  description: longText("Skill description", 1000),
  tags: tagsSchema,
})

const percent = z.number().min(0).max(100)

// The portrait beside the name on Home. An empty image hides it.
export const heroPhotoSchema = z.object({
  image: imageSchema,
  // Width on tablet/desktop, in px (phones use a fixed small size).
  width: z.number().int().min(160).max(440),
  side: z.enum(["right", "left"]),
  align: z.enum(["top", "center", "bottom"]),
  shape: z.enum(["portrait", "square", "circle"]),
  // Framing inside the frame: the focal point (CSS object-position, in %)
  // and a zoom around it (100 = fill the frame exactly).
  focusX: percent,
  focusY: percent,
  zoom: z.number().min(100).max(300),
})

// The hero's background image. An empty image means a plain background.
export const heroBackgroundSchema = z.object({
  image: imageSchema,
  opacity: percent,
  // 100 = cover the hero; smaller shrinks it, larger zooms in — around
  // the position point.
  zoom: z.number().min(40).max(300),
  positionX: percent,
  positionY: percent,
  // Fade it out upwards so the name and tagline sit on plain background.
  fade: z.boolean(),
})

export type HeroPhoto = z.infer<typeof heroPhotoSchema>
export type HeroBackground = z.infer<typeof heroBackgroundSchema>

export const defaultHeroPhoto: HeroPhoto = {
  image: "/profile/toribio-iriarte.jpg",
  width: 320,
  side: "right",
  align: "center",
  shape: "portrait",
  focusX: 50,
  focusY: 50,
  zoom: 100,
}

export const defaultHeroBackground: HeroBackground = {
  image: "/hero/term-structure.svg",
  opacity: 70,
  zoom: 100,
  positionX: 50,
  positionY: 100,
  fade: true,
}

export const homeContentSchema = z.object({
  hero: z.object({
    eyebrow: shortText("Hero eyebrow", 60),
    firstName: shortText("First name", 60),
    lastName: z.string().trim().max(60),
    tagline: longText("Hero tagline", 600),
    primaryCta: shortText("Primary button label", 40),
    secondaryCta: shortText("Secondary button label", 40),
    // Defaulted so rows saved before these settings existed still parse.
    photo: heroPhotoSchema.default(defaultHeroPhoto),
    background: heroBackgroundSchema.default(defaultHeroBackground),
  }),
  research: z.object({
    eyebrow: shortText("Research eyebrow", 60),
    heading: shortText("Research heading", 120),
    sections: z.array(homeResearchSectionSchema).max(12),
  }),
  skills: z.object({
    eyebrow: shortText("Skillset eyebrow", 60),
    items: z.array(homeSkillSchema).max(9),
  }),
  // Featured projects — shown in place of Research Focus once at least one
  // published project is featured. Defaulted so rows saved before this
  // section existed still parse.
  featured: z
    .object({
      eyebrow: shortText("Featured eyebrow", 60),
      heading: shortText("Featured heading", 120),
    })
    .default({ eyebrow: "Featured Projects", heading: "Live research, by sector" }),
})

export type PageHeaderContent = z.infer<typeof pageHeaderSchema>
export type HomeResearchSection = z.infer<typeof homeResearchSectionSchema>
export type HomeSkill = z.infer<typeof homeSkillSchema>
export type HomeContent = z.infer<typeof homeContentSchema>

// ---- CV layout -----------------------------------------------------------
// The CV page's sections: their order, titles and visibility. Four are
// built in, with their entries in their own tables (education, experience,
// skills on the CV profile, languages); any number of "entries" sections
// can be added, whose entries (experience-style: organisation, role,
// location, period, summary, bullet points) are stored right here — e.g.
// "Presentations & Research". Stored under the "cv" key in site_content.

export const cvBuiltInSections = ["education", "experience", "skills", "languages"] as const
export type CvBuiltInSection = (typeof cvBuiltInSections)[number]

export const cvEntrySchema = z.object({
  id: z.string().min(1).max(80),
  org: z.string().trim().min(2, "Organisation needs at least 2 characters").max(150),
  role: z.string().trim().min(2, "Title needs at least 2 characters").max(200),
  location: z.string().trim().max(150),
  period: z.string().trim().min(2, "Date needs at least 2 characters").max(80),
  summary: z.string().trim().max(400),
  details: z.array(z.string().trim().min(1).max(1000)).max(20),
  published: z.boolean(),
})

export const cvSectionSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum([...cvBuiltInSections, "entries"]),
  title: shortText("Section title", 80),
  visible: z.boolean(),
  entries: z.array(cvEntrySchema).max(50).default([]),
})

export const cvLayoutSchema = z
  .object({ sections: z.array(cvSectionSchema).min(1).max(20) })
  .superRefine((layout, ctx) => {
    for (const kind of cvBuiltInSections) {
      if (layout.sections.filter((section) => section.kind === kind).length > 1) {
        ctx.addIssue({ code: "custom", message: `The ${kind} section appears twice`, path: ["sections"] })
      }
    }
    const ids = layout.sections.map((section) => section.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Two sections share an id", path: ["sections"] })
    }
  })

export type CvEntry = z.infer<typeof cvEntrySchema>
export type CvSection = z.infer<typeof cvSectionSchema>
export type CvLayout = z.infer<typeof cvLayoutSchema>

export const defaultCvLayout: CvLayout = {
  sections: [
    { id: "education", kind: "education", title: "Education", visible: true, entries: [] },
    { id: "experience", kind: "experience", title: "Professional Experience", visible: true, entries: [] },
    {
      id: "presentations",
      kind: "entries",
      title: "Presentations & Research",
      visible: true,
      entries: [
        {
          id: "lse-presentation",
          org: "London School of Economics",
          role: "Research Presentation",
          location: "London, UK",
          period: "2025",
          summary: "Oil, Institutions & Growth in Developing Countries — CIVICA–LSE research exchange",
          details: [
            "Presented thesis research on how oil endowments condition institutional quality and long-run growth in developing countries.",
            "Two-stage least squares in R, instrumenting oil with a 10-year lag within an augmented Solow framework.",
          ],
          published: true,
        },
        {
          id: "european-commission-policy-proposal",
          org: "European Commission",
          role: "Policy Proposal",
          location: "Brussels, Belgium",
          period: "11/2024",
          summary: "Designed agricultural reform for water stress in Cyprus",
          details: [
            "Designed incentive-compatible economic mechanisms — tiered pricing, elasticity-based incentives, behavioural nudges — to encourage crop diversification.",
            "Quantified outcomes (20% evaporation reduction through destratification, 33.5% via monomolecular films) and presented the pilot to European Commission and Cyprus representatives.",
            "Collaborated with an international team to design and pitch feasible agricultural investment.",
          ],
          published: true,
        },
      ],
    },
    { id: "skills", kind: "skills", title: "Technical Skills", visible: true, entries: [] },
    { id: "languages", kind: "languages", title: "Languages", visible: true, entries: [] },
  ],
}

export type ListPageKey = "papers" | "projects"
export const listPageContentSchema = z.object({ header: pageHeaderSchema })
export type ListPageContent = z.infer<typeof listPageContentSchema>

// ---- Built-in defaults (exactly what the public site showed before) ------

export const defaultHomeContent: HomeContent = {
  hero: {
    eyebrow: "Graduate Economist",
    firstName: "Toribio",
    lastName: "Iriarte",
    tagline: profile.tagline,
    primaryCta: "View projects",
    secondaryCta: "Papers & briefs",
    photo: defaultHeroPhoto,
    background: defaultHeroBackground,
  },
  research: {
    eyebrow: "Research Focus",
    heading: "Commodity research, in context",
    sections: staticResearchSections.map((section) => ({
      id: section.id,
      label: section.label,
      title: section.title,
      description: section.description,
      image: section.image,
    })),
  },
  skills: {
    eyebrow: "Skillset",
    items: staticSkills.map((skill) => ({
      id: `skill-${skill.index}`,
      title: skill.title,
      description: skill.description,
      tags: skill.tags,
    })),
  },
  featured: {
    eyebrow: "Featured Projects",
    heading: "Live research, by sector",
  },
}

export const defaultListPageContent: Record<ListPageKey, ListPageContent> = {
  papers: {
    header: {
      eyebrow: "Papers & Briefs",
      title: "Research & policy writing",
      description:
        "Papers, reports, and briefs spanning structural macro modelling, geopolitical risk, commodity markets, and financial-market analysis — filter by theme.",
    },
  },
  projects: {
    header: {
      eyebrow: "Projects",
      title: "Dynamic research, deployed",
      description:
        "A growing collection of interactive tools — maps, forecasting dashboards, and quantitative explorers — that turn research into things you can actually click through.",
    },
  },
}

// "01", "02", ... — the numbered labels on the Home cards follow their
// position, so reordering or adding cards never leaves gaps.
export function indexLabel(position: number) {
  return String(position + 1).padStart(2, "0")
}
