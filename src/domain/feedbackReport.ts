// A Report from the Feedback sheet and the GitHub issue it becomes (ADR 0081, spec 0698). The Worker validates and
// builds the issue from it (ticket 0699); the sheet builds the same Markdown for Copy report (ticket 0700). Pure, with
// no imports, so the Worker's own build can take it.

/** The three Reports the Feedback sheet sends, each with its own fields (glossary: Report kind). */
export type ReportKind = 'general' | 'translation' | 'bead-color'

interface ReportFieldsByKind {
  general: { message: string }
  translation: { language: string; shown: string; shouldSay: string; note: string }
  'bead-color': {
    problem: 'wrong' | 'missing'
    brand: string
    catalog: string
    code: string
    looksLike: string
    note: string
  }
}

/** What the app attaches and shows in the sheet's Also sent block; never the Project or the device id (spec 0698). */
export interface ReportContext {
  appVersion: string
  uiLanguage: string
  browser: string
  os: string
  viewport: string
  /** A translation Report's language. */
  language?: string
  /** A bead-color Report's prefill: the Brand, catalog id, code, stored hex and Swatch letter. */
  brand?: string
  catalog?: string
  code?: string
  hex?: string
  swatchLetter?: string
}

/** One Report: its kind, the person's fields, the context, and an optional email. */
export type Report = {
  [K in ReportKind]: { kind: K; fields: ReportFieldsByKind[K]; context: ReportContext; email?: string }
}[ReportKind]

/** How sending a Report ended, as the Feedback sheet tells it (spec 0698): sent, or why not, with the wait the Worker
 * asked for (`Retry-After`) where it gave one. */
export type ReportSent =
  | { sent: true }
  | { sent: false; reason: 'off' | 'rate-limited'; retryAfterSeconds: number }
  | { sent: false; reason: 'offline' | 'failed' }

/** The issue a Report becomes; the Worker adds `dev` to the labels on the dev Worker. */
interface ReportIssue {
  title: string
  labels: string[]
  body: string
}

/** Message and Note are free text; every other field and context value is one short line (spec 0698). */
export const NOTE_MAX = 2000
export const FIELD_MAX = 200

/** Each kind's fields, whether a Report needs it, and its length limit. */
const FIELDS: { [K in ReportKind]: Array<{ key: keyof ReportFieldsByKind[K]; required: boolean; max: number }> } = {
  general: [{ key: 'message', required: true, max: NOTE_MAX }],
  translation: [
    { key: 'language', required: true, max: FIELD_MAX },
    { key: 'shown', required: true, max: FIELD_MAX },
    { key: 'shouldSay', required: false, max: FIELD_MAX },
    { key: 'note', required: false, max: NOTE_MAX },
  ],
  'bead-color': [
    { key: 'problem', required: true, max: FIELD_MAX },
    { key: 'brand', required: true, max: FIELD_MAX },
    { key: 'catalog', required: true, max: FIELD_MAX },
    { key: 'code', required: false, max: FIELD_MAX },
    { key: 'looksLike', required: false, max: FIELD_MAX },
    { key: 'note', required: false, max: NOTE_MAX },
  ],
}

/** The context's rows in table order, with their label; the required ones every Report has. */
const CONTEXT_ROWS: Array<{ key: keyof ReportContext; label: string; required?: boolean }> = [
  { key: 'appVersion', label: 'App version', required: true },
  { key: 'uiLanguage', label: 'UI language', required: true },
  { key: 'browser', label: 'Browser', required: true },
  { key: 'os', label: 'OS', required: true },
  { key: 'viewport', label: 'Viewport', required: true },
  { key: 'language', label: 'Language' },
  { key: 'brand', label: 'Brand' },
  { key: 'catalog', label: 'Catalog' },
  { key: 'code', label: 'Code' },
  { key: 'hex', label: 'Stored hex' },
  { key: 'swatchLetter', label: 'Swatch letter' },
]
export const EMAIL_MAX = 320
const PROBLEMS = { wrong: 'Wrong color', missing: 'Missing color' }
/** Each kind's label beside `from-app`, which is also the first word of its title. */
const KIND_LABEL: Record<ReportKind, string> = { general: 'feedback', translation: 'translation', 'bead-color': 'bead-color' }
const TITLE_TEXT_MAX = 60

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function onlyKeys(record: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key))
}

/** Whether `text` is shaped as an email: something, an @, a domain with a dot. */
export function isEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

/** An optional string: absent is empty; anything but a string within `max` is refused (undefined). */
function text(value: unknown, max: number): string | undefined {
  if (value === undefined) return ''
  return typeof value === 'string' && value.length <= max ? value : undefined
}

