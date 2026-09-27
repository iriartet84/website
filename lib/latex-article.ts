import katex from "katex"
import { parse } from "@unified-latex/unified-latex-util-parse"
import { printRaw } from "@unified-latex/unified-latex-util-print-raw"
import type * as Ast from "@unified-latex/unified-latex-types"
import { isStorageKey } from "@/lib/blobs"

// LaTeX source → an HTML article, for papers, briefs and project documents
// written in LaTeX. The source is parsed (unified-latex) and turned into
// plain HTML here, with maths typeset by KaTeX — so the paper reads like an
// article on its page, and nothing external (no TeX installation or compile
// service) is involved.
//
// It covers what papers actually use: sections (numbered, and lettered after
// \appendix), paragraphs and inline formatting, lists, maths (inline,
// display, equation/align/gather with numbering), figures and tables with
// captions, tabular, footnotes, \label/\ref/\eqref/\cref, citations with a
// thebibliography list, theorem-like environments and proofs, verbatim code,
// \href/\url, accents, and \newcommand / \DeclareMathOperator definitions.
// Anything else is shown as its text, and listed in `warnings` so the editor
// can say what to change.
//
// Every piece of text is HTML-escaped as it's written out, and links and
// image sources are limited to safe forms (https/mailto/in-page links;
// uploaded /api/files/ images or https images), so the result is safe to
// render as HTML. Server-only (it checks storage keys via lib/blobs).

export type ArticleHeading = {
  id: string
  number: string | null
  html: string
  level: 1 | 2 | 3
}

export type RenderedArticle = {
  html: string
  abstractHtml: string | null
  titleHtml: string | null
  authorsHtml: string[]
  dateHtml: string | null
  headings: ArticleHeading[]
  images: string[]
  warnings: string[]
}

const MAX_SOURCE_CHARS = 200_000
const MAX_WARNINGS = 25
const MAX_MACRO_DEPTH = 12

