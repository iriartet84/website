import http from "node:http"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const PORT = Number(process.env.PORT ?? 8080)
const SECRET = process.env.LATEX_COMPILE_SECRET ?? ""
const TECTONIC = process.env.TECTONIC_BIN ?? "tectonic"

function unauthorized() {
  return { status: 401, body: "Unauthorized" }
}

async function compile(source) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tex-"))
  const input = path.join(dir, "main.tex")
  const output = path.join(dir, "main.pdf")
  await writeFile(input, source, "utf8")

  await new Promise((resolve, reject) => {
    const child = spawn(TECTONIC, ["-X", "compile", input, "--outdir", dir], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `tectonic exited ${code}`))
    })
  })

  const pdf = await readFile(output)
  await rm(dir, { recursive: true, force: true })
  return pdf
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200)
    res.end("ok")
    return
  }

  if (req.method !== "POST" || req.url !== "/compile") {
    res.writeHead(404)
    res.end("Not found")
    return
  }

  if (SECRET) {
    const header = req.headers.authorization ?? ""
    if (header !== `Bearer ${SECRET}`) {
      const err = unauthorized()
      res.writeHead(err.status)
      res.end(err.body)
      return
    }
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  let source = ""
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    source = parsed.source ?? ""
  } catch {
    res.writeHead(400)
    res.end("Invalid JSON")
    return
  }

  if (!source || source.length > 200000) {
    res.writeHead(400)
    res.end("LaTeX source missing or too large")
    return
  }

  try {
    const pdf = await compile(source)
    res.writeHead(200, { "content-type": "application/pdf" })
    res.end(pdf)
  } catch (error) {
    res.writeHead(422)
    res.end(error instanceof Error ? error.message : "Compile failed")
  }
})

server.listen(PORT, () => {
  console.log(`latex compiler listening on ${PORT}`)
})
