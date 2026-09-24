// One-time seed: copies the original hardcoded content from lib/content.ts
// into the database. Safe to re-run — every insert is skipped if that
// table already has rows (papers/projects also use ON CONFLICT on slug as
// a second safety net), so running this twice never duplicates data.
//
// Run with:
//   node --env-file=.env.local --import tsx scripts/seed-from-content.ts
// or, once added to package.json:
//   npm run db:seed

import { db, pool } from "../lib/db"
import {
  paperEntries,
  projectEntries,
  educationEntries,
  languageEntries,
  cvProfile,
} from "../lib/db/schema"
import {
  papers,
  projects,
  education,
  languages,
  profile,
  cvSkills,
} from "../lib/content"
import { slugify } from "../lib/validations"
import { sql } from "drizzle-orm"

async function getAdminUserId(): Promise<string> {
  const email = process.env.ADMIN_EMAIL
  if (!email) {
    throw new Error("Set ADMIN_EMAIL (same value used for create-admin) before seeding.")
  }
  const rows = await pool.query('select id from "user" where email = $1', [email])
  if (rows.rows.length === 0) {
    throw new Error(
      `No user found for ADMIN_EMAIL=${email}. Run "npm run create-admin" first.`,
    )
  }
  return rows.rows[0].id
}

async function seedPapers(userId: string) {
  const existing = await db.select({ id: paperEntries.id }).from(paperEntries).limit(1)
  if (existing.length > 0) {
    console.log("Skipping papers — table already has rows.")
    return
  }

  for (const [i, paper] of papers.entries()) {
    await db
      .insert(paperEntries)
      .values({
        userId,
        title: paper.title,
        slug: slugify(paper.title),
        category: paper.category,
        year: paper.year,
        date: new Date(`${paper.year}-01-01`),
        type: paper.type,
        excerpt: paper.abstract,
        abstract: paper.abstract,
        tags: paper.methods.join(", "),
        methods: paper.methods.join(", "),
        contentType: "pdf",
        pdfUrl: null,
        sortOrder: i,
        published: true,
      })
      .onConflictDoNothing({ target: paperEntries.slug })
  }
  console.log(`Seeded ${papers.length} papers.`)
}

async function seedProjects(userId: string) {
  const existing = await db.select({ id: projectEntries.id }).from(projectEntries).limit(1)
  if (existing.length > 0) {
    console.log("Skipping projects — table already has rows.")
    return
  }

  for (const [i, project] of projects.entries()) {
    await db
      .insert(projectEntries)
      .values({
        userId,
        title: project.title,
        slug: slugify(project.title),
        category: project.category,
        date: new Date("2025-01-01"),
        summary: project.summary,
        excerpt: project.summary,
        tags: project.tags.join(", "),
        status: project.status,
        kind: project.kind,
        contentType: "pdf",
        pdfUrl: null,
        sortOrder: i,
        published: true,
      })
      .onConflictDoNothing({ target: projectEntries.slug })
  }
  console.log(`Seeded ${projects.length} projects.`)
}

async function seedEducation(userId: string) {
  const existing = await db.select({ id: educationEntries.id }).from(educationEntries).limit(1)
  if (existing.length > 0) {
    console.log("Skipping education — table already has rows.")
    return
  }

  for (const [i, entry] of education.entries()) {
    await db.insert(educationEntries).values({
      userId,
      school: entry.school,
      location: entry.location,
      degree: entry.degree,
      period: entry.period,
      details: entry.details.join("\n"),
      sortOrder: i,
      published: true,
    })
  }
  console.log(`Seeded ${education.length} education entries.`)
}

async function seedLanguages(userId: string) {
  const existing = await db.select({ id: languageEntries.id }).from(languageEntries).limit(1)
  if (existing.length > 0) {
    console.log("Skipping languages — table already has rows.")
    return
  }

  for (const [i, lang] of languages.entries()) {
    await db.insert(languageEntries).values({
      userId,
      name: lang.name,
      level: lang.level,
      sortOrder: i,
      published: true,
    })
  }
  console.log(`Seeded ${languages.length} languages.`)
}

async function seedCvProfile() {
  await db
    .insert(cvProfile)
    .values({
      id: 1,
      tagline: profile.tagline,
      nationality: profile.nationality,
      location: profile.location,
      email: profile.email,
      phone: profile.phone,
      linkedin: profile.linkedin,
      linkedinUrl: profile.linkedinUrl,
      programmingSkills: cvSkills.programming.join("\n"),
      methodSkills: cvSkills.methods.join("\n"),
    })
    .onConflictDoNothing({ target: cvProfile.id })
  console.log("Seeded CV profile & skills (or it already existed).")
}

async function main() {
  const userId = await getAdminUserId()
  await seedPapers(userId)
  await seedProjects(userId)
  await seedEducation(userId)
  await seedLanguages(userId)
  await seedCvProfile()
  // Sanity check so the script's own output confirms row counts, rather
  // than trusting the per-section "skipped/seeded" messages alone.
  const counts = await db.execute(sql`
    select 'papers' as t, count(*) from ${paperEntries}
    union all select 'projects', count(*) from ${projectEntries}
    union all select 'education', count(*) from ${educationEntries}
    union all select 'languages', count(*) from ${languageEntries}
    union all select 'cv_profile', count(*) from ${cvProfile}
  `)
  console.table(counts.rows)
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err)
    pool.end().finally(() => process.exit(1))
  })
