// The read-out of app opens (ticket 1209, ADR 0102): `npm run opens -- <dev|production>` prints a Worker's opens per
// day for the last 30 days, per week and per month, new against returning, installed against browser tab, and by
// version. It reads `core` through Wrangler with the maintainer's own login; no token of its own.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** One row of `opens`: a day's count for one combination of a ping's fields. */
export interface OpensRow {
  day: string
  first: number
  since: string
  installed: number
  version: string
  opens: number
}

/** One row of `open_days`: the day's total, past the ceiling by the one ping that was refused. */
export interface DayTotal {
  day: string
  opens: number
}

const DATABASES = { dev: 'bd-beads-dev-core', production: 'bd-beads-core' } as const
type Worker = keyof typeof DATABASES

const DAY_MS = 86_400_000

/** The UTC day `days` before `today`. */
function daysBefore(today: string, days: number): string {
  return new Date(Date.parse(today) - days * DAY_MS).toISOString().slice(0, 10)
}

/** The Monday of a day's ISO week. */
function weekOf(day: string): string {
  const date = new Date(day)
  return daysBefore(day, (date.getUTCDay() + 6) % 7)
}

interface Tally {
  opens: number
  first: number
  installed: number
}

function tally(rows: OpensRow[], key: (row: OpensRow) => string): Map<string, Tally> {
  const out = new Map<string, Tally>()
  for (const row of rows) {
    const held = out.get(key(row)) ?? { opens: 0, first: 0, installed: 0 }
    held.opens += row.opens
    if (row.first) held.first += row.opens
    if (row.installed) held.installed += row.opens
    out.set(key(row), held)
  }
  return out
}

function table(title: string, label: string, groups: Map<string, Tally>, note: (key: string) => string = () => ''): string[] {
  const keys = [...groups.keys()].sort().reverse()
  const width = Math.max(label.length, ...keys.map((key) => key.length))
  const cells = (cols: (string | number)[]) => cols.map((col) => String(col).padStart(9)).join('')
  const lines = [title, `${label.padEnd(width)}${cells(['opens', 'new', 'returning', 'installed', 'tab'])}`]
  for (const key of keys) {
    const { opens, first, installed } = groups.get(key)!
    lines.push(`${key.padEnd(width)}${cells([opens, first, opens - first, installed, opens - installed])}${note(key)}`)
  }
  if (!keys.length) lines.push('(none)')
  return [...lines, '']
}

/** The read-out as text, from every row since a year before `today`. A day whose total is past its rows' sum had a
 * ping refused at the ceiling: its count is known to be junk. */
export function opensReport(worker: Worker, rows: OpensRow[], totals: DayTotal[], today: string): string {
  const counted = tally(rows, (row) => row.day)
  const junk = new Set(totals.filter((total) => total.opens > (counted.get(total.day)?.opens ?? 0)).map((total) => total.day))
  const month = daysBefore(today, 29)
  const recent = rows.filter((row) => row.day >= month)
  const returning = recent.filter((row) => !row.first)
  return [
    `App opens, ${worker} Worker: devices that opened the app on a day, not people. Days are UTC.`,
    '',
    ...table('Per day, last 30 days', 'day', new Map([...counted].filter(([day]) => day >= month)), (day) =>
      junk.has(day) ? '   ceiling reached: junk' : '',
    ),
    ...table(
      'Per week (from Monday), last 12 weeks',
      'week',
      tally(rows.filter((row) => row.day >= weekOf(daysBefore(today, 77))), (row) => weekOf(row.day)),
    ),
    ...table('Per month, last 12 months', 'month', tally(rows, (row) => row.day.slice(0, 7))),
    ...table('By version, last 30 days', 'version', tally(recent, (row) => row.version)),
    ...table('Returning by days since the last open, last 30 days', 'since', tally(returning, (row) => row.since)),
    'A device counts once a day however often it opens the app; one on two browsers is two, and a browser whose',
    'storage was cleared counts as new again. Weeks and months add up days, so a device that came back is in each.',
  ].join('\n')
}

/** One query on the Worker's `core`, through Wrangler with the maintainer's login. */
function query<T>(worker: Worker, sql: string): T[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DATABASES[worker], '--remote', '--env', worker, '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  return (JSON.parse(out) as { results: T[] }[])[0]?.results ?? []
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const worker = process.argv[2]
  if (worker !== 'dev' && worker !== 'production') {
    console.error('Usage: npm run opens -- <dev|production>')
    process.exit(1)
  }
  const today = new Date().toISOString().slice(0, 10)
  // The start is a date this script made, never input, so it is written into the query.
  const since = `${daysBefore(today, 365).slice(0, 7)}-01`
  const rows = query<OpensRow>(worker, `SELECT day, first, since, installed, version, opens FROM opens WHERE day >= '${since}'`)
  const totals = query<DayTotal>(worker, `SELECT day, opens FROM open_days WHERE day >= '${since}'`)
  console.log(opensReport(worker, rows, totals, today))
}
