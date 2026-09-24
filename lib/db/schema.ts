import { pgTable, text, timestamp, boolean, serial, integer } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

export const paperEntries = pgTable("paper_entries", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  year: text("year").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  type: text("type").notNull().default("Paper"),
  excerpt: text("excerpt").notNull().default(""),
  abstract: text("abstract").notNull().default(""),
  tags: text("tags").notNull().default(""),
  methods: text("methods").notNull().default(""),
  contentType: text("contentType").notNull().default("pdf"),
  pdfUrl: text("pdfUrl"),
  pdfPathname: text("pdfPathname"),
  pdfFilename: text("pdfFilename"),
  latexSource: text("latexSource"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const projectEntries = pgTable("project_entries", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  summary: text("summary").notNull().default(""),
  excerpt: text("excerpt").notNull().default(""),
  tags: text("tags").notNull().default(""),
  status: text("status").notNull().default("In progress"),
  kind: text("kind").notNull().default("dashboard"),
  contentType: text("contentType").notNull().default("pdf"),
  pdfUrl: text("pdfUrl"),
  pdfPathname: text("pdfPathname"),
  pdfFilename: text("pdfFilename"),
  latexSource: text("latexSource"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const experienceEntries = pgTable("experience_entries", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  org: text("org").notNull(),
  role: text("role").notNull(),
  location: text("location").notNull().default(""),
  period: text("period").notNull(),
  summary: text("summary").notNull().default(""),
  details: text("details").notNull().default(""), // newline-separated bullets
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const educationEntries = pgTable("education_entries", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  school: text("school").notNull(),
  location: text("location").notNull().default(""),
  degree: text("degree").notNull(),
  period: text("period").notNull(),
  details: text("details").notNull().default(""), // newline-separated bullets
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const languageEntries = pgTable("language_entries", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  level: text("level").notNull(),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Singleton row (id is always 1) holding the CV header/description and the
// two technical-skills lists. These aren't repeatable list items the way
// experience/education/languages are, so a single editable row — updated
// via upsert, never inserted/deleted through the admin UI — is a simpler
// fit than a full CRUD table.
export const cvProfile = pgTable("cv_profile", {
  id: integer("id").primaryKey(),
  tagline: text("tagline").notNull().default(""),
  nationality: text("nationality").notNull().default(""),
  location: text("location").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  linkedin: text("linkedin").notNull().default(""),
  linkedinUrl: text("linkedinUrl").notNull().default(""),
  programmingSkills: text("programmingSkills").notNull().default(""), // newline-separated
  methodSkills: text("methodSkills").notNull().default(""), // newline-separated
  // The active CV PDF: cvPdfPathname is the storage key (see lib/blobs.ts),
  // resolved to a download URL at request time rather than stored as a
  // fixed URL, since the bucket is private and reads go through a
  // short-lived presigned URL (see app/api/files/[key]/route.ts).
  cvPdfPathname: text("cvPdfPathname"),
  cvPdfFilename: text("cvPdfFilename"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export type PaperEntry = typeof paperEntries.$inferSelect
export type ProjectEntry = typeof projectEntries.$inferSelect
export type ExperienceEntry = typeof experienceEntries.$inferSelect
export type EducationEntry = typeof educationEntries.$inferSelect
export type LanguageEntry = typeof languageEntries.$inferSelect
export type CvProfile = typeof cvProfile.$inferSelect
