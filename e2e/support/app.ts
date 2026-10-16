import type { Locator, Page } from '@playwright/test'
import { STORAGE_KEY, storedLibrary } from './projects'
import { normalizeProject, type Project } from '../../src/domain/project'
import { decodeProject, type EncodedProject } from '../../src/domain/projectEncoding'
import type { Tool } from '../../src/domain/tool'

/**
 * Opens the app with these Projects already in the library (the most recently updated one opens), or none at all. It
 * opens at the preview's address, or at `url` where a check serves the build itself.
 */
export async function openApp(
  page: Page,
  projects: Project[],
  url = './',
  /** Leave the storage note (ticket 399) to appear at the first save; by default the device has already seen it, so it never covers a check's clicks. */
  options: { storageNote?: boolean } = {},
): Promise<void> {
  if (!options.storageNote) {
    await page.addInitScript(() => localStorage.setItem('openbeads:storage-note-seen', 'yes'))
  }
  if (projects.length > 0) {
    const stored = storedLibrary(projects)
    await page.addInitScript(
      ({ key, value }) => {
        // Only on the first load of this page: a reload should see whatever the app has saved since.
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, value)
        }
      },
      { key: STORAGE_KEY, value: stored },
    )
  }
  // An empty library would otherwise send a new visitor to the Overview (ticket 77); these checks are about the editor.
  await page.addInitScript(() => sessionStorage.setItem('openbeads:editor-chosen', '1'))
  // Text is set from the font files' own measurements, not the operating system's: no hinting, fractional advances,
  // kerning on, and no synthesized bold or italic, so a Mac, a Linux box and CI break lines in the same places.
  // Added on every load, so it survives the navigations some checks make.
  await page.addInitScript((css) => {
    const style = document.createElement('style')
    style.textContent = css
    document.documentElement.appendChild(style)
  }, '* { text-rendering: geometricPrecision; font-kerning: normal; font-synthesis: none; -webkit-font-smoothing: antialiased; }')
  await page.goto(url)
  await page.getByTestId('app-canvas').waitFor()
  // The app's line height is 145% of 18px, which puts everything below the first line of text at a fractional pixel
  // and so blurs the edge of every bead by a fraction of a pixel. Pinning it to whole pixels leaves the layout as it is
  // and the screenshots free of that noise.
  await page.addStyleTag({ content: ':root { --line-height-base: 26px; }' })
}

/** Resolves once the browser has produced two frames, i.e. what was just changed has been laid out and painted. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

/** One of the Dock's four sheets (Dock card). */
type DockSheetButton = 'dock-color' | 'strip-project' | 'strip-menu'

/** Opens a Dock sheet (Dock card), closing whichever one is already open first — its Dock button toggles, so clicking
 * it while open would close it instead. Does nothing if the right one is already open. */
export async function openDockSheet(page: Page, dock: DockSheetButton): Promise<void> {
  if ((await page.getByTestId('bottom-sheet').count()) > 0) {
    await closeSheet(page)
  }
  await page.getByTestId(dock).click()
  await settle(page)
}

/** Closes whichever Dock sheet is open, the way its own Close button does; does nothing with none open. */
export async function closeSheet(page: Page): Promise<void> {
  const close = page.getByTestId('sheet-close')
  if ((await close.count()) > 0) {
    await close.click()
    await settle(page)
  }
}

/** Picks a Tool with its Dock tile (Dock card; ticket 431: no sheet in between). */
export async function selectTool(page: Page, tool: Tool): Promise<void> {
  await page.getByTestId(`dock-tool-${tool}`).click()
  await settle(page)
}

/** Copies the Selection by its keyboard chord, which clears the Selection and arms paste mode (ticket 437). */
export async function copySelection(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+c')
  await settle(page)
}

/** Opens the New Project form (modal sheet): with no Project open the Dock layout shows the project bar in the Dock's
 * place (AppBottomBar card) instead of the Toolbox layout's inline form. */
export async function openNewProjectForm(page: Page): Promise<void> {
  await page.getByTestId('phone-bar-new-project').click()
  await settle(page)
}

/** The zoom readout in the Canvas strip's cluster (the framing step shows its own there too). */
function zoomControl(page: Page, part: 'level' | 'in' | 'out'): Locator {
  return page.getByTestId(`zoom-${part}`)
}

/** The zoom level on screen right now, in percent. */
export async function currentZoomPercent(page: Page): Promise<number> {
  return Number.parseInt((await zoomControl(page, 'level').textContent()) ?? '', 10)
}

/** Clicks the zoom buttons until the level reads `percent`, and waits for the picture to catch up. */
export async function setZoom(page: Page, percent: number): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await currentZoomPercent(page)
    if (current === percent) {
      break
    }
    await zoomControl(page, current < percent ? 'in' : 'out').click()
  }
  await settle(page)
}

type Box = { x: number; y: number; width: number; height: number }

/**
 * The surface's box moved back by how far the view is scrolled (the canvas opens centred on the Frame, so that is not
 * 0): the box `beadCentre` wants, whose corner is where the Project's own corner is on screen.
 */
export async function projectBox(page: Page, box: Box): Promise<Box> {
  const grid = page.getByTestId('project-surface')
  const scrollX = Number(await grid.getAttribute('data-scroll-x')) || 0
  const scrollY = Number(await grid.getAttribute('data-scroll-y')) || 0
  return { ...box, x: box.x - scrollX, y: box.y - scrollY }
}

/** The Project's corner and the canvas's size on screen, scrolled into view first so the numbers are usable as pointer coordinates. */
export async function gridBox(page: Page): Promise<Box> {
  const grid: Locator = page.getByTestId('project-surface')
  await grid.scrollIntoViewIfNeeded()
  const box = await grid.boundingBox()
  if (!box) {
    throw new Error('The Project grid has no box on screen')
  }
  return projectBox(page, box)
}

/** States the Schema size in the size step Convert image opens after a picture is chosen (ticket 342), in beads, and continues to framing. */
export async function stateConvertSize(page: Page, columns: number, rows: number): Promise<void> {
  const unit = page.getByTestId('convert-size-unit').locator('[data-value="beads"]')
  await unit.click()
  await page.getByTestId('width-input').fill(String(columns))
  await page.getByTestId('height-input').fill(String(rows))
  await page.getByTestId('convert-size-continue').click()
}

/** The Project the app has saved, read back the way it is stored: Save sits in the Dock's Project sheet. */
export async function savedProject(page: Page): Promise<Project> {
  await openDockSheet(page, 'strip-project')
  await page.getByTestId('save-button').click()
  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  await closeSheet(page)
  const library = JSON.parse(stored!) as { patterns: EncodedProject[] }
  return normalizeProject(decodeProject(library.patterns[0]!))
}
