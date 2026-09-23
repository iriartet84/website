CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "paper_entries" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "category" text NOT NULL,
  "year" text NOT NULL,
  "date" timestamp NOT NULL DEFAULT now(),
  "type" text NOT NULL DEFAULT 'Paper',
  "excerpt" text NOT NULL DEFAULT '',
  "abstract" text NOT NULL DEFAULT '',
  "tags" text NOT NULL DEFAULT '',
  "methods" text NOT NULL DEFAULT '',
  "contentType" text NOT NULL DEFAULT 'pdf',
  "pdfUrl" text,
  "pdfPathname" text,
  "pdfFilename" text,
  "latexSource" text,
  "published" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "project_entries" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "category" text NOT NULL,
  "date" timestamp NOT NULL DEFAULT now(),
  "summary" text NOT NULL DEFAULT '',
  "excerpt" text NOT NULL DEFAULT '',
  "tags" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'In progress',
  "kind" text NOT NULL DEFAULT 'dashboard',
  "contentType" text NOT NULL DEFAULT 'pdf',
  "pdfUrl" text,
  "pdfPathname" text,
  "pdfFilename" text,
  "latexSource" text,
  "published" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "paper_entries" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "paper_entries" ADD COLUMN IF NOT EXISTS "date" timestamp DEFAULT now();
ALTER TABLE "paper_entries" ADD COLUMN IF NOT EXISTS "excerpt" text DEFAULT '';
ALTER TABLE "paper_entries" ADD COLUMN IF NOT EXISTS "tags" text DEFAULT '';
ALTER TABLE "paper_entries" ADD COLUMN IF NOT EXISTS "pdfUrl" text;
ALTER TABLE "paper_entries" ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT true;

ALTER TABLE "project_entries" ADD COLUMN IF NOT EXISTS "slug" text;
ALTER TABLE "project_entries" ADD COLUMN IF NOT EXISTS "date" timestamp DEFAULT now();
ALTER TABLE "project_entries" ADD COLUMN IF NOT EXISTS "excerpt" text DEFAULT '';
ALTER TABLE "project_entries" ADD COLUMN IF NOT EXISTS "pdfUrl" text;
ALTER TABLE "project_entries" ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT true;
