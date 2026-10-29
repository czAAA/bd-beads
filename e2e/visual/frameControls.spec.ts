import { expect, test, type Page } from '@playwright/test'
import { gridBox, openApp, savedProject, settle, setZoom } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { frameGrid } from '../../src/testUtils/frameGrid'

/** The margin sheet's Move bar and Edit Frame never scale with the zoom (tickets 473, 0657); the Frame panel hangs from the strip's Frame button (tickets 475, 510). Measured by their boxes, not compared with a picture. */

type Box = { x: number; y: number; width: number; height: number }

async function box(page: Page, testid: string): Promise<Box> {
  const found = await page.getByTestId(testid).first().boundingBox()
  expect(found, testid).not.toBeNull()
  return found!
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// The sheet's full form, from 85% (ticket 0658): under it the tools are compact or folded, and under about 39% only the
// Move bar is left (ticket 0682).
for (const zoom of [100, 400]) {
  test(`the handle, pencil and bar keep their size, and the handle and pencil clear each other, at ${zoom}%`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom', columns: 40 })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    // Zoom first: a press on the strip's zoom buttons closes the bar, as it does Menu and Project (ticket 475).
    await setZoom(page, zoom)
    await page.getByTestId('strip-frame').click()

    const handle = await box(page, 'frame-move-handle')
    const pencil = await box(page, 'frame-edit-toggle')
    const bar = await box(page, 'panel-dropdown')

    expect([handle.width, handle.height]).toEqual([56, 28])
    expect([pencil.width, pencil.height]).toEqual([28, 28])
    expect(bar.width).toBe(585)
    for (const testid of ['frame-edge-top-out', 'frame-edge-left-in', 'frame-edge-right-out']) {
      const step = await box(page, testid)
      // 26px halves as tall as a picker (1.5rem, which the root font size scales).
      expect(step.width).toBe(26)
      expect(step.height).toBeLessThanOrEqual(32)
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
  expect([after.handle.width, after.handle.height]).toEqual([56, 28])
  await context.close()
})

test('the Frame\'s margin sheet carries its tools, Row progress and title block, with hot corners while Edit Frame is on (ticket 0657)', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 200)
  await page.getByTestId('frame-edit-toggle').click()
  await settle(page)
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('app-canvas')).toHaveScreenshot('frame-margin-sheet.png', { maxDiffPixelRatio: 0.01 })
  await context.close()
})

/** A finger's press and lift, as the touch stroke check sends it. */
async function tap(page: Page, at: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

// Under a 31px band nothing of the sheet is drawn but the Move bar, on the Frame's top edge (ticket 0682): it still
// drags the Frame, and a press on the Frame's first row, by mouse or by finger, reaches the bead, not the bar.
for (const touch of [false, true]) {
  for (const zoom of [10, 20, 30]) {
    test(`the bare sheet's Move bar drags the Frame and leaves its first row to the beads, at ${zoom}%${touch ? ', by touch' : ''}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce', hasTouch: touch })
      const page = await context.newPage()
      await openApp(page, [fixtureProject({ technique: 'loom', columns: 40, rows: 12, blank: true })])
      await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
      await setZoom(page, zoom)
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
      await expect(page.getByTestId('margin-handle')).toHaveCount(1)
      await expect(page.getByTestId('margin-band')).toHaveCount(0)

      // A press on the first row's middle bead, just under the bar, paints it.
      const before = (await savedProject(page)).frame!
      const bead = beadCentre({ technique: 'loom', rotation: 0 }, await gridBox(page), zoom / 100, { row: before.row, column: before.column + 20 })
      if (touch) await tap(page, bead)
      else await page.mouse.click(bead.x, bead.y)
      await expect.poll(async () => frameGrid(await savedProject(page))[0]![20]!.color).not.toBeNull()

      // The Move bar drags the Frame 10 beads right (a bead is 20px at 100%).
      const handle = await box(page, 'frame-move-handle')
      const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(from.x + 200 * (zoom / 100), from.y, { steps: 10 })
      await page.mouse.up()
      await expect.poll(async () => (await savedProject(page)).frame!.column).toBe(before.column + 10)
      await context.close()
    })
  }
}
