// Writes the JSON Schema for the project output contract
// ("portfolio-output/1", defined in lib/project-output.ts) to:
//   - public/schemas/portfolio-output-1.json  (served by the site, so a
//     project repo or an editor can reference it by URL)
//   - project-template/schema/portfolio-output-1.json  (copied into new
//     project repositories with the template)
//
// Run after changing lib/project-output.ts:  npm run schema:output
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import { OUTPUT_SCHEMA, projectOutputSchema } from "../lib/project-output"

const { $schema, ...body } = z.toJSONSchema(projectOutputSchema, { io: "input", target: "draft-2020-12" })
const schema = {
  $schema,
  $id: "https://toribioiriarte.netlify.app/schemas/portfolio-output-1.json",
  title: OUTPUT_SCHEMA,
  description:
    "The file a project publishes for the portfolio site: headline figures, series for charts, notes and downloads. Fields may be added in later versions; unknown fields are ignored.",
  ...body,
}

const root = join(import.meta.dirname, "..")
for (const target of ["public/schemas/portfolio-output-1.json", "project-template/schema/portfolio-output-1.json"]) {
  const path = join(root, target)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`)
  console.log(`wrote ${target}`)
}
