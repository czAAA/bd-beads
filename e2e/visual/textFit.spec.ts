import { expect, test, type Locator, type Page } from '@playwright/test'
import { TOUR_ENABLED } from '../../src/features'
import { openApp } from '../support/app'
import { fixturePicture } from '../support/picture'
import { fixtureProject, STORAGE_KEY, storedLibrary } from '../support/projects'
import type { Project } from '../../src/domain/project'
import { findHoverMisfits } from '../support/hoverText'
import { HOVER_PENDING } from '../support/hoverPending'
import { recordOpened } from '../support/hoverReach'
import { findTextMisfits } from '../support/textFit'
import { HEIGHTS, LOCALES, WIDTHS } from '../support/textFitMatrix'
import { unexplained, type Found } from '../support/textFitPending'

const PHONE_SHEETS = ['dock-tool', 'dock-color', 'dock-frame', 'dock-project', 'dock-menu']

type Measure = (detail?: string) => Promise<void>
interface Screen {
  name: string
  /** Gets the app into the state (from a fresh load, or from the Overview for `overview`) and calls `measure` for each look. Returns false when the state can't be reached at this width. */
  visit: (page: Page, measure: Measure) => Promise<boolean | void>
  overview?: boolean
  /** The Project the screen starts with, when it is not the plain one (a Row progress that is on, say). */
  project?: Project
}

const wholeOnScreen = async (locator: Locator): Promise<boolean> => {
  const box = await locator.first().boundingBox().catch(() => null)
  const viewport = locator.page().viewportSize()!
  // Not how far down it is: the left column scrolls, and a click scrolls to what it clicks.
  return !!box && box.width > 0 && box.x >= -1 && box.x + box.width <= viewport.width + 1
}
/** The first of the elements with this test id that is displayed at all (the phone and desktop versions of a control share one). */
const vis = (page: Page, testid: string): Locator => page.locator(`[data-testid="${testid}"]:visible`).first()
const shown = async (page: Page, testid: string): Promise<boolean> => (await vis(page, testid).count()) > 0 && (await wholeOnScreen(vis(page, testid)))

/** Whether the control is there, opening the Toolbox's collapsed Frame row if that is where it is. */
async function shownOrExpanded(page: Page, testid: string): Promise<boolean> {
  if (await shown(page, testid)) return true
  if (['frame-fit', 'size-estimate-info'].includes(testid) && (await shown(page, 'tool-group-frame'))) {
    await vis(page, 'tool-group-frame').locator('button').first().click()
    await settle(page)
    return shown(page, testid)
  }
  return false
}

