export async function compileLatex(source: string): Promise<Buffer> {
  const endpoint = process.env.LATEX_COMPILE_URL
  const secret = process.env.LATEX_COMPILE_SECRET

  if (!endpoint) {
    throw new Error(
      "LaTeX compilation is not configured. Set LATEX_COMPILE_URL to the Tectonic service.",
    )
  }

  const response = await fetch(`${endpoint.replace(/\/$/, "")}/compile`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ source }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || "LaTeX compilation failed")
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
