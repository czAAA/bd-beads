import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import type { Locale } from '../../src/domain/locale'
import { addedColorId } from '../../src/domain/palette'
import type { Project } from '../../src/domain/project'
import { settle } from '../support/app'
import { fixtureProject, STORAGE_KEY, storedLibrary } from '../support/projects'
import type { Area } from './areas'

/** The device states the plan walks (docs/research/ux-audit/00-plan.md §4): an empty device on its first visit, one
 * with the seeded library below, and that one with its offline shell allowed to install. */
export type State = 'fresh' | 'seeded' | 'seeded-offline'

const OUTPUT_ROOT = 'ux-audit-output'
/** How long one step may take before the walk gives up on it and captures the screen as it is. */
const STEP_LIMIT_MS = 60_000
/** How many of a violation's elements axe.json keeps. */
const AXE_NODES_KEPT = 10
const DAY_MS = 86_400_000
/** When the seeded library was last touched: a fixed date, so the walk is the same on every run. */
const SEEDED_AT = Date.UTC(2025, 10, 1)

interface StopRecord {
  stop: string
  file: string
  reached: boolean
  error?: string
}

interface ConsoleRecord {
  stop: string
  type: string
  text: string
}

interface AxeRecord {
  stop: string
  id: string
  impact: string | null | undefined
  help: string
  nodes: number
  elements: { target: string; summary: string }[]
}

function firstLine(error: unknown): string {
  return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)
}

/** One walk: an area on one device in one state. `step` runs an action and records whether it could be done, then
 * `stop` takes the evidence: a screenshot, the console since the last stop, axe-core's violations. */
export class Walk {
  readonly page: Page
  readonly state: State
  readonly device: string
  private readonly dir: string
  private readonly stops: StopRecord[] = []
  private readonly consoleRecords: ConsoleRecord[] = []
  private readonly axeRecords: AxeRecord[] = []
  private current = 'before-first-stop'
  private pendingError: string | undefined

  constructor(page: Page, testInfo: TestInfo, area: Area, state: State) {
    this.page = page
    this.state = state
    this.device = testInfo.project.name
    this.dir = join(OUTPUT_ROOT, area, this.device, state)
    mkdirSync(this.dir, { recursive: true })
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        this.consoleRecords.push({ stop: this.current, type: message.type(), text: message.text() })
      }
    })
    page.on('pageerror', (error) => {
      this.consoleRecords.push({ stop: this.current, type: 'pageerror', text: error.message })
    })
  }

  /** Does what a person would do to reach the next stop; a failure is recorded against that stop, never thrown, so the
   * walk goes on and the screen after the failure is still captured. */
  async step(stop: string, action: () => Promise<void>): Promise<void> {
    this.current = stop
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        action(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`step took longer than ${STEP_LIMIT_MS / 1000}s`)), STEP_LIMIT_MS)
        }),
      ])
    } catch (error) {
      this.pendingError = firstLine(error)
    } finally {
      clearTimeout(timer)
    }
    await this.stop(stop)
  }

  /** Captures the screen as it is now: `<nn>-<stop>.png`, the console since the last stop and axe's violations. */
  async stop(stop: string, options: { fullPage?: boolean } = {}): Promise<void> {
    this.current = stop
    const file = `${String(this.stops.length + 1).padStart(2, '0')}-${stop}.png`
    const record: StopRecord = { stop, file, reached: this.pendingError === undefined }
    if (this.pendingError !== undefined) {
      record.error = this.pendingError
      this.pendingError = undefined
    }
    try {
      await settle(this.page)
      await this.page.screenshot({ path: join(this.dir, file), fullPage: options.fullPage ?? false, animations: 'disabled' })
    } catch (error) {
      record.reached = false
      record.error = `${record.error ? `${record.error}; ` : ''}screenshot: ${firstLine(error)}`
    }
    try {
      const results = await new AxeBuilder({ page: this.page }).analyze()
      for (const violation of results.violations) {
        this.axeRecords.push({
          stop,
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.length,
          elements: violation.nodes.slice(0, AXE_NODES_KEPT).map((node) => ({ target: String(node.target[0] ?? ''), summary: node.failureSummary ?? '' })),
        })
      }
    } catch (error) {
      this.axeRecords.push({ stop, id: 'axe-failed', impact: null, help: firstLine(error), nodes: 0, elements: [] })
    }
    this.stops.push(record)
    // After every stop, so a walk the runner kills still leaves what it saw.
    this.write()
  }

  private write(): void {
    writeFileSync(join(this.dir, 'stops.json'), JSON.stringify(this.stops, null, 2))
    writeFileSync(join(this.dir, 'console.json'), JSON.stringify(this.consoleRecords, null, 2))
    writeFileSync(join(this.dir, 'axe.json'), JSON.stringify(this.axeRecords, null, 2))
  }
}

