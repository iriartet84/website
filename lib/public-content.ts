import {
  papers as staticPapers,
  paperCategories,
} from '@/lib/content'
import type { OutputSummary, ProjectLink, ProjectSection } from '@/lib/project-meta'
import type { ProjectOutput } from '@/lib/project-output'

export type PublicPaper = {
  slug: string
  title: string
  category: string
  year: string
  type: string
  excerpt: string
  tags: string[]
  pdfUrl: string | null
  date: string
}

export type PublicProject = {
  slug: string
  title: string
  // Sector (shared with Papers' categories).
  category: string
  summary: string
  // Tools & methods.
  tags: string[]
  // Lifecycle: Live | In progress | Coming soon.
  status: string
  // Preview illustration shown when there's no live output yet.
  kind: 'map' | 'chart' | 'dashboard' | 'model'
  pdfUrl: string | null
  date: string
  projectType: string
  mode: string
  languages: string[]
  apis: string[]
  featured: boolean
  updateFrequency: string | null
  // First headline figure + sparkline from the stored output, if any.
  output: OutputSummary | null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function staticPublicPapers(): PublicPaper[] {
  return staticPapers.map((paper) => ({
    slug: slugify(paper.title),
    title: paper.title,
    category: paper.category,
    year: paper.year,
    type: paper.type,
    excerpt: paper.abstract,
    tags: paper.methods,
    pdfUrl: null,
    date: `${paper.year}-01-01`,
  }))
}

export type PublicPaperDetail = PublicPaper & {
  abstract: string
  contentType: string
  latexSource: string | null
  pdfFilename: string | null
}

export type PublicProjectDetail = PublicProject & {
  excerpt: string
  contentType: string
  latexSource: string | null
  pdfFilename: string | null
  links: ProjectLink[]
  embedUrl: string | null
  // Empty = the original single-document page.
  sections: ProjectSection[]
  fullOutput: ProjectOutput | null
}

export function staticPublicPaperDetails(): PublicPaperDetail[] {
  return staticPublicPapers().map((paper) => ({
    ...paper,
    abstract: paper.excerpt,
    contentType: 'pdf',
    latexSource: null,
    pdfFilename: null,
  }))
}

export { paperCategories }
