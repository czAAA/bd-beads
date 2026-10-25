import { expect, test, type Page } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Frame's Move handle, edit pencil never scale with the zoom (ticket 473); the Frame panel hangs from the strip's Frame button (tickets 475, 510). Measured by their boxes, not compared with a picture. */

type Box = { x: number; y: number; width: number; height: number }

async function box(page: Page, testid: string): Promise<Box> {
  const found = await page.getByTestId(testid).first().boundingBox()
  expect(found, testid).not.toBeNull()
  return found!
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

for (const zoom of [10, 100, 400]) {
  test(`the handle, pencil and bar keep their size, and the handle and pencil clear each other, at ${zoom}%`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    // Zoom first: a press on the strip's zoom buttons closes the bar, as it does Menu and Project (ticket 475).
    await setZoom(page, zoom)
    await page.getByTestId('strip-frame').click()

    const handle = await box(page, 'frame-move-handle')
    const pencil = await box(page, 'frame-edit-toggle')
    const bar = await box(page, 'panel-dropdown')

    expect([handle.width, handle.height]).toEqual([56, 44])
    expect([pencil.width, pencil.height]).toEqual([32, 32])
    expect(bar.width).toBeLessThanOrEqual(400)
    for (const testid of ['frame-edge-top-out', 'frame-edge-left-in', 'frame-edge-right-out']) {
      const step = await box(page, testid)
      expect([step.width, step.height]).toEqual([26, 24])
    }
    expect(overlaps(handle, pencil)).toBe(false)
    await context.close()
  })
}

test('opening the bar does not push the canvas or move the pencil', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await settle(page)
  const closed = await box(page, 'project-surface')
  const pencil = await box(page, 'frame-edit-toggle')
  await page.getByTestId('strip-frame').click()
  await settle(page)
  expect(await box(page, 'project-surface')).toEqual(closed)
  expect(await box(page, 'frame-edit-toggle')).toEqual(pencil)
  await context.close()
})

test('panning the canvas moves the Frame but not a bar opened from the strip, and the handle keeps its size', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 40, rows: 40 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 400)
  await page.getByTestId('strip-frame').click()

  const before = { bar: await box(page, 'panel-dropdown'), handle: await box(page, 'frame-move-handle') }
  await page.locator('.app-shell__canvas-scroll').evaluate((element) => element.scrollBy(300, 200))
  await page.waitForTimeout(100)
  const after = { bar: await box(page, 'panel-dropdown'), handle: await box(page, 'frame-move-handle') }

  expect(after.bar).toEqual(before.bar)
  expect([after.handle.width, after.handle.height]).toEqual([56, 44])
  await context.close()
})

test('the Frame\'s keep-out margin is outlined round it, and its controls sit in the gutter just outside the Frame\'s edge (ADR 0066)', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 200)
  await page.getByTestId('frame-edit-toggle').click()
  await settle(page)
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('app-canvas')).toHaveScreenshot('frame-gutter-controls.png', { maxDiffPixelRatio: 0.01 })
  await context.close()
})
