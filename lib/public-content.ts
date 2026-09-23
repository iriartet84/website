import {
  papers as staticPapers,
  paperCategories,
  projects as staticProjects,
} from '@/lib/content'

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
  category: string
  summary: string
  tags: string[]
  status: string
  kind: 'map' | 'chart' | 'dashboard' | 'model'
  pdfUrl: string | null
  date: string
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

export function staticPublicProjects(): PublicProject[] {
  return staticProjects.map((project) => ({
    slug: slugify(project.title),
    title: project.title,
    category: project.category,
    summary: project.summary,
    tags: project.tags,
    status: project.status,
    kind: project.kind,
    pdfUrl: null,
    date: '2025-01-01',
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

export function staticPublicProjectDetails(): PublicProjectDetail[] {
  return staticPublicProjects().map((project) => ({
    ...project,
    excerpt: project.summary,
    contentType: 'pdf',
    latexSource: null,
    pdfFilename: null,
  }))
}

export { paperCategories }