/** Brings the control into view the way a person would at this width: it is already there, or in one of the phone sheets. Returns false when no way leads to it. */
async function reveal(page: Page, testid: string): Promise<boolean> {
  if (await shownOrExpanded(page, testid)) return true
  for (const dock of PHONE_SHEETS) {
    if (!(await shown(page, dock))) break
    await page.getByTestId(dock).click()
    await settle(page)
    if (await shown(page, testid)) return true
    await page.getByTestId('sheet-close').click().catch(() => {})
  }
  return false
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

async function click(page: Page, testid: string): Promise<void> {
  await vis(page, testid).click()
  await settle(page)
}

const TOUR_SCREEN: Screen = {
  name: 'Tour',
  visit: async (page, measure) => {
    await click(page, 'header-menu')
    await click(page, 'menu-item-tour')
    for (let step = 1; step <= 20; step += 1) {
      await page.getByTestId('tour-card').waitFor()
      await measure(`step ${step}`)
      if (!(await shown(page, 'tour-next'))) break
      await click(page, 'tour-next')
    }
  },
}

const SCREENS: Screen[] = [
  { name: 'editor', visit: async (_page, measure) => measure() },
  {
    // The Progress bar's buttons only show while Row progress is on, and it clips its overflow: its Tooltips are the hard case (ticket 264).
    name: 'Row progress',
    project: fixtureProject({ technique: 'loom', rowProgress: { enabled: true } }),
    visit: async (_page, measure) => measure(),
  },
  {
    name: 'selection',
    visit: async (page, measure) => {
      if (!(await reveal(page, 'tool-select'))) return false
      await click(page, 'tool-select')
      // On the phone the tool sheet is still open over the canvas.
      if (await shown(page, 'sheet-close')) await click(page, 'sheet-close')
      const box = await vis(page, 'project-surface').boundingBox()
      if (!box) return false
      await page.mouse.move(box.x + 40, box.y + 40)
      await page.mouse.down()
      await page.mouse.move(box.x + 120, box.y + 120, { steps: 4 })
      await page.mouse.up()
      await settle(page)
      await measure()
    },
  },
  {
    name: 'phone sheets',
    visit: async (page, measure) => {
      if (!(await shown(page, 'dock'))) return false
      for (const dock of PHONE_SHEETS) {
        await click(page, dock)
        await measure(dock.replace('dock-', ''))
        await click(page, 'sheet-close')
      }
    },
  },
  {
    // Only at 1024px and up: under it there is no header, and the Menu is one of the phone sheets.
    name: 'header menu',
    visit: async (page, measure) => {
      if (!(await shown(page, 'header-menu'))) return false
      await click(page, 'header-menu')
      await measure()
    },
  },
  {
    name: 'keyboard shortcuts',
    visit: async (page, measure) => {
      if (!(await shown(page, 'shortcuts-button'))) return false
      await click(page, 'shortcuts-button')
      await measure()
    },
  },
  {
    name: 'export menu',
    visit: async (page, measure) => {
      if (!(await reveal(page, 'export-menu-button'))) return false
      await click(page, 'export-menu-button')
      await measure()
    },
  },
  {
    name: 'export menu: Name on exports',
    visit: async (page, measure) => {
      if (!(await reveal(page, 'export-menu-button'))) return false
      await click(page, 'export-menu-button')
      if (!(await shown(page, 'name-on-exports-change'))) return false
      await click(page, 'name-on-exports-change')
      await measure()
    },
  },
  {
    name: 'export menu: QR code',
    visit: async (page, measure) => {
      if (!(await reveal(page, 'export-menu-button'))) return false
      await click(page, 'export-menu-button')
      if (!(await shown(page, 'export-qr'))) return false
      await click(page, 'export-qr')
      await measure()
    },
  },
  {
    name: 'Frame',
    visit: async (page, measure) => {
      if (!(await reveal(page, 'frame-fit'))) return false
      await measure()
    },
  },
  {
    name: 'Clear project',
    visit: async (page, measure) => {
      const id = (await reveal(page, 'delete-all-button')) ? 'delete-all-button' : (await reveal(page, 'sheet-delete-all')) ? 'sheet-delete-all' : null
      if (!id) return false
      await click(page, id)
      await measure()
    },
  },
  {
    name: 'empty library',
    visit: async (page, measure) => {
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, storedLibrary([])])
      await page.reload()
      await page.getByTestId('app-canvas').waitFor()
      await measure()
    },
  },
  {
    name: 'New Project',
    visit: async (page, measure) => {
      if (!(await openNewProject(page))) return false
      await measure()
    },
  },
  {
    name: 'New Project: Convert image',
    visit: async (page, measure) => {
      if (!(await openNewProject(page))) return false
      await page.locator('[data-testid="convert-image-field"]:visible input[type="file"]').first().setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: fixturePicture() })
      await vis(page, 'convert-image-box').waitFor()
      await settle(page)
      await measure()
    },
  },
  ...['quantities-weight-info', 'size-estimate-info'].map((testid): Screen => ({
    name: `info popover: ${testid}`,
    visit: async (page, measure) => {
      if (!(await reveal(page, testid))) return false
      await click(page, testid)
      await vis(page, testid.replace(/-info$/, '-tooltip')).waitFor()
      await measure()
    },
  })),
  {
    name: 'info popover: new-project-estimate-info',
    visit: async (page, measure) => {
      if (!(await openNewProject(page)) || !(await shown(page, 'new-project-estimate-info'))) return false
      await click(page, 'new-project-estimate-info')
      await vis(page, 'new-project-estimate-tooltip').waitFor()
      await measure()
    },
  },
  ...[
    ['Beads needed', 'bead-quantities'],
    ['Saved Projects', 'project-list'],
  ].map(([name, testid]): Screen => ({
    name: `${name} expanded`,
    visit: async (page, measure) => {
      if (!(await reveal(page, testid))) return false
      const expand = page.locator(`[data-testid="${testid}"]:visible [data-testid="panel-expand"]`).first()
      if ((await expand.count()) === 0) return false
      await expand.click()
      await settle(page)
      await measure()
    },
  })),
  // The Tour is switched off (ticket 247); its screen is visited again when TOUR_ENABLED is turned on.
  ...(TOUR_ENABLED ? [TOUR_SCREEN] : []),
  {
    name: 'Overview',
    overview: true,
    visit: async (_page, measure) => {
      await measure()
    },
  },
  {
    name: 'Overview carousel',
    overview: true,
    visit: async (page, measure) => {
      const tabs = page.getByRole('tab')
      const count = await tabs.count()
      for (let i = 0; i < count; i += 1) {
        if (await tabs.nth(i).isVisible()) await tabs.nth(i).click()
        else if (i > 0) await click(page, 'feature-next')
        await settle(page)
        await measure(`feature ${i + 1}`)
      }
    },
  },
]

