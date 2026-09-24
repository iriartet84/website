import Link from 'next/link'
import {
  listAdminPapers,
  listAdminProjects,
  listAdminExperience,
  listAdminEducation,
  listAdminLanguages,
  getAdminCvProfile,
} from '@/lib/queries'
import { EntryForm } from '@/components/entry-form'
import { ExperienceForm } from '@/components/experience-form'
import { EducationForm } from '@/components/education-form'
import { LanguageForm } from '@/components/language-form'
import { CvDescriptionForm, CvContactForm, CvSkillsForm } from '@/components/cv-profile-form'
import { DeleteEntryButton } from '@/components/delete-entry-button'

async function loadSection<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<{ data: T; error: string | null }> {
  try {
    return { data: await fn(), error: null }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      data: fallback,
      error: `Could not load ${label}: ${detail}`,
    }
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  // Each section is fetched independently — a Promise.all here would mean
  // one failing query (e.g. a table that hasn't been migrated yet) wipes
  // out every other section's results too, hiding data that's actually
  // fine. Loading these separately means a broken "Languages" table still
  // leaves Papers/Projects/Experience visible and editable.
  const [
    { data: papers, error: papersError },
    { data: projects, error: projectsError },
    { data: experience, error: experienceError },
    { data: education, error: educationError },
    { data: languageList, error: languageError },
    { data: cvProfileRow, error: cvProfileError },
  ] = await Promise.all([
    loadSection('papers', listAdminPapers, []),
    loadSection('projects', listAdminProjects, []),
    loadSection('experience', listAdminExperience, []),
    loadSection('education', listAdminEducation, []),
    loadSection('languages', listAdminLanguages, []),
    loadSection('CV profile', getAdminCvProfile, null),
  ])

  const sectionErrors = [
    papersError,
    projectsError,
    experienceError,
    educationError,
    languageError,
    cvProfileError,
  ].filter((e): e is string => Boolean(e))

  const cvProfileDefaults = cvProfileRow
    ? {
        tagline: cvProfileRow.tagline,
        nationality: cvProfileRow.nationality,
        location: cvProfileRow.location,
        email: cvProfileRow.email,
        phone: cvProfileRow.phone,
        linkedin: cvProfileRow.linkedin,
        linkedinUrl: cvProfileRow.linkedinUrl,
        programmingSkills: cvProfileRow.programmingSkills,
        methodSkills: cvProfileRow.methodSkills,
      }
    : undefined

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-5 py-10">
      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {sectionErrors.length > 0 && (
        <div className="space-y-2">
          {sectionErrors.map((message) => (
            <p
              key={message}
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {message}
            </p>
          ))}
        </div>
      )}

      <section>
        <h1 className="font-serif text-3xl text-navy">Papers</h1>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2">Title</th>
                <th>Category</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {papers.map((paper) => (
                <tr key={paper.id} className="border-t border-border">
                  <td className="py-3 text-navy">{paper.title}</td>
                  <td>{paper.category}</td>
                  <td>{paper.contentType}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/papers/${paper.id}`}
                      className="text-steel-700 hover:text-navy"
                    >
                      Edit
                    </Link>
                    <DeleteEntryButton kind="paper" id={paper.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {papers.length === 0 && !papersError && (
            <p className="mt-3 text-sm text-muted-foreground">No papers yet.</p>
          )}
        </div>
        <h2 className="mt-8 font-serif text-2xl text-navy">Add paper</h2>
        <div className="mt-4">
          <EntryForm kind="paper" />
        </div>
      </section>

      <section>
        <h1 className="font-serif text-3xl text-navy">Projects</h1>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2">Title</th>
                <th>Category</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-border">
                  <td className="py-3 text-navy">{project.title}</td>
                  <td>{project.category}</td>
                  <td>{project.contentType}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/projects/${project.id}`}
                      className="text-steel-700 hover:text-navy"
                    >
                      Edit
                    </Link>
                    <DeleteEntryButton kind="project" id={project.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && !projectsError && (
            <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
          )}
        </div>
        <h2 className="mt-8 font-serif text-2xl text-navy">Add project</h2>
        <div className="mt-4">
          <EntryForm kind="project" />
        </div>
      </section>

      <section>
        <h1 className="font-serif text-3xl text-navy">CV — Description &amp; skills</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Each card below saves independently — you don&rsquo;t need to fill in the
          others to update just one.
        </p>
        <div className="mt-4 space-y-6">
          <div>
            <h2 className="font-serif text-xl text-navy">Description</h2>
            <div className="mt-3">
              <CvDescriptionForm defaults={cvProfileDefaults} />
            </div>
          </div>
          <div>
            <h2 className="font-serif text-xl text-navy">Contact &amp; quick facts</h2>
            <div className="mt-3">
              <CvContactForm defaults={cvProfileDefaults} />
            </div>
          </div>
          <div>
            <h2 className="font-serif text-xl text-navy">Technical skills</h2>
            <div className="mt-3">
              <CvSkillsForm defaults={cvProfileDefaults} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h1 className="font-serif text-3xl text-navy">CV — Experience</h1>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2">Role</th>
                <th>Org</th>
                <th>Period</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {experience.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="py-3 text-navy">{entry.role}</td>
                  <td>{entry.org}</td>
                  <td>{entry.period}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/cv/experience/${entry.id}`}
                      className="text-steel-700 hover:text-navy"
                    >
                      Edit
                    </Link>
                    <DeleteEntryButton kind="experience" id={entry.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {experience.length === 0 && !experienceError && (
            <p className="mt-3 text-sm text-muted-foreground">
              No experience entries yet — the public /cv page is showing the
              hardcoded fallback until you add some here.
            </p>
          )}
        </div>
        <h2 className="mt-8 font-serif text-2xl text-navy">Add experience</h2>
        <div className="mt-4">
          <ExperienceForm />
        </div>
      </section>

      <section>
        <h1 className="font-serif text-3xl text-navy">CV — Education</h1>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2">School</th>
                <th>Degree</th>
                <th>Period</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {education.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="py-3 text-navy">{entry.school}</td>
                  <td>{entry.degree}</td>
                  <td>{entry.period}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/cv/education/${entry.id}`}
                      className="text-steel-700 hover:text-navy"
                    >
                      Edit
                    </Link>
                    <DeleteEntryButton kind="education" id={entry.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {education.length === 0 && !educationError && (
            <p className="mt-3 text-sm text-muted-foreground">
              No education entries yet — the public /cv page is showing the
              hardcoded fallback until you add some here.
            </p>
          )}
        </div>
        <h2 className="mt-8 font-serif text-2xl text-navy">Add education</h2>
        <div className="mt-4">
          <EducationForm />
        </div>
      </section>

      <section>
        <h1 className="font-serif text-3xl text-navy">CV — Languages</h1>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-2">Language</th>
                <th>Level</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {languageList.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="py-3 text-navy">{entry.name}</td>
                  <td>{entry.level}</td>
                  <td className="text-right">
                    <Link
                      href={`/admin/cv/languages/${entry.id}`}
                      className="text-steel-700 hover:text-navy"
                    >
                      Edit
                    </Link>
                    <DeleteEntryButton kind="language" id={entry.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {languageList.length === 0 && !languageError && (
            <p className="mt-3 text-sm text-muted-foreground">
              No language entries yet — the public /cv page is showing the
              hardcoded fallback until you add some here.
            </p>
          )}
        </div>
        <h2 className="mt-8 font-serif text-2xl text-navy">Add language</h2>
        <div className="mt-4">
          <LanguageForm />
        </div>
      </section>
    </main>
  )
}
