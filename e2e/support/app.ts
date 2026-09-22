import type { Locator, Page } from '@playwright/test'
import { STORAGE_KEY, storedLibrary } from './patterns'
import type { Pattern } from '../../src/domain/pattern'

/** Opens the app with these Patterns already in the library (the most recently updated one opens), or none at all. */
export async function openApp(page: Page, patterns: Pattern[]): Promise<void> {
  if (patterns.length > 0) {
    const stored = storedLibrary(patterns)
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
  await page.goto('./')
  await page.getByTestId('app-topbar').waitFor()
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

/** The grid element's box on screen, scrolled into view first so the numbers are usable as pointer coordinates. */
export async function gridBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const grid: Locator = page.getByTestId('pattern-surface')
  await grid.scrollIntoViewIfNeeded()
  const box = await grid.boundingBox()
  if (!box) {
    throw new Error('The Pattern grid has no box on screen')
  }
  return box
}
