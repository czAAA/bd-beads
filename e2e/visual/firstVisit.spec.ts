import { expect, test, type Page } from '@playwright/test'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// A first visit (ticket 0991): the Homepage paints before it asks for the demo editor or the print code, its first
// screen's fonts come with the page, and nothing on the first screen moves as the page arrives.

/** The demo editor's files, by the names the build gives them. */
const DEMO = /\/assets\/(InsideEditor|tourScripts)-[^/]*\.js$/
/** The print code's files. */
const PRINT = /\/assets\/(printCode|printPages|printText|chartPageKey|chartPage|pageOnePage|pdfContent)-[^/]*\.js$/
/** Web Vitals' line for a layout shift too small to see (the ticket's "holds still"). */
const STILL = 0.01

/** Keeps every layout shift from the page's start, and what moved in it. */
async function watchShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: { value: number; moved: string[] }[] = []
    ;(window as unknown as { shifts: typeof shifts }).shifts = shifts
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; sources?: { node?: Node }[] })[]) {
        shifts.push({ value: entry.value, moved: (entry.sources ?? []).map((source) => (source.node instanceof Element ? source.node.className : String(source.node?.nodeName))) })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

const shiftsOf = (page: Page) => page.evaluate(() => (window as unknown as { shifts: { value: number; moved: string[] }[] }).shifts)

/** When the page first painted, and when it asked for each file, in its own clock. */
const timings = (page: Page) =>
  page.evaluate(() => ({
    painted: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    files: (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((entry) => ({ url: entry.name, at: entry.startTime, by: entry.initiatorType })),
  }))

test('the Homepage paints the Welcome before it asks for the demo editor or the print code, and asks for the demo after', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, [], './', { canvasHidden: true })
  // The demo is on its way once the Welcome is on screen, not before; the print code isn't asked for at all.
  await expect.poll(async () => (await timings(page)).files.filter((file) => DEMO.test(file.url)).length).toBe(2)
  const { painted, files } = await timings(page)
  expect(painted).toBeDefined()
  for (const file of files.filter((file) => DEMO.test(file.url))) expect(file.at, file.url).toBeGreaterThanOrEqual(painted!)
  expect(files.filter((file) => PRINT.test(file.url))).toEqual([])
})

test("the Homepage's first screen fonts come with the page, and the Welcome holds still as it arrives", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await watchShifts(page)
  await openApp(page, [], './', { canvasHidden: true })
  await expect(page.getByTestId('homepage-welcome')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const { files } = await timings(page)
  const fonts = files.filter((file) => file.url.includes('/fonts/'))
  for (const face of ['instrument-serif-latin-400-italic', 'inter-latin-400-normal']) {
    expect(fonts.find((file) => file.url.includes(face))?.by, face).toBe('link')
  }
  const shifted = (await shiftsOf(page)).reduce((sum, shift) => sum + shift.value, 0)
  expect(shifted).toBeLessThanOrEqual(STILL)
})

test("the editor shows the Frame's sheet where it stays: it never moves as the editor opens", async ({ page }) => {
  await watchShifts(page)
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 16, rows: 10 })])
  await expect(page.getByTestId('margin-sheet')).toBeVisible()
  // A shift is reported for the frame after it: two more frames see every one the sheet's arrival could make.
  await settle(page)
  const sheetShifts = (await shiftsOf(page)).filter((shift) => shift.moved.some((name) => name.includes('margin-sheet')))
  expect(sheetShifts).toEqual([])
})