// ---- Small helpers -----------------------------------------------------------

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(text: string) {
  return escapeHtml(text).replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// TeX ligatures and quotes, applied to runs of text.
function typography(text: string) {
  return text
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/``/g, "“")
    .replace(/''/g, "”")
    .replace(/`/g, "‘")
    .replace(/'/g, "’")
    .replace(/~/g, " ")
    .replace(/!´/g, "¡")
    .replace(/\?´/g, "¿")
}

const isStar = (arg: Ast.Argument | undefined) =>
  !!arg && arg.openMark === "" && arg.content.length === 1 && arg.content[0].type === "string" && arg.content[0].content === "*"

function mandatoryArgs(node: Ast.Macro | Ast.Environment): Ast.Node[][] {
  return (node.args ?? []).filter((a) => a.openMark === "{").map((a) => a.content)
}

function optionalArgs(node: Ast.Macro | Ast.Environment): Ast.Node[][] {
  return (node.args ?? []).filter((a) => a.openMark === "[").map((a) => a.content)
}

// Inside list and bibliography environments the parser attaches an item's
// text to its \item / \bibitem as a final, unbracketed argument.
function attachedBody(node: Ast.Macro): Ast.Node[] {
  const last = node.args?.[node.args.length - 1]
  return last && last.openMark === "" && !isStar(last) ? last.content : []
}

// An optional [..] at the start of an environment the parser doesn't know
// (theorem-like environments declared with \newtheorem).
function leadingOptional(content: Ast.Node[]): { optional: Ast.Node[] | null; rest: Ast.Node[] } {
  let i = 0
  while (i < content.length && isWhitespace(content[i])) i++
  const first = content[i]
  if (!(first?.type === "string" && first.content === "[")) return { optional: null, rest: content }
  const inner: Ast.Node[] = []
  let depth = 0
  for (let j = i + 1; j < content.length; j++) {
    const node = content[j]
    if (node.type === "string" && node.content === "[") depth++
    if (node.type === "string" && node.content === "]") {
      if (depth === 0) return { optional: inner, rest: content.slice(j + 1) }
      depth--
    }
    inner.push(node)
  }
  return { optional: null, rest: content }
}

function starred(node: Ast.Macro) {
  return (node.args ?? []).some(isStar)
}

// Raw text of an argument, with TeX escapes undone (for URLs, keys, paths).
function rawText(nodes: Ast.Node[] | undefined) {
  if (!nodes) return ""
  return printRaw(nodes)
    .replace(/\\([%#&_~$])/g, "$1")
    .trim()
}

function envName(node: Ast.Environment | Ast.VerbatimEnvironment | { env: unknown }) {
  const env = (node as { env: unknown }).env
  if (typeof env === "string") return env
  return printRaw(env as Ast.Node)
}

function isWhitespace(node: Ast.Node | undefined) {
  return !!node && (node.type === "whitespace" || node.type === "comment")
}

const combiningAccents: Record<string, string> = {
  "'": "́",
  "`": "̀",
  "^": "̂",
  '"': "̈",
  "~": "̃",
  "=": "̄",
  ".": "̇",
  u: "̆",
  v: "̌",
  H: "̋",
  c: "̧",
  k: "̨",
  r: "̊",
  d: "̣",
  b: "̱",
}

const symbols: Record<string, string> = {
  "&": "&",
  "%": "%",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  " ": " ",
  ",": " ",
  ";": " ",
  ":": " ",
  "!": "",
  "@": "",
  "/": "",
  "-": "",
  LaTeX: "LaTeX",
  LaTeXe: "LaTeX2ε",
  TeX: "TeX",
  ldots: "…",
  dots: "…",
  textellipsis: "…",
  textendash: "–",
  textemdash: "—",
  S: "§",
  P: "¶",
  copyright: "©",
  textcopyright: "©",
  textregistered: "®",
  texttrademark: "™",
  pounds: "£",
  textsterling: "£",
  euro: "€",
  EUR: "€",
  texteuro: "€",
  textdollar: "$",
  textbackslash: "\\",
  textasciitilde: "~",
  textasciicircum: "^",
  textbar: "|",
  textless: "<",
  textgreater: ">",
  textbullet: "•",
  textdegree: "°",
  degree: "°",
  textperthousand: "‰",
  textpercent: "%",
  i: "ı",
  j: "ȷ",
  o: "ø",
  O: "Ø",
  ss: "ß",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  aa: "å",
  AA: "Å",
  l: "ł",
  L: "Ł",
  guillemotleft: "«",
  guillemotright: "»",
  textquoteleft: "‘",
  textquoteright: "’",
  textquotedblleft: "“",
  textquotedblright: "”",
  quad: " ",
  qquad: "  ",
  enspace: " ",
  thinspace: " ",
  hfill: " ",
  hfil: " ",
  dotfill: " ",
  textvisiblespace: "␣",
  textexclamdown: "¡",
  textquestiondown: "¿",
  checkmark: "✓",
  dag: "†",
  ddag: "‡",
  textdagger: "†",
  textdaggerdbl: "‡",
}

// Macros that affect layout or setup only: dropped without a warning.
const ignoredMacros = new Set([
  "centering", "raggedright", "raggedleft", "noindent", "indent", "vspace", "hspace", "vskip",
  "hskip", "smallskip", "medskip", "bigskip", "newpage", "clearpage", "cleardoublepage", "pagebreak",
  "nopagebreak", "maketitle", "tableofcontents", "listoffigures", "listoftables", "thispagestyle",
  "pagestyle", "bibliographystyle", "hline", "toprule", "midrule", "bottomrule", "cline", "cmidrule",
  "addlinespace", "specialrule", "small", "footnotesize", "scriptsize", "tiny", "normalsize", "large",
  "Large", "LARGE", "huge", "Huge", "selectfont", "fontsize", "setlength", "addtolength", "setcounter",
  "addtocounter", "stepcounter", "refstepcounter", "newcommand", "renewcommand", "providecommand",
  "DeclareMathOperator", "newtheorem", "theoremstyle", "usepackage", "RequirePackage", "documentclass",
  "title", "author", "date", "thanks", "protect", "phantom", "hphantom", "vphantom", "index", "allowbreak",
  "relax", "onehalfspacing", "doublespacing", "singlespacing", "captionsetup", "graphicspath",
  "hypersetup", "definecolor", "newenvironment", "renewenvironment", "sisetup", "geometry",
  "newgeometry", "restoregeometry", "FloatBarrier", "justifying", "sloppy", "fussy", "strut", "null",
  "leavevmode", "arraystretch", "tabcolsep", "extracolsep", "linespread", "setstretch", "nocite",
  "newcounter", "numberwithin", "counterwithin", "counterwithout", "pagenumbering", "setcitestyle",
  "bibliographystyle", "urlstyle", "frenchspacing", "nonfrenchspacing", "par", "global", "makeatletter",
  "makeatother", "hbadness", "vbadness", "tolerance", "emergencystretch", "raggedbottom", "flushbottom",
  "affil", "affiliation", "keywords", "JEL", "jel", "label", "footnotemark", "footnotetext",
  "addcontentsline", "addtocontents", "hyphenation", "selectlanguage", "setmainfont", "setsansfont",
  "boldmath", "unboldmath", "floatplacement", "restylefloat", "newline", "textwidth", "linewidth",
  "columnwidth", "textheight", "paperwidth", "hsize", "vsize", "baselineskip", "parindent", "parskip",
])

// Font switches ({\bf …}, {\em …}) — they apply to the rest of the group.
const declarations: Record<string, [string, string]> = {
  bf: ["<strong>", "</strong>"],
  bfseries: ["<strong>", "</strong>"],
  it: ["<em>", "</em>"],
  itshape: ["<em>", "</em>"],
  em: ["<em>", "</em>"],
  sl: ["<em>", "</em>"],
  slshape: ["<em>", "</em>"],
  sc: ['<span class="smallcaps">', "</span>"],
  scshape: ['<span class="smallcaps">', "</span>"],
  tt: ["<code>", "</code>"],
  ttfamily: ["<code>", "</code>"],
  rm: ["", ""],
  rmfamily: ["", ""],
  sf: ["", ""],
  sffamily: ["", ""],
  normalfont: ["", ""],
  upshape: ["", ""],
  mdseries: ["", ""],
}

// Inline commands whose (last) argument is shown, wrapped in a tag.
const wrappers: Record<string, [string, string]> = {
  emph: ["<em>", "</em>"],
  textit: ["<em>", "</em>"],
  textsl: ["<em>", "</em>"],
  textbf: ["<strong>", "</strong>"],
  texttt: ["<code>", "</code>"],
  textsc: ['<span class="smallcaps">', "</span>"],
  underline: ["<u>", "</u>"],
  uline: ["<u>", "</u>"],
  textsuperscript: ["<sup>", "</sup>"],
  textsubscript: ["<sub>", "</sub>"],
  hl: ["<mark>", "</mark>"],
  enquote: ["“", "”"],
  textup: ["", ""],
  textrm: ["", ""],
  textsf: ["", ""],
  textnormal: ["", ""],
  textmd: ["", ""],
  mbox: ["", ""],
  text: ["", ""],
  hbox: ["", ""],
  makebox: ["", ""],
  fbox: ["", ""],
  framebox: ["", ""],
  textcolor: ["", ""],
  colorbox: ["", ""],
  hyperlink: ["", ""],
  hypertarget: ["", ""],
  foreignlanguage: ["", ""],
  centerline: ["", ""],
  resizebox: ["", ""],
  scalebox: ["", ""],
  rotatebox: ["", ""],
  adjustbox: ["", ""],
  raisebox: ["", ""],
  parbox: ["", ""],
  footnotesize: ["", ""],
  mathrm: ["", ""],
}

const citeMacros = new Set([
  "cite", "citep", "citet", "citealp", "citealt", "parencite", "textcite", "autocite", "Autocite",
  "Cite", "Citep", "Citet", "footcite", "smartcite", "citeauthor", "citeyear", "citeyearpar", "supercite",
])

const refMacros: Record<string, "plain" | "eq" | "auto"> = {
  ref: "plain",
  pageref: "plain",
  nameref: "plain",
  eqref: "eq",
  autoref: "auto",
  cref: "auto",
  Cref: "auto",
  vref: "auto",
  Vref: "auto",
}

const sectionLevels: Record<string, 1 | 2 | 3 | 4> = {
  part: 1,
  chapter: 1,
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
  subparagraph: 4,
}

const defaultTheorems: Record<string, string> = {
  theorem: "Theorem",
  thm: "Theorem",
  lemma: "Lemma",
  lem: "Lemma",
  proposition: "Proposition",
  prop: "Proposition",
  corollary: "Corollary",
  cor: "Corollary",
  definition: "Definition",
  defn: "Definition",
  remark: "Remark",
  rem: "Remark",
  example: "Example",
  assumption: "Assumption",
  hypothesis: "Hypothesis",
  conjecture: "Conjecture",
  claim: "Claim",
  fact: "Fact",
  observation: "Observation",
  condition: "Condition",
  axiom: "Axiom",
  exercise: "Exercise",
  problem: "Problem",
  note: "Note",
}

const kindNames: Record<string, string> = {
  section: "Section",
  figure: "Figure",
  table: "Table",
  equation: "Eq.",
  footnote: "Note",
}

// Math environments and how KaTeX (which only numbers at the top level) is
// asked to draw them. Numbered environments get one \tag per block.
const mathEnvironments: Record<string, { wrap: [string, string] | null; numbered: boolean }> = {
  equation: { wrap: null, numbered: true },
  "equation*": { wrap: null, numbered: false },
  displaymath: { wrap: null, numbered: false },
  math: { wrap: null, numbered: false },
  align: { wrap: ["\\begin{aligned}", "\\end{aligned}"], numbered: true },
  "align*": { wrap: ["\\begin{aligned}", "\\end{aligned}"], numbered: false },
  flalign: { wrap: ["\\begin{aligned}", "\\end{aligned}"], numbered: true },
  "flalign*": { wrap: ["\\begin{aligned}", "\\end{aligned}"], numbered: false },
  alignat: { wrap: ["\\begin{aligned}", "\\end{aligned}"], numbered: true },
  "alignat*": { wrap: ["\\begin{aligned}", "\\end{aligned}"], numbered: false },
  gather: { wrap: ["\\begin{gathered}", "\\end{gathered}"], numbered: true },
  "gather*": { wrap: ["\\begin{gathered}", "\\end{gathered}"], numbered: false },
  multline: { wrap: ["\\begin{gathered}", "\\end{gathered}"], numbered: true },
  "multline*": { wrap: ["\\begin{gathered}", "\\end{gathered}"], numbered: false },
  eqnarray: { wrap: ["\\begin{array}{rcl}", "\\end{array}"], numbered: true },
  "eqnarray*": { wrap: ["\\begin{array}{rcl}", "\\end{array}"], numbered: false },
}

type LabelTarget = { id: string; number: string; kind: string }

type UserMacro = { params: number; optionalDefault: string | null; body: string }

// Environments a float's \caption can sit inside and still caption the float.
const captionContainers = new Set(["center", "threeparttable", "adjustbox", "small", "footnotesize", "scriptsize", "singlespace", "landscape"])

// ---- Renderer ------------------------------------------------------------------

class Renderer {
  warnings = new Set<string>()
  labels = new Map<string, LabelTarget>()
  target: LabelTarget | null = null
  headings: ArticleHeading[] = []
  images: string[] = []
  footnotes: string[] = []
  bibNumbers = new Map<string, number>()
  hasBibliography = false
  usesBibtex = false
  abstractHtml: string | null = null
  titleHtml: string | null = null
  authorsHtml: string[] = []
  dateHtml: string | null = null

  mathMacros: Record<string, string> = {}
  userMacros = new Map<string, UserMacro>()
  theorems = new Map<string, { title: string; counter: string; numbered: boolean }>()

  sectionCounters = [0, 0, 0]
  appendix = false
  figureCount = 0
  tableCount = 0
  equationCount = 0
  theoremCounters = new Map<string, number>()
  anonymousIds = 0
  macroDepth = 0
  // Widths (in % of the text) of the images drawn in the current float, so
  // its caption can be no wider than a single image above it.
  floatImageWidths: number[] | null = null

  warn(message: string) {
    if (this.warnings.size < MAX_WARNINGS) this.warnings.add(message)
  }

  // ---- Definitions (preamble and body): \newcommand, \title, … -------------

  collectDefinitions(nodes: Ast.Node[]) {
    for (const node of nodes) {
      if (node.type === "environment" && envName(node) === "document") {
        this.collectDefinitions(node.content)
        continue
      }
      if (node.type !== "macro") continue
      const name = node.content
      if (name === "newcommand" || name === "renewcommand" || name === "providecommand") {
        const mandatory = mandatoryArgs(node)
        const target = mandatory[0]?.find((n) => n.type === "macro") as Ast.Macro | undefined
        const body = mandatory[mandatory.length - 1]
        if (!target || !body || mandatory.length < 2) continue
        const optional = optionalArgs(node)
        const params = Number.parseInt(rawText(optional[0]), 10)
        const definition = printRaw(body)
        this.userMacros.set(target.content, {
          params: Number.isFinite(params) ? Math.min(params, 9) : 0,
          optionalDefault: optional[1] ? printRaw(optional[1]) : null,
          body: definition,
        })
        this.mathMacros[`\\${target.content}`] = definition
      } else if (name === "DeclareMathOperator") {
        const [target, text] = mandatoryArgs(node)
        const macro = target?.find((n) => n.type === "macro") as Ast.Macro | undefined
        if (!macro || !text) continue
        this.mathMacros[`\\${macro.content}`] = `\\operatorname${starred(node) ? "*" : ""}{${printRaw(text)}}`
      } else if (name === "newtheorem") {
        const [envNodes, titleNodes] = mandatoryArgs(node)
        const env = rawText(envNodes)
        if (!env || !titleNodes) continue
        const [sharedCounter] = optionalArgs(node)
        this.theorems.set(env, {
          title: rawText(titleNodes),
          counter: sharedCounter && rawText(sharedCounter) && !/section|chapter/.test(rawText(sharedCounter))
            ? rawText(sharedCounter)
            : env,
          numbered: !starred(node),
        })
      } else if (name === "title") {
        const [text] = mandatoryArgs(node)
        if (text) this.titleHtml = this.inline(text)
      } else if (name === "author") {
        const [text] = mandatoryArgs(node)
        if (!text) continue
        const people: Ast.Node[][] = [[]]
        for (const part of text) {
          if (part.type === "macro" && part.content === "and") people.push([])
          else people[people.length - 1].push(part)
        }
        this.authorsHtml = people.map((p) => this.inline(p).trim()).filter(Boolean)
      } else if (name === "date") {
        const [text] = mandatoryArgs(node)
        if (text) this.dateHtml = this.inline(text).trim() || null
      }
    }
  }

  // ---- Blocks --------------------------------------------------------------------

  blocks(nodes: Ast.Node[]): string {
    let out = ""
    let pending: Ast.Node[] = []
    const flush = () => {
      const html = this.inline(pending).trim()
      if (html) out += `<p>${html}</p>`
      pending = []
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.type === "parbreak" || (node.type === "macro" && node.content === "par")) {
        flush()
        continue
      }
      if (this.isBlock(node)) {
        flush()
        out += this.block(node)
        continue
      }
      pending.push(node)
    }
    flush()
    return out
  }

  // Like blocks(), but a single paragraph comes back without its <p> (list
  // items, table cells).
  compact(nodes: Ast.Node[]) {
    const html = this.blocks(nodes)
    const single = html.match(/^<p>([\s\S]*)<\/p>$/)
    return single && !single[1].includes("<p>") ? single[1] : html
  }

  isBlock(node: Ast.Node) {
    if (node.type === "environment" || node.type === "mathenv" || node.type === "displaymath") return true
    if (node.type === "verbatim") return true
    if (node.type !== "macro") return false
    const name = node.content
    return (
      name in sectionLevels ||
      name === "includegraphics" ||
      name === "appendix" ||
      name === "bibliography" ||
      name === "printbibliography" ||
      name === "input" ||
      name === "include"
    )
  }

  block(node: Ast.Node): string {
    switch (node.type) {
      case "displaymath":
        return this.displayMath(printRaw(node.content), null)
      case "mathenv":
        return this.mathEnvironment(envName(node), node.content)
      case "verbatim":
        return `<pre><code>${escapeHtml(node.content.replace(/^\n/, ""))}</code></pre>`
      case "environment":
        return this.environment(node)
      case "macro":
        return this.blockMacro(node)
      default:
        return ""
    }
  }

  blockMacro(node: Ast.Macro): string {
    const name = node.content
    if (name in sectionLevels) return this.heading(node, sectionLevels[name])
    if (name === "includegraphics") return `<div class="figure-images">${this.image(node)}</div>`
    if (name === "appendix") {
      this.appendix = true
      this.sectionCounters = [0, 0, 0]
      return ""
    }
    if (name === "bibliography" || name === "printbibliography") {
      this.usesBibtex = true
      this.warn(
        "BibTeX bibliographies (\\bibliography{…}, \\printbibliography) can't be read here — paste the references as a thebibliography environment with \\bibitem entries.",
      )
      return ""
    }
    // \input, \include
    this.warn(`\\${name}{…} can't load other files — paste that file's content into the source instead.`)
    return ""
  }

  heading(node: Ast.Macro, level: 1 | 2 | 3 | 4) {
    const args = mandatoryArgs(node)
    const titleNodes = args[args.length - 1] ?? []
    const html = this.inline(titleNodes).trim()
    if (level === 4) return `<h5 class="runin">${html}</h5>`

    let number: string | null = null
    if (!starred(node) && node.content !== "part") {
      const index = level - 1
      this.sectionCounters[index] += 1
      for (let i = index + 1; i < this.sectionCounters.length; i++) this.sectionCounters[i] = 0
      const parts = this.sectionCounters.slice(0, level).map((n, i) => (i === 0 && this.appendix ? String.fromCharCode(64 + n) : String(n)))
      number = parts.join(".")
    }
    const id = number ? `sec-${number.replace(/\./g, "-")}` : `sec-x${++this.anonymousIds}`
    this.target = { id, number: number ?? "", kind: "section" }
    this.headings.push({ id, number, html, level: level as 1 | 2 | 3 })
    const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4"
    const numberHtml = number ? `<span class="section-number">${escapeHtml(number)}</span>` : ""
    return `<${tag} id="${id}">${numberHtml}${html}</${tag}>`
  }

  // ---- Environments -----------------------------------------------------------

  environment(node: Ast.Environment): string {
    const name = envName(node)
    const base = name.replace(/\*$/, "")
    const content = node.content

    if (name === "document") return this.blocks(content)
    if (name === "abstract") {
      this.abstractHtml = this.blocks(content)
      return ""
    }
    if (base === "itemize" || name === "compactitem" || name === "inparaitem") return this.list(content, "ul")
    if (base === "enumerate" || name === "compactenum" || name === "inparaenum") return this.list(content, "ol")
    if (base === "description" || name === "compactdesc") return this.list(content, "dl")
    if (name === "quote" || name === "quotation" || name === "verse") return `<blockquote>${this.blocks(content)}</blockquote>`
    if (name === "center") return `<div class="center">${this.blocks(content)}</div>`
    if (name === "flushleft" || name === "raggedright") return `<div class="text-left">${this.blocks(content)}</div>`
    if (name === "flushright" || name === "raggedleft") return `<div class="text-right">${this.blocks(content)}</div>`
    if (["figure", "figure*", "wrapfigure", "SCfigure", "sidewaysfigure"].includes(name)) return this.float(node, "figure")
    if (["table", "table*", "sidewaystable", "wraptable"].includes(name)) return this.float(node, "table")
    if (["tabular", "tabular*", "tabularx", "tabulary", "longtable", "supertabular", "xltabular"].includes(name)) {
      return this.tabular(node)
    }
    if (["minipage", "subfigure", "subtable"].includes(name)) return this.subfloat(node)
    if (name === "threeparttable" || name === "subequations") return this.blocks(content)
    if (name === "tablenotes") return `<div class="table-notes">${this.list(content, "ul")}</div>`
    if (["lstlisting", "minted", "Verbatim", "code", "verbatim"].includes(name)) {
      return `<pre><code>${escapeHtml(printRaw(content).replace(/^\n/, ""))}</code></pre>`
    }
    if (name === "thebibliography") return this.bibliography(content)
    if (name === "proof") return this.proof(node)
    if (this.theorems.has(base) || base in defaultTheorems) return this.theorem(node, base, name.endsWith("*"))
    if (name === "comment") return ""
    if (base in mathEnvironments) return this.mathEnvironment(name, content)
    if (
      ![
        "landscape", "adjustbox", "small", "footnotesize", "scriptsize", "singlespace", "onehalfspace",
        "doublespace", "spacing", "titlepage", "otherlanguage", "otherlanguage*", "savenotes", "samepage",
        "appendices", "multicols", "multicols*", "frame", "mdframed", "tcolorbox", "framed", "sloppypar",
      ].includes(name)
    ) {
      this.warn(`The ${name} environment isn't supported; its content is shown as plain text.`)
    }
    return this.blocks(content)
  }

  list(content: Ast.Node[], kind: "ul" | "ol" | "dl") {
    const items: { label: Ast.Node[] | null; content: Ast.Node[] }[] = []
    for (const node of content) {
      if (node.type === "macro" && node.content === "item") {
        const [label] = optionalArgs(node)
        items.push({ label: label ?? null, content: [...attachedBody(node)] })
      } else if (items.length > 0) {
        items[items.length - 1].content.push(node)
      }
    }
    if (kind === "dl") {
      return `<dl>${items
        .map((item) => `<dt>${item.label ? this.inline(item.label) : ""}</dt><dd>${this.compact(item.content)}</dd>`)
        .join("")}</dl>`
    }
    return `<${kind}>${items
      .map((item) =>
        item.label
          ? `<li class="labeled"><span class="item-label">${this.inline(item.label)}</span>${this.compact(item.content)}</li>`
          : `<li>${this.compact(item.content)}</li>`,
      )
      .join("")}</${kind}>`
  }

  // Figures and tables: a numbered float with its caption. Only a caption at
  // the float's own level (not inside a subfigure) numbers it, as in LaTeX.
  float(node: Ast.Environment, kind: "figure" | "table") {
    const { caption, before, after } = this.extractCaption(node.content)
    const previous = this.target
    let number: string | null = null
    let id: string
    if (caption) {
      number = String(kind === "figure" ? ++this.figureCount : ++this.tableCount)
      id = `${kind === "figure" ? "fig" : "tab"}-${number}`
    } else {
      id = `${kind === "figure" ? "fig" : "tab"}-x${++this.anonymousIds}`
    }
    this.target = { id, number: number ?? "", kind }
    const outerWidths = this.floatImageWidths
    this.floatImageWidths = []
    const bodyBefore = this.blocks(before)
    const bodyAfter = this.blocks(after)
    const widths = this.floatImageWidths
    this.floatImageWidths = outerWidths
    const captionStyle =
      kind === "figure" && widths.length === 1 && widths[0] < 90 ? ` style="max-width:${Math.max(widths[0], 45)}%"` : ""
    const captionHtml = caption
      ? `<figcaption${captionStyle}>${this.caption(caption, `${kind === "figure" ? "Figure" : "Table"} ${number}.`)}</figcaption>`
      : ""
    this.target = previous
    // In the order written: usually the image then its caption, and a
    // table's caption above it.
    return `<figure class="float float-${kind}" id="${id}">${bodyBefore}${captionHtml}${bodyAfter}</figure>`
  }

  // The whole \caption{…} as one element, in its written order: the label
  // and caption text, then — after a \\ line break, if there is one —
  // the rest as a smaller italic line (typically "Source: …").
  caption(nodes: Ast.Node[], label: string) {
    const breakAt = nodes.findIndex(
      (node) => node.type === "macro" && (node.content === "\\" || node.content === "newline" || node.content === "linebreak"),
    )
    const main = breakAt === -1 ? nodes : nodes.slice(0, breakAt)
    const after = breakAt === -1 ? [] : nodes.slice(breakAt + 1)
    let html = `<span class="caption-label">${escapeHtml(label)}</span> ${this.inline(main).trim()}`
    const afterHtml = this.inline(after).trim()
    if (afterHtml) html += `<br><span class="caption-note">${afterHtml}</span>`
    return html
  }

  // Takes a float's \caption out of its content, remembering where it was
  // written: `before` and `after` are the content on either side, so the
  // caption renders in its written place. `rest` is both together.
  extractCaption(nodes: Ast.Node[]): { caption: Ast.Node[] | null; before: Ast.Node[]; after: Ast.Node[]; rest: Ast.Node[] } {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.type === "macro" && node.content === "caption") {
        const args = mandatoryArgs(node)
        const before = nodes.slice(0, i)
        const after = nodes.slice(i + 1)
        return { caption: args[args.length - 1] ?? [], before, after, rest: [...before, ...after] }
      }
      if (node.type === "environment" && captionContainers.has(envName(node))) {
        const inner = this.extractCaption(node.content)
        if (inner.caption) {
          // A caption inside \begin{center}… or a threeparttable: that
          // block is split around the caption.
          const before = [...nodes.slice(0, i), { ...node, content: inner.before }]
          const after = [{ ...node, content: inner.after }, ...nodes.slice(i + 1)]
          return { caption: inner.caption, before, after, rest: [...before, ...after] }
        }
      }
    }
    return { caption: null, before: nodes, after: [], rest: nodes }
  }

  subfloat(node: Ast.Environment) {
    let content = node.content
    let widthArg = mandatoryArgs(node).map(rawText).find((t) => /(line|text|column)width/.test(t))
    if (!widthArg) {
      // subfigure's {width} isn't attached by the parser: take a leading
      // [pos] and {width} off the content.
      const leading = leadingOptional(content)
      let rest = leading.optional ? leading.rest : content
      let i = 0
      while (i < rest.length && isWhitespace(rest[i])) i++
      if (rest[i]?.type === "group") {
        widthArg = rawText((rest[i] as Ast.Group).content)
        rest = rest.slice(i + 1)
        content = rest
      }
    }
    const { caption, rest } = this.extractCaption(content)
    const width = widthArg ? relativeWidth(widthArg) : null
    const style = width ? ` style="flex-basis:${width}%"` : ""
    const captionHtml = caption ? `<figcaption>${this.inline(caption).trim()}</figcaption>` : ""
    return `<div class="subfloat"${style}>${this.blocks(rest)}${captionHtml}</div>`
  }

  tabular(node: Ast.Environment) {
    const specs = mandatoryArgs(node)
    const aligns = parseColumnSpec(rawText(specs[specs.length - 1]))
    type Row = { nodes: Ast.Node[]; ruleBefore: boolean }
    const rows: Row[] = [{ nodes: [], ruleBefore: false }]
    const content = node.content
    for (let i = 0; i < content.length; i++) {
      const n = content[i]
      if (n.type === "macro" && (n.content === "\\" || n.content === "tabularnewline")) {
        rows.push({ nodes: [], ruleBefore: false })
        continue
      }
      if (n.type === "macro" && ["hline", "toprule", "midrule", "bottomrule", "cline", "cmidrule", "specialrule", "addlinespace", "hdashline"].includes(n.content)) {
        rows[rows.length - 1].ruleBefore = rows[rows.length - 1].ruleBefore || n.content !== "addlinespace"
        // \cmidrule(lr){2-3}: the trim spec and column range aren't attached
        // as arguments; skip them.
        let j = i + 1
        if (content[j]?.type === "string" && (content[j] as Ast.String).content === "(") {
          while (j < content.length && !(content[j].type === "string" && (content[j] as Ast.String).content === ")")) j++
          j++
        }
        if (content[j]?.type === "group" && !n.args?.length) j++
        i = j - 1
        continue
      }
      rows[rows.length - 1].nodes.push(n)
    }
    const meaningful = rows.filter((row) => row.nodes.some((n) => !isWhitespace(n)))
    // A rule right after the first row marks it as the header.
    const firstIndex = rows.indexOf(meaningful[0])
    const header = meaningful.length > 1 && rows[firstIndex + 1]?.ruleBefore && rows.indexOf(meaningful[1]) === firstIndex + 1

    const renderRow = (row: Row, cellTag: "td" | "th") => {
      const cells: Ast.Node[][] = [[]]
      for (const n of row.nodes) {
        if (n.type === "string" && n.content === "&") cells.push([])
        else cells[cells.length - 1].push(n)
      }
      let column = 0
      const html = cells
        .map((cell) => {
          const trimmed = trimNodes(cell)
          const multi = trimmed.length === 1 && trimmed[0].type === "macro" && trimmed[0].content === "multicolumn" ? (trimmed[0] as Ast.Macro) : null
          let span = 1
          let align = aligns[column] ?? "left"
          let body = trimmed
          if (multi) {
            const [count, spec, text] = mandatoryArgs(multi)
            span = Math.max(1, Math.min(50, Number.parseInt(rawText(count), 10) || 1))
            align = parseColumnSpec(rawText(spec))[0] ?? align
            body = text ?? []
          }
          if (body.length === 1 && body[0].type === "macro" && body[0].content === "multirow") {
            const args = mandatoryArgs(body[0] as Ast.Macro)
            body = args[args.length - 1] ?? []
          }
          column += span
          const attrs = `${span > 1 ? ` colspan="${span}"` : ""}${align !== "left" ? ` class="align-${align}"` : ""}`
          return `<${cellTag}${attrs}>${this.compact(body)}</${cellTag}>`
        })
        .join("")
      return `<tr>${html}</tr>`
    }

    const head = header ? `<thead>${renderRow(meaningful[0], "th")}</thead>` : ""
    const bodyRows = (header ? meaningful.slice(1) : meaningful).map((row) => renderRow(row, "td")).join("")
    return `<div class="table-wrap"><table>${head}<tbody>${bodyRows}</tbody></table></div>`
  }

  bibliography(content: Ast.Node[]) {
    this.hasBibliography = true
    const entries: { key: string; nodes: Ast.Node[] }[] = []
    for (const node of content) {
      if (node.type === "macro" && node.content === "bibitem") {
        const [key] = mandatoryArgs(node)
        entries.push({ key: rawText(key), nodes: [...attachedBody(node)] })
      } else if (entries.length > 0) {
        entries[entries.length - 1].nodes.push(node)
      }
    }
    entries.forEach((entry, index) => this.bibNumbers.set(entry.key, index + 1))
    this.headings.push({ id: "references", number: null, html: "References", level: 1 })
    return `<section class="references" id="references"><h2>References</h2><ol>${entries
      .map((entry, index) => `<li id="ref-${index + 1}">${this.compact(entry.nodes)}</li>`)
      .join("")}</ol></section>`
  }

  theorem(node: Ast.Environment, base: string, star: boolean) {
    const definition = this.theorems.get(base) ?? { title: defaultTheorems[base], counter: base, numbered: true }
    const leading = leadingOptional(node.content)
    const name = optionalArgs(node)[0] ?? leading.optional
    let number: string | null = null
    if (definition.numbered && !star) {
      const next = (this.theoremCounters.get(definition.counter) ?? 0) + 1
      this.theoremCounters.set(definition.counter, next)
      number = String(next)
    }
    const id = `${base}-${number ?? `x${++this.anonymousIds}`}`
    const previous = this.target
    this.target = { id, number: number ?? "", kind: definition.title }
    const title = `${escapeHtml(definition.title)}${number ? ` ${number}` : ""}`
    const extra = name ? ` (${this.inline(name).trim()})` : ""
    const body = this.blocks(leading.optional ? leading.rest : node.content)
    this.target = previous
    return `<div class="theorem" id="${id}"><p class="theorem-head"><strong>${title}</strong>${extra}.</p>${body}</div>`
  }

  proof(node: Ast.Environment) {
    const leading = leadingOptional(node.content)
    const name = optionalArgs(node)[0] ?? leading.optional
    const head = name ? this.inline(name).trim() : "Proof"
    return `<div class="proof"><p class="proof-head"><em>${head}.</em></p>${this.blocks(leading.optional ? leading.rest : node.content)}<span class="qed" aria-hidden="true">∎</span></div>`
  }

  // ---- Maths --------------------------------------------------------------------

  mathEnvironment(name: string, content: Ast.Node[]) {
    const info = mathEnvironments[name] ?? { wrap: null, numbered: false }
    let tex = printRaw(content)
    const labels: string[] = []
    tex = tex.replace(/\\label\s*\{([^}]*)\}/g, (_, key: string) => {
      labels.push(key.trim())
      return ""
    })
    const rows = tex.split(/\\\\/)
    const unnumberedRows = rows.filter((row) => /\\(nonumber|notag)\b/.test(row)).length
    tex = tex.replace(/\\(nonumber|notag)\b/g, "")
    const numbered = info.numbered && unnumberedRows < rows.length
    if (info.wrap) tex = `${info.wrap[0]}${tex}${info.wrap[1]}`
    return this.displayMath(tex, numbered ? labels : null)
  }

  // A display formula; `labels` non-null means it's numbered.
  displayMath(tex: string, labels: string[] | null) {
    let body = tex.replace(/\\label\s*\{([^}]*)\}/g, (_, key: string) => {
      if (labels) labels.push(key.trim())
      return ""
    })
    let id = ""
    if (labels) {
      const number = String(++this.equationCount)
      id = `eq-${number}`
      for (const key of labels) this.labels.set(key, { id, number, kind: "equation" })
      if (!/\\tag\*?\s*\{/.test(body)) body = `${body}\\tag{${number}}`
    }
    return `<div class="math-display"${id ? ` id="${id}"` : ""}>${this.math(body, true)}</div>`
  }

  math(tex: string, display: boolean) {
    const options = {
      displayMode: display,
      throwOnError: true,
      strict: "ignore" as const,
      trust: false,
      output: "htmlAndMathml" as const,
      macros: { ...this.mathMacros },
      maxExpand: 500,
    }
    try {
      return katex.renderToString(tex, options)
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^KaTeX parse error:\s*/, "") : String(error)
      this.warn(`A formula couldn't be typeset (${message.slice(0, 140)}).`)
      return katex.renderToString(tex, { ...options, macros: { ...this.mathMacros }, throwOnError: false })
    }
  }

  // ---- Inline content -----------------------------------------------------------

  inline(nodes: Ast.Node[]): string {
    let out = ""
    let text = ""
    const flush = () => {
      if (text) out += escapeHtml(typography(text))
      text = ""
    }
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      switch (node.type) {
        case "string":
          text += node.content
          break
        case "whitespace":
          text += " "
          break
        case "parbreak":
          text += " "
          break
        case "comment":
          break
        case "inlinemath":
          flush()
          out += this.math(printRaw(node.content), false)
          break
        case "displaymath":
        case "mathenv":
        case "verbatim":
        case "environment":
          flush()
          out += this.block(node)
          break
        case "verb":
          flush()
          out += `<code>${escapeHtml(node.content)}</code>`
          break
        case "group": {
          flush()
          out += this.group(node.content)
          break
        }
        case "macro": {
          flush()
          const result = this.macro(node, nodes, i)
          out += result.html
          i = result.next
          break
        }
        default:
          break
      }
    }
    flush()
    return out
  }

  // {\bf text}: a declaration applies to the rest of its group.
  group(content: Ast.Node[]) {
    return this.inline(content)
  }

  // Arguments for commands the parser doesn't know the signature of: the
  // groups that follow them (\textcite{key}, user macros).
  takeGroups(nodes: Ast.Node[], index: number, count: number) {
    const groups: Ast.Node[][] = []
    const optionals: Ast.Node[][] = []
    let i = index + 1
    // Up to two optional [..] right after the command (\citep[see][p.~2]{key}).
    while (optionals.length < 2 && nodes[i]?.type === "string" && (nodes[i] as Ast.String).content === "[") {
      let j = i + 1
      const inner: Ast.Node[] = []
      while (j < nodes.length && !(nodes[j].type === "string" && (nodes[j] as Ast.String).content === "]")) inner.push(nodes[j++])
      if (j >= nodes.length) break
      optionals.push(inner)
      i = j + 1
    }
    while (groups.length < count && i < nodes.length) {
      const node = nodes[i]
      if (node.type === "group") {
        groups.push(node.content)
        i++
      } else if (node.type === "whitespace" && groups.length === 0) {
        i++
      } else break
    }
    return { groups, optionals, optional: optionals[optionals.length - 1] ?? null, next: i - 1 }
  }

  macro(node: Ast.Macro, siblings: Ast.Node[], index: number): { html: string; next: number } {
    const name = node.content
    const done = (html: string) => ({ html, next: index })

    if (name in symbols) return done(escapeHtml(symbols[name]))
    if (name === "\\") return done("<br>")
    if (name === "today") {
      return done(escapeHtml(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })))
    }

    if (name in combiningAccents) {
      let target = ""
      let next = index
      const [argument] = mandatoryArgs(node)
      if (argument) target = rawText(argument).replace(/^\\([ij])$/, "$1")
      else {
        const after = siblings[index + 1]
        if (after?.type === "group") {
          target = rawText(after.content).replace(/^\\([ij])$/, "$1")
          next = index + 1
        } else if (after?.type === "string") {
          target = after.content.charAt(0)
          const remainder = after.content.slice(1)
          // Keep the rest of the string for the caller.
          siblings[index + 1] = { ...after, content: remainder }
        } else if (after?.type === "macro" && (after.content === "i" || after.content === "j")) {
          target = after.content
          next = index + 1
        }
      }
      const accented = target ? `${target.charAt(0)}${combiningAccents[name]}${target.slice(1)}`.normalize("NFC") : ""
      return { html: escapeHtml(accented), next }
    }

    if (name in declarations) {
      const [open, close] = declarations[name]
      const rest = this.inline(siblings.slice(index + 1))
      return { html: `${open}${rest}${close}`, next: siblings.length }
    }

    if (name in wrappers) {
      const args = mandatoryArgs(node)
      let body = args[args.length - 1]
      let next = index
      if (!body) {
        const taken = this.takeGroups(siblings, index, name === "textcolor" || name === "colorbox" || name === "foreignlanguage" || name === "hyperlink" || name === "hypertarget" ? 2 : 1)
        body = taken.groups[taken.groups.length - 1]
        next = taken.next
      }
      const [open, close] = wrappers[name]
      return { html: `${open}${this.inline(body ?? [])}${close}`, next }
    }

    if (name === "href") {
      const [url, text] = mandatoryArgs(node)
      return done(this.link(rawText(url), text ? this.inline(text) : null))
    }
    if (name === "url" || name === "nolinkurl") {
      const [url] = mandatoryArgs(node)
      const href = rawText(url)
      return done(name === "url" ? this.link(href, null) : `<span class="url">${escapeHtml(href)}</span>`)
    }

    if (name in refMacros) {
      let [keys] = mandatoryArgs(node)
      let next = index
      if (!keys) {
        const taken = this.takeGroups(siblings, index, 1)
        keys = taken.groups[0]
        next = taken.next
      }
      const encoded = rawText(keys)
        .split(",")
        .map((key) => encodeURIComponent(key.trim()))
        .filter(Boolean)
        .join(",")
      const capital = name === "Cref" || name === "Vref"
      return { html: `\u0000REF:${refMacros[name]}${capital ? "C" : ""}:${encoded}\u0000`, next }
    }

    if (citeMacros.has(name)) {
      let keys = mandatoryArgs(node)[0]
      let notes = optionalArgs(node)
      let next = index
      if (!keys) {
        const taken = this.takeGroups(siblings, index, 1)
        keys = taken.groups[0]
        notes = taken.optionals
        next = taken.next
      }
      // One optional argument is a note after the reference (p.~3); two are
      // a prefix and a suffix (natbib: [see][p.~3]).
      const prefix = notes.length > 1 ? this.inline(notes[0]).trim() : ""
      const note = notes.length ? this.inline(notes[notes.length - 1]).trim() : ""
      const encoded = rawText(keys)
        .split(",")
        .map((key) => encodeURIComponent(key.trim()))
        .filter(Boolean)
        .join(",")
      return { html: `\u0000CITE:${encoded}|${encodeURIComponent(prefix)}|${encodeURIComponent(note)}\u0000`, next }
    }

    if (name === "footnote") {
      const args = mandatoryArgs(node)
      const body = args[args.length - 1] ?? []
      const number = this.footnotes.length + 1
      this.footnotes.push("")
      this.footnotes[number - 1] = this.inline(body).trim()
      return done(`<sup class="footnote-ref"><a href="#fn-${number}" id="fnref-${number}">${number}</a></sup>`)
    }

    if (name === "label") {
      const [key] = mandatoryArgs(node)
      const label = rawText(key)
      if (!label) return done("")
      if (this.target) {
        this.labels.set(label, this.target)
        return done("")
      }
      const id = `label-${++this.anonymousIds}`
      this.labels.set(label, { id, number: "", kind: "label" })
      return done(`<span id="${id}"></span>`)
    }

    if (name === "includegraphics") return done(this.image(node))
    if (name === "caption") {
      const args = mandatoryArgs(node)
      return done(`<span class="inline-caption">${this.inline(args[args.length - 1] ?? [])}</span>`)
    }
    if (name === "item") return done("")
    if (name in sectionLevels || name === "appendix") return done(this.blockMacro(node))

    if (this.userMacros.has(name)) return this.expand(node, siblings, index)

    if (ignoredMacros.has(name)) return done("")

    // Unknown: show the text of its arguments.
    const args = mandatoryArgs(node)
    this.warn(`\\${name} isn't supported, so it was left out${args.length ? " (its text is shown)" : ""}.`)
    return done(args.map((arg) => this.inline(arg)).join(" "))
  }

  expand(node: Ast.Macro, siblings: Ast.Node[], index: number) {
    const macro = this.userMacros.get(node.content)!
    if (this.macroDepth >= MAX_MACRO_DEPTH) {
      this.warn(`\\${node.content} expands into itself too many times.`)
      return { html: "", next: index }
    }
    const attached = mandatoryArgs(node)
    let args: string[] = attached.map((arg) => printRaw(arg))
    let next = index
    if (args.length < macro.params) {
      const needed = macro.params - args.length - (macro.optionalDefault !== null ? 1 : 0)
      const taken = this.takeGroups(siblings, index, Math.max(0, needed))
      const groups = taken.groups.map((g) => printRaw(g))
      args = macro.optionalDefault !== null ? [taken.optional ? printRaw(taken.optional) : macro.optionalDefault, ...groups] : groups
      next = taken.next
    }
    const source = macro.body.replace(/#(\d)/g, (_, n: string) => args[Number(n) - 1] ?? "")
    this.macroDepth += 1
    try {
      return { html: this.inline(parse(source).content), next }
    } finally {
      this.macroDepth -= 1
    }
  }

  link(href: string, textHtml: string | null) {
    const safe = /^(https?:\/\/|mailto:)[^\s"<>]+$/i.test(href) || /^#[\w-]+$/.test(href) ? href : null
    const text = textHtml ?? `<span class="url">${escapeHtml(href)}</span>`
    if (!safe) return text
    const external = /^https?:/i.test(safe)
    return `<a href="${escapeAttr(safe)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`
  }

  image(node: Ast.Macro) {
    const [path] = mandatoryArgs(node)
    const [options] = optionalArgs(node)
    const source = rawText(path)
    const src = resolveImage(source)
    if (!src) {
      this.warn(`Image “${source}” hasn't been uploaded yet — upload an image with the same file name to link it.`)
      return `<span class="missing-image">Image not uploaded yet: ${escapeHtml(source)}</span>`
    }
    this.images.push(src)
    const width = options ? relativeWidth(rawText(options)) : null
    this.floatImageWidths?.push(width ?? 100)
    const style = width ? ` style="width:${width}%"` : ""
    return `<img src="${escapeAttr(src)}" alt="" loading="lazy"${style}>`
  }

  // ---- Cross references (resolved once the whole document is read) --------

  resolve(html: string) {
    return html
      .replace(/\u0000REF:(plain|eq|auto)(C?):([^\u0000]*)\u0000/g, (_, kind: string, _capital: string, keys: string) => {
        const parts = keys
          .split(",")
          .filter(Boolean)
          .map((encoded) => {
            const key = decodeURIComponent(encoded)
            const target = this.labels.get(key)
            if (!target) {
              this.warn(`A reference points to “${key}”, which has no \\label.`)
              return `<span class="ref-missing">??</span>`
            }
            let text = target.number || "→"
            if (kind === "eq") text = `(${target.number})`
            if (kind === "auto") {
              const noun = kindNames[target.kind] ?? target.kind
              text = `${noun}${target.kind === "equation" ? ` (${target.number})` : ` ${target.number}`}`
            }
            return `<a class="xref" href="#${target.id}">${escapeHtml(text)}</a>`
          })
        return parts.join(", ")
      })
      .replace(/\u0000CITE:([^|\u0000]*)\|([^|\u0000]*)\|([^\u0000]*)\u0000/g, (_, keys: string, prefix: string, note: string) => {
        const items = keys
          .split(",")
          .filter(Boolean)
          .map((encoded) => {
            const key = decodeURIComponent(encoded)
            const number = this.bibNumbers.get(key)
            if (!number) {
              if (this.hasBibliography) this.warn(`\\cite{${key}} has no matching \\bibitem.`)
              else if (!this.usesBibtex) this.warn("Citations need a thebibliography environment with \\bibitem entries to be numbered.")
              return `<span class="cite-missing">${escapeHtml(key)}</span>`
            }
            return `<a class="cite" href="#ref-${number}">${number}</a>`
          })
        const noteText = decodeURIComponent(note)
        const prefixText = decodeURIComponent(prefix)
        return `<span class="citation">[${prefixText ? `${prefixText} ` : ""}${items.join(", ")}${noteText ? `, ${noteText}` : ""}]</span>`
      })
  }

  footnotesHtml() {
    if (this.footnotes.length === 0) return ""
    return `<section class="footnotes" aria-label="Notes"><h2>Notes</h2><ol>${this.footnotes
      .map(
        (note, index) =>
          `<li id="fn-${index + 1}">${note} <a class="footnote-back" href="#fnref-${index + 1}" aria-label="Back to the text">↩</a></li>`,
      )
      .join("")}</ol></section>`
  }
}

// ---- Helpers used by the renderer --------------------------------------------

function trimNodes(nodes: Ast.Node[]) {
  let start = 0
  let end = nodes.length
  while (start < end && isWhitespace(nodes[start])) start++
  while (end > start && isWhitespace(nodes[end - 1])) end--
  return nodes.slice(start, end)
}

// "0.8\linewidth" → 80. Absolute widths (5cm) aren't converted.
function relativeWidth(options: string) {
  const match = options.match(/(?:^|[,\s])(?:width\s*=\s*)?([\d.]*)\s*\\(?:linewidth|textwidth|columnwidth|hsize)/)
  if (!match) return null
  const factor = match[1] === "" ? 1 : Number.parseFloat(match[1])
  if (!Number.isFinite(factor) || factor <= 0) return null
  return Math.round(Math.min(1, factor) * 1000) / 10
}

function parseColumnSpec(spec: string): ("left" | "center" | "right")[] {
  const out: ("left" | "center" | "right")[] = []
  let i = 0
  const skipGroup = () => {
    if (spec[i] !== "{") return ""
    let depth = 0
    const start = i
    for (; i < spec.length; i++) {
      if (spec[i] === "{") depth++
      else if (spec[i] === "}") {
        depth--
        if (depth === 0) {
          i++
          break
        }
      }
    }
    return spec.slice(start + 1, i - 1)
  }
  while (i < spec.length) {
    const char = spec[i++]
    if (char === "l") out.push("left")
    else if (char === "c") out.push("center")
    else if (char === "r" || char === "S") out.push("right")
    else if ("pmbXLCRJ".includes(char)) {
      out.push(char === "C" ? "center" : char === "R" ? "right" : "left")
      if (spec[i] === "{") skipGroup()
    } else if ("@!><".includes(char)) {
      if (spec[i] === "{") skipGroup()
    } else if (char === "*") {
      const count = Number.parseInt(skipGroup(), 10)
      const inner = skipGroup()
      if (Number.isFinite(count)) for (let k = 0; k < Math.min(count, 50); k++) out.push(...parseColumnSpec(inner))
    }
  }
  return out
}

// Where an \includegraphics path can point: an image uploaded through the
// editor (/api/files/<key>), or an https image. Anything else (a local file
// name from the paper's folder) isn't available until it's uploaded.
export function resolveImage(path: string): string | null {
  const trimmed = path.trim()
  if (trimmed.startsWith("/api/files/")) {
    const key = decodeURIComponent(trimmed.slice("/api/files/".length).split(/[?#]/)[0])
    return isStorageKey(key) ? `/api/files/${encodeURIComponent(key)}` : null
  }
  if (/^https:\/\/[^\s"'<>\\]+$/.test(trimmed)) return trimmed
  return null
}

// Storage keys of the uploaded images a source refers to (for the save
// action's checks).
export function uploadedImageKeys(source: string): string[] {
  const keys = new Set<string>()
  for (const match of source.matchAll(/\/api\/files\/([^\s}?#]+)/g)) {
    keys.add(decodeURIComponent(match[1]))
  }
  return [...keys]
}

export function renderLatexArticle(source: string): RenderedArticle {
  const clean = source.replace(/\u0000/g, "").slice(0, MAX_SOURCE_CHARS)
  const renderer = new Renderer()
  let ast: Ast.Root
  try {
    ast = parse(clean)
  } catch (error) {
    return {
      html: `<p class="render-error">This LaTeX source couldn't be read.</p>`,
      abstractHtml: null,
      titleHtml: null,
      authorsHtml: [],
      dateHtml: null,
      headings: [],
      images: [],
      warnings: [`The LaTeX couldn't be read: ${error instanceof Error ? error.message : String(error)}`],
    }
  }

  const document = findDocument(ast.content)
  renderer.collectDefinitions(ast.content)
  const body = document ? document.content : ast.content
  const bodyHtml = renderer.blocks(body)
  const html = renderer.resolve(bodyHtml + renderer.footnotesHtml())
  const abstractHtml = renderer.abstractHtml ? renderer.resolve(renderer.abstractHtml) : null

  return {
    html,
    abstractHtml,
    titleHtml: renderer.titleHtml,
    authorsHtml: renderer.authorsHtml,
    dateHtml: renderer.dateHtml,
    headings: renderer.headings,
    images: renderer.images,
    warnings: [...renderer.warnings],
  }
}

function findDocument(nodes: Ast.Node[]): Ast.Environment | null {
  for (const node of nodes) {
    if (node.type === "environment" && envName(node) === "document") return node
  }
  return null
}

