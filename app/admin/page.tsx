import Link from 'next/link'
import { listAdminPapers, listAdminProjects, listAdminExperience } from '@/lib/queries'
import { EntryForm } from '@/components/entry-form'
import { ExperienceForm } from '@/components/experience-form'
import { DeleteEntryButton } from '@/components/delete-entry-button'

export default async function AdminPage() {
  let papers: Awaited<ReturnType<typeof listAdminPapers>> = []
  let projects: Awaited<ReturnType<typeof listAdminProjects>> = []
  let experience: Awaited<ReturnType<typeof listAdminExperience>> = []
  let dbError: string | null = null

  try {
    ;[papers, projects, experience] = await Promise.all([
      listAdminPapers(),
      listAdminProjects(),
      listAdminExperience(),
    ])
  } catch {
    dbError = 'Could not load database records. Check DATABASE_URL and run migrations.'
  }

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-5 py-10">
      {dbError && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dbError}
        </p>
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
          {papers.length === 0 && !dbError && (
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
          {projects.length === 0 && !dbError && (
            <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
          )}
        </div>
        <h2 className="mt-8 font-serif text-2xl text-navy">Add project</h2>
        <div className="mt-4">
          <EntryForm kind="project" />
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
                      href={`/admin/cv/${entry.id}`}
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
          {experience.length === 0 && !dbError && (
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
    </main>
  )
}
