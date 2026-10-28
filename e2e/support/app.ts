import { expect, type Locator, type Page } from '@playwright/test'
import { STORAGE_KEY, storedLibrary } from './projects'
import { normalizeProject, type Project } from '../../src/domain/project'
import { decodeProject, type EncodedProject } from '../../src/domain/projectEncoding'
import type { Tool } from '../../src/domain/tool'

/** Opens the app with these Projects in the library (the most recent opens), or none; at the preview's address or
 * `url`. */
export async function openApp(
  page: Page,
  projects: Project[],
  url = './',
  /** Leave the storage note (ticket 399) to appear at the first save; by default the device has already seen it, so
   * it never covers a check's clicks. */
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
  // An empty library would otherwise send a new visitor to the Homepage (ticket 77); these checks are about the editor.
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

/** One of the Canvas strip's panels (CanvasStrip card): Menu or Project, a dropdown. */
type StripPanelButton = 'strip-project' | 'strip-menu' | 'strip-frame'

/** Opens Menu, Project or Frame (CanvasStrip card), closing whatever is open first — the strip buttons toggle, so clicking one
 * while its panel is open would close it instead. */
export async function openStripPanel(page: Page, dock: StripPanelButton): Promise<void> {
  await closePanel(page)
  await page.getByTestId(dock).click()
  await settle(page)
}

/** Closes whatever is open: Menu or Project with the strip button that lit it; does nothing with none open. */
export async function closePanel(page: Page): Promise<void> {
  const lit = page.locator('[data-testid="strip-menu"][aria-pressed="true"], [data-testid="strip-project"][aria-pressed="true"], [data-testid="strip-frame"][aria-pressed="true"]')
  if ((await lit.count()) > 0) {
    await lit.first().click()
    await settle(page)
  }
}

/** Picks a Tool with its Tool pill tile (ToolPill card; ticket 439). */
export async function selectTool(page: Page, tool: Tool): Promise<void> {
  await page.getByTestId(`pill-tool-${tool}`).click()
  await settle(page)
}

/** Opens the colour popover from the pill's colour tile, unless it is already up (ToolPill card). */
export async function openColorPopover(page: Page): Promise<void> {
  if ((await page.getByTestId('color-popover').count()) === 0) {
    await page.getByTestId('pill-color').click()
    await settle(page)
  }
}

/** Copies the Selection by its keyboard chord, which clears the Selection and arms paste mode (ticket 437). */
export async function copySelection(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+c')
  await settle(page)
}

/** Opens the New Project form (the Menu panel's subpanel). With no Project open Menu opens on it by itself; if it
 * has been closed since, the empty canvas's New Project button brings it back. */
export async function openNewProjectForm(page: Page): Promise<void> {
  const form = page.getByTestId('bead-section')
  if (!(await form.isVisible())) {
    await page.getByTestId('phone-bar-new-project').click()
  }
  await settle(page)
}

/** Chooses a Technique in the New Project form's Technique section (ticket 568). */
export async function chooseNewProjectTechnique(page: Page, technique: string): Promise<void> {
  await page.getByTestId('new-project-technique').locator('button[aria-haspopup]').click()
  await page.getByTestId('new-project-technique').locator(`[role="menuitemradio"][data-value="${technique}"]`).click()
}

/** The zoom buttons in the Canvas strip's cluster (the framing step shows its own there too). */
function zoomControl(page: Page, part: 'in' | 'out'): Locator {
  return page.getByTestId(`zoom-${part}`)
}

/** The zoom level on screen right now, in percent. */
export async function currentZoomPercent(page: Page): Promise<number> {
  return Number.parseInt((await page.getByTestId('canvas-strip-zoom').getAttribute('data-zoom-percent')) ?? '', 10)
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

/** The surface's box moved back by the view's scroll (the canvas opens centred on the Frame, so not 0): what
 * `beadCentre` wants. */
export async function projectBox(page: Page, box: Box): Promise<Box> {
  const grid = page.getByTestId('project-surface')
  const scrollX = Number(await grid.getAttribute('data-scroll-x')) || 0
  const scrollY = Number(await grid.getAttribute('data-scroll-y')) || 0
  return { ...box, x: box.x - scrollX, y: box.y - scrollY }
}

/** The Project's corner and the canvas's size on screen, scrolled into view first so the numbers are usable as
 * pointer coordinates. */
export async function gridBox(page: Page): Promise<Box> {
  const grid: Locator = page.getByTestId('project-surface')
  await grid.scrollIntoViewIfNeeded()
  const box = await grid.boundingBox()
  if (!box) {
    throw new Error('The Project grid has no box on screen')
  }
  return projectBox(page, box)
}

/** States the Schema size in the size step Convert image opens after a picture is chosen (ticket 342), in beads, and
 * continues to framing. */
export async function stateConvertSize(page: Page, columns: number, rows: number): Promise<void> {
  const unit = page.getByTestId('convert-size-unit').locator('[data-value="beads"]')
  await unit.click()
  await page.getByTestId('width-input').fill(String(columns))
  await page.getByTestId('height-input').fill(String(rows))
  await page.getByTestId('convert-size-continue').click()
}

/** The Project the app has saved, read back the way it is stored. Edits reach the device on their own (ticket 523). */
export async function savedProject(page: Page): Promise<Project> {
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).not.toBeNull()
  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  const library = JSON.parse(stored!) as { patterns: EncodedProject[] }
  return normalizeProject(decodeProject(library.patterns[0]!))
}
