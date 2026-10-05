import type { Locator, Page } from '@playwright/test'
import { STORAGE_KEY, storedLibrary } from './projects'
import type { Project } from '../../src/domain/project'

/** Opens the app with these Projects already in the library (the most recently updated one opens), or none at all. */
export async function openApp(page: Page, projects: Project[]): Promise<void> {
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
  await page.addInitScript(() => sessionStorage.setItem('bd-beads:editor-chosen', '1'))
  // Text is set from the font files' own measurements, not the operating system's: no hinting, fractional advances,
  // kerning on, and no synthesized bold or italic, so a Mac, a Linux box and CI break lines in the same places.
  // Added on every load, so it survives the navigations some checks make.
  await page.addInitScript((css) => {
    const style = document.createElement('style')
    style.textContent = css
    document.documentElement.appendChild(style)
  }, '* { text-rendering: geometricPrecision; font-kerning: normal; font-synthesis: none; -webkit-font-smoothing: antialiased; }')
  await page.goto('./')
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

/** Clicks the zoom buttons until the level reads `percent`, and waits for the picture to catch up. */
export async function setZoom(page: Page, percent: number): Promise<void> {
  const level = page.getByTestId('zoom-level')
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = Number.parseInt((await level.textContent()) ?? '', 10)
    if (current === percent) {
      break
    }
    await page.getByTestId(current < percent ? 'zoom-in' : 'zoom-out').click()
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
