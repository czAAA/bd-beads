import { expect, test, type Page } from '@playwright/test'
import { openApp, settle, setZoom } from '../support/app'
import { fixtureProject } from '../support/projects'

/** The Frame's Margin handle, edit pencil and Frame bar never scale with the zoom (ticket 473); the bar hangs from
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
    const button = await box(page, 'strip-frame')

    expect([handle.width, handle.height]).toEqual([56, 44])
    expect([pencil.width, pencil.height]).toEqual([32, 32])
    expect(bar.width).toBeLessThanOrEqual(504)
    // Dropped down from the strip's Frame button, 4px under it, like Menu and Project.
    expect(Math.round(bar.y - (button.y + button.height))).toBe(4)
    expect(Math.round(bar.x)).toBe(Math.round(button.x))
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

test('opened from the pencil, the bar hangs from it, right edges lined up, and follows it as the canvas zooms', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 100)
  await page.getByTestId('frame-edit-toggle').click()
  await settle(page)

  const hangs = async () => {
    const pencil = await box(page, 'frame-edit-toggle')
    const bar = await box(page, 'panel-dropdown')
    expect(Math.round(bar.y - (pencil.y + pencil.height))).toBe(4)
    expect(Math.round(bar.x + bar.width)).toBe(Math.round(pencil.x + pencil.width))
    return bar
  }
  const before = await hangs()
  // A Ctrl+wheel zoom moves the pencil with no press, so the bar stays open and goes with it.
  const area = await box(page, 'app-drawing-area')
  await page.mouse.move(area.x + 120, area.y + area.height / 2)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, 200)
  await page.keyboard.up('Control')
  await settle(page)
  expect(await hangs()).not.toEqual(before)
  await context.close()
})
