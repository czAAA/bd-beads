import { expect, test, type Page } from '@playwright/test'
import { gridBox, openApp, savedProject, settle, setZoom } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { frameOf } from '../../src/domain/layerRecord'
import { frameGrid } from '../../src/testUtils/frameGrid'

/** The margin sheet's Move bar and Edit Frame are drawn at the sheet's scale, its band over 72px held between 0.6 and 1.5 (tickets 0657, 0698); the Frame panel hangs from the strip's Frame button (tickets 475, 510). Measured by their boxes, not compared with a picture. */

type Box = { x: number; y: number; width: number; height: number }

async function box(page: Page, testid: string): Promise<Box> {
  const found = await page.getByTestId(testid).first().boundingBox()
  expect(found, testid).not.toBeNull()
  return found!
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// The sheet's full form, from 51% (tickets 0658, 0698): a loom bead is 20px at 100%, so the band is 80px there and the
// scale 80 / 72; from 135% it is held at 1.5. Under 23% only the Move bar is left (ticket 0682).
for (const [zoom, scale] of [[100, 80 / 72], [400, 1.5]] as const) {
  test(`the handle and pencil are drawn at the sheet's scale and clear each other, and the bar keeps its size, at ${zoom}%`, async ({ browser }) => {
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

    for (const [drawn, px] of [[handle.width, 56], [handle.height, 28], [pencil.width, 28], [pencil.height, 28]]) expect(drawn).toBeCloseTo(px * scale, 1)
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
  // At 400% the sheet is drawn at its largest scale, 1.5 (ticket 0698).
  expect([after.handle.width, after.handle.height]).toEqual([56 * 1.5, 28 * 1.5])
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

// Under 0.6 of a 31px band nothing of the sheet is drawn but the Move bar, on the Frame's top edge (ticket 0682): it still
// drags the Frame, and a press on the Frame's first row, by mouse or by finger, reaches the bead, not the bar.
for (const touch of [false, true]) {
  for (const zoom of [10, 20]) {
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
      const before = frameOf(await savedProject(page))!
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
      await expect.poll(async () => frameOf(await savedProject(page))!.column).toBe(before.column + 10)
      await context.close()
    })
  }
}

// The current pass is marked on its number in the full form and by a tick inside the Frame's line in the compact one
// (ticket 0685): with the passes running down the columns, its mark stands in the top band with the tools, but never
// under one, wherever along the Frame the pass is.
for (const zoom of [60, 80, 100]) {
  for (const column of [20, 37]) {
    test(`the current column's mark stands under no tool of the margin sheet, at ${zoom}% on column ${column + 1}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
      const page = await context.newPage()
      await openApp(page, [fixtureProject({ technique: 'loom', columns: 40, rowProgress: { direction: 'columns', currentColumn: column } })])
      await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
      await setZoom(page, zoom)
      await expect(page.getByTestId('margin-band')).toHaveCount(1)
      await page.mouse.move(5, 5)
      await settle(page)

      const { marked, covered } = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="project-surface-overlay"]')!
        const rect = canvas.getBoundingClientRect()
        const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
        // The light theme's `marker`, #1d4ed8.
        const marker = [0x1d, 0x4e, 0xd8]
        let marked = 0
        const covered: string[] = []
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3]! < 250 || Math.abs(data[index]! - marker[0]!) + Math.abs(data[index + 1]! - marker[1]!) + Math.abs(data[index + 2]! - marker[2]!) > 24) continue
          marked += 1
          const pixel = index / 4
          const x = rect.left + ((pixel % canvas.width) + 0.5) * (rect.width / canvas.width)
          const y = rect.top + (Math.floor(pixel / canvas.width) + 0.5) * (rect.height / canvas.height)
          const tool = document.elementFromPoint(x, y)?.closest('[data-testid="margin-sheet"] :is(button, [role="progressbar"], .row-progress__counter)')
          if (tool && covered.length < 5) covered.push(`${tool.getAttribute('aria-label') ?? tool.className} at ${Math.round(x)}, ${Math.round(y)}`)
        }
        return { marked, covered }
      })
      expect(marked).toBeGreaterThan(0)
      expect(covered).toEqual([])
      await context.close()
    })
  }
}
