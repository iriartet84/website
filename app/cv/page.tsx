import type { Metadata } from 'next'
import { CvView } from '@/components/cv-view'
import { profile } from '@/lib/content'
import {
  getPublishedExperience,
  getPublishedEducation,
  getPublishedLanguages,
  getCvProfile,
} from '@/lib/queries'
import { getCvLayout } from '@/lib/site-content'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'CV',
  description:
    'Full curriculum vitae: education, professional experience, presentations and research, technical skills, and languages.',
}

// The page body lives in components/cv-view.tsx, shared with the admin CV
// editor (/admin/cv) so both always render the same layout.
export default async function CvPage() {
  const [experience, education, languages, cv, layout] = await Promise.all([
    getPublishedExperience(),
    getPublishedEducation(),
    getPublishedLanguages(),
    getCvProfile(),
    getCvLayout(),
  ])

  return (
    <CvView
      fullName={profile.fullName}
      cv={cv}
      education={education}
      experience={experience}
      languages={languages}
      layout={layout}
    />
  )
}
