# Portfolio Website — Claude Code Instructions

## Project

Personal portfolio website built with Next.js and hosted on Netlify.

The repository is connected to GitHub.

## Core rule

The repository on the local filesystem is the source of truth.

Always inspect the current files before making implementation decisions. Do not rely on code from previous conversations if the current repository can be inspected.

## Stack

* Next.js
* TypeScript
* Tailwind CSS
* Drizzle ORM
* Neon Postgres
* Better Auth
* Netlify

Confirm the actual implementation from the repository before making assumptions.

## Development

* Run the development server with `npm run dev`.
* Run the appropriate typecheck/lint/build checks after changes.
* Use existing scripts in `package.json` where possible.
* Keep changes focused on the requested task.

## Implementation principles

* Prefer modifying existing components and utilities over creating unnecessary abstractions.
* Reuse existing patterns and styling.
* Do not redesign unrelated parts of the website.
* Do not remove existing functionality unless explicitly requested.
* Do not change database schema unless required by the task.
* If a database/schema change is required, explain it before implementing it.
* Do not introduce new dependencies unless they are actually necessary.
* Preserve backwards compatibility with existing content and functionality where practical.

## Secrets

* Never modify `.env.local` unless explicitly instructed.
* Never print secret values.
* Never commit secrets.
* Never add real credentials to `.env.example`.
* Treat environment variables as sensitive.

## Git

* Do not commit unless explicitly requested.
* Do not push to GitHub unless explicitly requested.
* Before any requested commit, inspect `git diff` and `git status`.

## Before implementation

For non-trivial tasks:

1. Inspect the relevant files.
2. Identify how the current implementation works.
3. Identify dependencies or related components that may be affected.
4. State the proposed approach briefly.
5. Implement the change.

For simple tasks, avoid unnecessary discussion and proceed directly after inspecting the relevant code.

## After implementation

Verify the change with the most relevant checks available, such as:

* TypeScript/typecheck
* ESLint
* Next.js build
* relevant tests
* local runtime behavior

Report any checks that could not be run.

## Completion report

At the end of a task, provide:

* Files changed
* What changed
* Checks/tests run
* Remaining issues, if any
* Any manual steps I need to perform

Do not claim something was tested if it was not actually tested.