/** The Report in `value`, or null when it isn't one: an unknown kind or key, a required field empty, a field past its
 * length, an email not shaped as one. The Worker refuses such a body `400`; it never takes a title or labels. */
export function parseReport(value: unknown): Report | null {
  if (!isRecord(value) || !onlyKeys(value, ['kind', 'fields', 'context', 'email'])) return null
  const { kind, fields, context, email } = value
  if (typeof kind !== 'string' || !Object.hasOwn(FIELDS, kind) || !isRecord(fields) || !isRecord(context)) return null
  const specs = FIELDS[kind as ReportKind] as Array<{ key: string; required: boolean; max: number }>
  if (!onlyKeys(fields, specs.map((spec) => spec.key))) return null
  const parsedFields: Record<string, string> = {}
  for (const spec of specs) {
    const field = text(fields[spec.key], spec.max)
    if (field === undefined || (spec.required && field.trim() === '')) return null
    parsedFields[spec.key] = field
  }
  if (kind === 'bead-color' && !Object.hasOwn(PROBLEMS, parsedFields.problem)) return null
  if (!onlyKeys(context, CONTEXT_ROWS.map((row) => row.key))) return null
  const parsedContext: Record<string, string> = {}
  for (const { key, required } of CONTEXT_ROWS) {
    if (context[key] === undefined && !required) continue
    const row = typeof context[key] === 'string' ? text(context[key], FIELD_MAX) : undefined
    if (row === undefined) return null
    parsedContext[key] = row
  }
  const parsedEmail = text(email, EMAIL_MAX)
  if (parsedEmail === undefined || (parsedEmail !== '' && !isEmail(parsedEmail))) return null
  return {
    kind,
    fields: parsedFields,
    context: parsedContext,
    ...(parsedEmail ? { email: parsedEmail } : {}),
  } as unknown as Report
}

/** `text` on one line, at most 60 characters, cut after its last whole word with an ellipsis. */
function firstWords(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length <= TITLE_TEXT_MAX) return line
  const cut = line.slice(0, TITLE_TEXT_MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function titleOf(report: Report): string {
  switch (report.kind) {
    case 'general':
      return `feedback: ${firstWords(report.fields.message)}`
    case 'translation':
      return `translation [${report.fields.language.trim()}]: ${firstWords(report.fields.shown)}`
    case 'bead-color': {
      const where = [report.fields.catalog, report.fields.code].map((part) => part.trim()).filter(Boolean).join(' ')
      return `bead-color [${where}]: ${report.fields.problem} color`
    }
  }
}

/** The person's fields as headings in the kind's order; an optional field left empty has none. */
function fieldSections(report: Report): string[] {
  const sections: Array<[string, string]> =
    report.kind === 'general'
      ? [['Message', report.fields.message]]
      : report.kind === 'translation'
        ? [
            ['Language', report.fields.language],
            ['Text as shown', report.fields.shown],
            ['Should say', report.fields.shouldSay],
            ['Note', report.fields.note],
          ]
        : [
            ['Problem', PROBLEMS[report.fields.problem]],
            ['Brand and catalog', `${report.fields.brand}, ${report.fields.catalog}`],
            ['Code', report.fields.code],
            ['Looks like', report.fields.looksLike],
            ['Note', report.fields.note],
          ]
  return sections.filter(([, value]) => value.trim() !== '').map(([heading, value]) => `### ${heading}\n\n${value}`)
}

/** A value made safe for one table cell: no pipe to end it, no line break to end the row, a backslash kept as one. */
function cell(value: string): string {
  return value.replace(/[\\|]/g, '\\$&').replace(/\s*[\r\n]+\s*/g, ' ')
}

/** The issue a Report becomes (glossary: Report): titled and labelled by kind, the person's fields as headings, the
 * context as a table, the email last. What the Worker posts and what Copy report copies, so the two never differ. */
export function reportIssue(report: Report): ReportIssue {
  const context = report.context as unknown as Record<string, string | undefined>
  const rows = CONTEXT_ROWS.filter(({ key }) => context[key] !== undefined).map(
    ({ key, label }) => `| ${label} | ${cell(context[key] ?? '')} |`,
  )
  const sections = [...fieldSections(report), ['### Context', '', '| | |', '|---|---|', ...rows].join('\n')]
  if (report.email) sections.push(`### Email\n\n${report.email}`)
  return { title: titleOf(report), labels: ['from-app', KIND_LABEL[report.kind]], body: sections.join('\n\n') }
}
