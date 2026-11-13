import { expect, test, type Page } from '@playwright/test'
import { convertPicture, openApp, openNewProjectForm, setConvertWidth, settle } from '../support/app'
import { fixturePicture } from '../support/picture'

/** Nothing sits under the Tool pill and the Progress bar (ticket 0850): after Create Project, and on every Fit, the
 * converted Frame's Margin sheet lies whole above both bars; the Frame panel ends above the Progress bar, and one press on
 * Row done marks the row while it is open. On the UX audit's devices: an iPad 13″ in landscape and a MacBook Air. */
const DEVICES = [
  ['iPad', { width: 1366, height: 1024 }, true],
  ['laptop', { width: 1470, height: 956 }, false],
] as const

async function box(page: Page, testid: string) {
  const found = await page.getByTestId(testid).first().boundingBox()
  expect(found, testid).not.toBeNull()
  return found!
}

/** The sheet lies whole between the strip and the Tool pill, and so above the Progress bar. */
async function expectSheetClear(page: Page, when: string) {
  const sheet = await box(page, 'margin-sheet')
  const strip = await box(page, 'canvas-strip')
  const pill = await box(page, 'tool-pill')
  const bar = await box(page, 'progress-bar')
  expect(sheet.y, when).toBeGreaterThanOrEqual(strip.y + strip.height)
  expect(sheet.y + sheet.height, when).toBeLessThanOrEqual(pill.y)
  expect(sheet.y + sheet.height, when).toBeLessThanOrEqual(bar.y)
}

for (const [name, viewport, hasTouch] of DEVICES) {
  test(`a converted Frame is fitted clear of the bars, and the Frame panel ends above Row done, on the ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch, colorScheme: 'dark', reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [])
    await openNewProjectForm(page)
    await convertPicture(page, fixturePicture(240, 160))
    await setConvertWidth(page, 60)
      await page.getByTestId('convert-image-create').click()
    await page.getByTestId('margin-sheet').waitFor()
    await settle(page)
    await expectSheetClear(page, 'after Create Project')

    // Zoomed in by hand, then Fit again.
    await page.getByTestId('zoom-in').click()
    await page.getByTestId('zoom-reset').click()
    await settle(page)
    await expectSheetClear(page, 'after Fit')

    await page.getByTestId('strip-frame').click()
    await settle(page)
    const panel = await box(page, 'panel-dropdown')
    const bar = await box(page, 'progress-bar')
    expect(panel.y + panel.height).toBeLessThanOrEqual(bar.y)

    const position = page.getByTestId('progress-bar-position')
    const before = await position.textContent()
    await page.getByTestId('progress-bar-next').click()
    await expect(position).not.toHaveText(before!)
    await expect(page.getByTestId('panel-dropdown')).toBeVisible()
    await context.close()
  })
}
