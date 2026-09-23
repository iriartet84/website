import type { MetadataRoute } from 'next'
import { getPublishedPapers, getPublishedProjects } from '@/lib/queries'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://toribioiriarte.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [papers, projects] = await Promise.all([
    getPublishedPapers().catch(() => []),
    getPublishedProjects().catch(() => []),
  ])

  const staticRoutes = ['', '/papers', '/projects', '/cv', '/contact'].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
    }),
  )

  return [
    ...staticRoutes,
    ...papers.map((paper) => ({
      url: `${siteUrl}/papers#${paper.slug}`,
      lastModified: new Date(paper.date),
    })),
    ...projects.map((project) => ({
      url: `${siteUrl}/projects#${project.slug}`,
      lastModified: new Date(project.date),
    })),
  ]
}
