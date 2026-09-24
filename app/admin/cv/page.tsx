import {
  getAdminCvProfile,
  getCvProfile,
  listAdminEducation,
  listAdminExperience,
  listAdminLanguages,
} from '@/lib/queries'
import {
  education as staticEducation,
  experience as staticExperience,
  languages as staticLanguages,
  profile,
} from '@/lib/content'
import { parseDetails } from '@/lib/validations'
import { CvEditor, type CvEditorData } from '@/components/admin/cv-editor'

export const metadata = { title: 'Edit CV' }

// /admin/cv — the public /cv page, editable. See components/admin/cv-editor.tsx.
export default async function AdminCvPage() {
  const [cv, adminProfile, experience, education, languages] = await Promise.all([
    getCvProfile(),
    getAdminCvProfile().catch(() => null),
    listAdminExperience().catch(() => null),
    listAdminEducation().catch(() => null),
    listAdminLanguages().catch(() => null),
  ])

  const data: CvEditorData = {
    fullName: profile.fullName,
    loadError: experience === null || education === null || languages === null,
    // getCvProfile() already merges the saved row with the built-in
    // defaults — exactly what the public page shows.
    profile: {
      tagline: cv.tagline,
      nationality: cv.nationality,
      location: cv.location,
      email: cv.email,
      phone: cv.phone,
      linkedin: cv.linkedin,
      linkedinUrl: cv.linkedinUrl,
      programming: cv.programming,
      methods: cv.methods,
    },
    cvPdf: adminProfile?.cvPdfPathname
      ? { key: adminProfile.cvPdfPathname, filename: adminProfile.cvPdfFilename ?? 'CV.pdf' }
      : null,
    experience: (experience ?? []).map((row) => ({
      id: row.id,
      org: row.org,
      role: row.role,
      location: row.location,
      period: row.period,
      summary: row.summary,
      details: parseDetails(row.details),
      published: row.published,
    })),
    education: (education ?? []).map((row) => ({
      id: row.id,
      school: row.school,
      location: row.location,
      degree: row.degree,
      period: row.period,
      details: parseDetails(row.details),
      published: row.published,
    })),
    languages: (languages ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      published: row.published,
    })),
    // Shown publicly while a section has no published entries.
    defaults: {
      experience: staticExperience,
      education: staticEducation,
      languages: staticLanguages,
    },
  }

  return <CvEditor data={data} />
}
