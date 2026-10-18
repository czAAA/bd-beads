import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { INFO_POPOVERS, UNREACHED } from './hoverExemptions'
import { tooltipMakers } from './hoverSource'
import { LOCALES, WIDTHS } from './textFitMatrix'

// The hover text check's reachability guard (ticket 264): every source place making a Tooltip or info popover must be
// seen open at least once in the run, or be listed in UNREACHED with a reason. Each language-and-width test writes what
// it opened to a file; the Playwright global teardown reads them all.

const DIR = join('test-results', 'hover-opened')

/** What this test opened: component names, and `info:<test id>` for the info popovers. */
export function recordOpened(locale: string, width: number, opened: Set<string>): void {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, `${locale}-${width}.json`), JSON.stringify([...opened]))
}

/** The places the source makes hover text, which a run must have seen open. */
export function requiredSites(): string[] {
  return [...tooltipMakers(), ...INFO_POPOVERS.map((popover) => `info:${popover.testid}`)]
}

/** What the run failed to reach, or the problems with the exemption list, once every test has written its file. Null
 * when only part of the matrix ran (a filtered run), where nothing can be said. */
export function unreached(): string[] | null {
  const expected = LOCALES.flatMap((locale) => WIDTHS.map((width) => `${locale}-${width}.json`))
  let files: string[]
  try {
    files = readdirSync(DIR)
  } catch {
    return null
  }
  if (!expected.every((file) => files.includes(file))) return null
  const opened = new Set(files.flatMap((file) => JSON.parse(readFileSync(join(DIR, file), 'utf8')) as string[]))
  const required = requiredSites()
  const problems = required.filter((site) => !opened.has(site) && !(site in UNREACHED)).map((site) => `${site}: makes a Tooltip that no screen of the hover text check ever opened; add a screen that reaches it in e2e/visual/textFit.spec.ts, or list it in UNREACHED (e2e/support/hoverExemptions.ts) with a reason`)
  for (const site of Object.keys(UNREACHED)) {
    if (!required.includes(site)) problems.push(`${site}: listed in UNREACHED but the source no longer makes a Tooltip there; remove it`)
    else if (opened.has(site)) problems.push(`${site}: listed in UNREACHED but the run opened it; remove it`)
  }
  return problems
}