/** The New Project form as a first-time visitor has it (no Project open, so it is in place of the Toolbox), filled in with a size. */
async function openNewProject(page: Page): Promise<boolean> {
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, storedLibrary([])])
  await page.reload()
  await page.getByTestId('app-canvas').waitFor()
  if (!(await reveal(page, 'width-input'))) {
    if (!(await shown(page, 'phone-bar-new-project'))) return false
    await click(page, 'phone-bar-new-project')
  }
  await vis(page, 'width-input').fill('16')
  await vis(page, 'height-input').fill('10')
  await settle(page)
  return true
}

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`text fits its box: ${locale}, ${width}px`, async ({ page }) => {
      test.setTimeout(240_000)
      page.setDefaultTimeout(4000)
      await page.setViewportSize({ width, height: HEIGHTS[width] })
      await page.addInitScript((value) => localStorage.setItem('bd-beads:locale', value), locale)
      await openApp(page, [fixtureProject({ technique: 'loom' })])
      const found: Found[] = []
      const seen = new Set<string>()
      // The hover text check (ticket 264): what it has opened in this run, and which source places those Tooltips come from.
      const hoverFound: Found[] = []
      const hoverSeen = new Set<string>()
      const hoverKeys = new Set<string>()
      const opened = new Set<string>()
      const library = storedLibrary([fixtureProject({ technique: 'loom' })])
      for (const screen of SCREENS) {
        // Some screens start from an empty library; each begins with the Project open.
        await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, screen.project ? storedLibrary([screen.project]) : library])
        if (screen.overview) await page.goto('./overview/')
        else await page.goto('./')
        // No header under 1024px (ticket 295): wait for the canvas box instead.
        await page.getByTestId(screen.overview ? 'overview' : 'app-canvas').waitFor()
        let current = screen.name
        const measure: Measure = async (detail) => {
          current = detail ? `${screen.name} (${detail})` : screen.name
          for (const misfit of await findTextMisfits(page)) {
            // What is under an open menu or dialog is reported once, on the first screen it shows up on.
            const key = `${misfit.problem}|${misfit.element}|${misfit.text}`
            if (!seen.has(key)) {
              seen.add(key)
              found.push({ ...misfit, screen: current })
            }
          }
          const hover = await findHoverMisfits(page, hoverSeen)
          for (const owner of hover.opened) opened.add(owner)
          for (const misfit of hover.misfits) {
            const key = `${misfit.problem}|${misfit.element}|${misfit.text}|${misfit.against}`
            if (!hoverKeys.has(key)) {
              hoverKeys.add(key)
              hoverFound.push({ ...misfit, screen: current })
            }
          }
        }
        try {
          const result = await screen.visit(page, measure)
          if (result === false && process.env.TEXTFIT_DEBUG) console.log(`${locale} ${width} | ${screen.name} | skipped`)
        } catch (error) {
          found.push({ problem: 'pokes-out', element: 'the check itself', text: `could not drive "${current}": ${String(error).split('\n').slice(0, process.env.TEXTFIT_DEBUG ? 12 : 1).join(' ⏎ ')}`, pixels: 0, against: '', screen: current })
        }
      }
      if (process.env.TEXTFIT_DEBUG) for (const f of found) console.log(`${locale} ${width} | ${f.screen} | ${f.problem} ${f.element} "${f.text}" ${f.pixels}px ${f.against}`)
      if (process.env.TEXTFIT_DEBUG) for (const f of hoverFound) console.log(`HOVER ${locale} ${width} | ${f.screen} | ${f.element} "${f.text}" ${f.pixels}px ${f.against}`)
      recordOpened(locale, width, opened)
      expect(unexplained(locale, width, found), `${locale}, ${width}px`).toEqual([])
      expect(unexplained(locale, width, hoverFound, HOVER_PENDING), `hover text, ${locale}, ${width}px`).toEqual([])
    })
  }
}