/** The plan's seeded library (§4): Projects of each Technique, one large, one with a Frame and Row progress half
 * done, one with a long name, one with Custom colors added, one blank. The small peyote Project is the newest, so it
 * opens. */
function seededLibrary(): Project[] {
  const named = (project: Project, id: string, name: string, daysAgo: number, palette = project.palette): Project => {
    const [canvas, ...frames] = project.layers
    const updatedAt = SEEDED_AT - daysAgo * DAY_MS
    return { ...project, id, palette, updatedAt, createdAt: updatedAt - DAY_MS, layers: [{ ...canvas, name }, ...frames] }
  }
  const bracelet = fixtureProject({ technique: 'peyote', columns: 24, rows: 14 })
  return [
    named(bracelet, 'seed-summer', 'Summer bracelet', 0),
    named(fixtureProject({ technique: 'loom', columns: 16, rows: 10, rowProgress: { currentRow: 5 } }), 'seed-cuff', 'Loom cuff', 1),
    named(fixtureProject({ technique: 'brick', columns: 20, rows: 12 }), 'seed-pendant', 'Brick pendant', 2),
    named(fixtureProject({ technique: 'loom', columns: 300, rows: 120 }), 'seed-tapestry', 'Wide tapestry', 3),
    named(
      fixtureProject({ technique: 'brick', columns: 14, rows: 9 }),
      'seed-long-name',
      'A very long Project name that a maker might really type for a piece made as a present',
      4,
    ),
    named(fixtureProject({ technique: 'peyote', columns: 18, rows: 10 }), 'seed-custom', 'Custom colors', 5, [
      ...bracelet.palette,
      addedColorId('#ff8800'),
      addedColorId('#2a6f97'),
    ]),
    named(fixtureProject({ technique: 'peyote', columns: 12, rows: 8, blank: true }), 'seed-blank', 'Blank start', 30),
  ]
}

interface OpenOptions {
  /** Where to go, relative to the app's base: `./` for the editor, `homepage/` for the Homepage. */
  url?: string
  locale?: Locale
  /** Open the editor even on a fresh device, as a stranger who pressed "open the editor" on the Homepage would. */
  chooseEditor?: boolean
}

/** Opens the app the way the stranger meets it: nothing hidden, the storage note and first-run hints left to appear;
 * the seeded states get the plan's library first (and have seen the storage note, as a device with saved Projects
 * has). */
export async function openForAudit(walk: Walk, options: OpenOptions = {}): Promise<void> {
  const { page, state } = walk
  if (state !== 'fresh') {
    await page.addInitScript(() => localStorage.setItem('openbeads:storage-note-seen', 'yes'))
    await page.addInitScript(
      ({ key, value }) => {
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, value)
        }
      },
      { key: STORAGE_KEY, value: storedLibrary(seededLibrary()) },
    )
  }
  if (options.locale) {
    await page.addInitScript((locale) => localStorage.setItem('openbeads:locale', locale), options.locale)
  }
  if (options.chooseEditor || state !== 'fresh') {
    await page.addInitScript(() => sessionStorage.setItem('openbeads:editor-chosen', '1'))
  }
  // A headless browser can't show the save picker (services/fileWriter.ts); without it the app hands over a download,
  // as it does in Safari and Firefox, which the walk can catch and import back.
  await page.addInitScript(() => {
    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker
  })
  await page.goto(options.url ?? './')
  await page.locator('[data-testid="app-canvas"], [data-testid="homepage-page"]').first().waitFor()
  await settle(page)
}

/** The middle of the Project on screen, for a first bead or a tap on the drawing. */
export async function surfaceCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('project-surface').boundingBox()
  if (!box) {
    throw new Error('The Project surface has no box on screen')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Clicks a control if it is on screen right now; says whether it was. */
export async function clickIfVisible(page: Page, testId: string): Promise<boolean> {
  const control = page.getByTestId(testId).first()
  if (await control.isVisible()) {
    await control.click()
    await settle(page)
    return true
  }
  return false
}

/** Closes whatever Escape closes: a popover, a modal, a panel. */
export async function escape(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await settle(page)
}
