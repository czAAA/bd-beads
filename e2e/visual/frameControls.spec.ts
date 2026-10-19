import { expect, test, type Page } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Frame's Move handle, edit pencil and Frame bar never scale with the zoom (ticket 473); the bar hangs from
 * whichever opened it (ticket 475). Measured by their boxes, not compared with a picture. */

type Box = { x: number; y: number; width: number; height: number }

async function box(page: Page, testid: string): Promise<Box> {
  const found = await page.getByTestId(testid).first().boundingBox()
  expect(found, testid).not.toBeNull()
  return found!
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

for (const zoom of [10, 100, 400]) {
  test(`the handle, pencil and bar keep their size, and clear each other, at ${zoom}%`, async ({ browser }) => {
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
    expect(bar.width).toBeLessThanOrEqual(504)
    // Placed beside the Frame, inside the canvas box (ticket 500).
    const area = await box(page, 'app-drawing-area')
    expect(bar.x).toBeGreaterThanOrEqual(area.x)
    expect(bar.y).toBeGreaterThanOrEqual(area.y)
    expect(bar.x + bar.width).toBeLessThanOrEqual(area.x + area.width)
    expect(bar.y + bar.height).toBeLessThanOrEqual(area.y + area.height)
    for (const testid of ['frame-edge-top-out', 'frame-edge-left-in', 'frame-edge-right-out']) {
      const step = await box(page, testid)
      expect([step.width, step.height]).toEqual([48, 48])
    }
    expect(overlaps(handle, pencil)).toBe(false)
    expect(overlaps(handle, bar)).toBe(false)
    expect(overlaps(pencil, bar)).toBe(false)
    await context.close()
  })
}

test('opening the bar does not push the canvas or move the pencil', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  const closed = await box(page, 'project-surface')
  const pencil = await box(page, 'frame-edit-toggle')
  await page.getByTestId('frame-edit-toggle').click()
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
  await page.locator('[data-tour="canvas"]').evaluate((element) => element.scrollBy(300, 200))
  await page.waitForTimeout(100)
  const after = { bar: await box(page, 'panel-dropdown'), handle: await box(page, 'frame-move-handle') }

  expect(after.bar).toEqual(before.bar)
  expect([after.handle.width, after.handle.height]).toEqual([56, 44])
  await context.close()
})

test('opened from the pencil, the bar stands inside the canvas box and is carried by a zoom (ticket 500)', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 100)
  await page.getByTestId('frame-edit-toggle').click()
  await settle(page)

  const hangs = async () => {
    const area = await box(page, 'app-drawing-area')
    const bar = await box(page, 'panel-dropdown')
    expect(bar.x).toBeGreaterThanOrEqual(area.x)
    expect(bar.x + bar.width).toBeLessThanOrEqual(area.x + area.width)
    return bar
  }
  const before = await hangs()
  // A Ctrl+wheel zoom moves the Frame with no press, so the bar stays open and goes with it.
  const area = await box(page, 'app-drawing-area')
  await page.mouse.move(area.x + 120, area.y + area.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 200)
  await page.keyboard.up('Control')
  await settle(page)
  expect(await hangs()).not.toEqual(before)
  await context.close()
})

test('the Frame\'s controls sit in a gutter just outside its edge, with no keep-out margin round it (ADR 0066)', async ({ browser }) => {
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
