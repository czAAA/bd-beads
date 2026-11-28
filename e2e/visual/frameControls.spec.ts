import { expect, test, type Page } from '@playwright/test'
import { gridBox, openApp, openColorPopover, savedProject, settle, setZoom } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { frameGrid } from '../../src/testUtils/frameGrid'
import { placeOf } from '../../src/testUtils/placeOf'

/** The margin sheet's Move bar and Edit Frame are drawn at the sheet's scale, its band over 72px held between 0.6 and 1.5 (tickets 0657, 0698); the Frame's settings popover hangs from its sheet's ··· button (ticket 1222). Measured by their boxes, not compared with a picture. */

type Box = { x: number; y: number; width: number; height: number }

async function box(page: Page, testid: string): Promise<Box> {
  const found = await page.getByTestId(testid).first().boundingBox()
  expect(found, testid).not.toBeNull()
  return found!
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

// The sheet's full form, from 100% (tickets 0658, 0698, 1213): a loom bead is 20px at 100%, so the band is 80px there,
// the drafting sheet's own, at scale 1; from 150% it is held at 1.5. Under 23% only the Move bar and the Frame tools
// button are left (tickets 0682, 1164).
for (const [zoom, scale] of [[100, 1], [400, 1.5]] as const) {
  test(`the handle and pencil are drawn at the sheet's scale and clear each other, and the bar keeps its size, at ${zoom}%`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await openApp(page, [fixtureProject({ technique: 'loom', columns: 40 })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, zoom)
    // At 100% the sheet's ··· button is on screen: its popover is 25rem wide, the root font size scaling it.
    if (zoom === 100) {
      await page.getByTestId('margin-frame-tools').first().click()
      await settle(page)
      const rootPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
      // Its content stands inside the popover's 4px padding and 1px line.
      const inner = (await box(page, 'frame-popover')).width
      const pad = 2 * (0.25 * rootPx) + 2
      expect(inner + pad).toBeCloseTo(25 * rootPx, 0)
      await page.getByTestId('frame-popover-size').locator('[aria-expanded]').click()
      for (const testid of ['frame-edge-top-out', 'frame-edge-left-in', 'frame-edge-right-out']) {
        const step = await box(page, testid)
        // 26px halves as tall as a picker (1.5rem, which the root font size scales).
        expect(step.width).toBe(26)
        expect(step.height).toBeLessThanOrEqual(32)
      }
    }

    const handle = await box(page, 'frame-move-handle')
    const pencil = await box(page, 'frame-edit-toggle')

    for (const [drawn, px] of [[handle.width, 56], [handle.height, 28], [pencil.width, 28], [pencil.height, 28]]) expect(drawn).toBeCloseTo(px * scale, 1)
    expect(overlaps(handle, pencil)).toBe(false)
    await context.close()
  })
}

test('a popover opened from the sheet stays on its button as the canvas is panned, and the handle keeps its size', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 40, rows: 12 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 100)
  await page.getByTestId('margin-frame-tools').first().click()
  await settle(page)

  const before = { popover: await box(page, 'frame-popover'), button: await box(page, 'margin-frame-tools') }
  await page.locator('.app-shell__canvas-scroll').evaluate((element) => element.scrollBy(-60, 40))
  await page.waitForTimeout(100)
  const after = { popover: await box(page, 'frame-popover'), button: await box(page, 'margin-frame-tools'), handle: await box(page, 'frame-move-handle') }

  // Its top-layer popover follows its button (MarginSheet card, As built 0698), the distance it was from it.
  expect(after.popover.x - after.button.x).toBeCloseTo(before.popover.x - before.button.x, 0)
  expect(after.popover.y - after.button.y).toBeCloseTo(before.popover.y - before.button.y, 0)
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

// Under 0.6 of a 31px band nothing of the sheet is drawn but the Move bar, on the Frame's top edge (ticket 0682), and the
// Frame tools button beside it (ticket 1164): the bar still drags the Frame, the button opens every Frame tool, and a
// press on the Frame's first row, by mouse or by finger, reaches the bead, not either of them.
for (const touch of [false, true]) {
  for (const zoom of [10, 20]) {
    test(`the bare sheet's Move bar drags the Frame, its Frame tools button opens, and both leave the first row to the beads, at ${zoom}%${touch ? ', by touch' : ''}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce', hasTouch: touch })
      const page = await context.newPage()
      await openApp(page, [fixtureProject({ technique: 'loom', columns: 40, rows: 12, blank: true })])
      await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
      await setZoom(page, zoom)
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch)
      await expect(page.getByTestId('margin-handle')).toHaveCount(1)
      await expect(page.getByTestId('margin-band')).toHaveCount(0)

      // A press on the first row's middle bead, just under the bar, paints it.
      const before = placeOf(await savedProject(page))
      const bead = beadCentre({ technique: 'loom', rotation: 0 }, await gridBox(page), zoom / 100, { row: before.row, column: before.column + 20 })
      if (touch) await tap(page, bead)
      else await page.mouse.click(bead.x, bead.y)
      await expect.poll(async () => frameGrid(await savedProject(page))[0]![20]!.color).not.toBeNull()

      // So does a press on the first row's bead under the Frame tools button (at 10% it stands past the Frame's 40
      // columns, over no bead), which opens its menu itself.
      const tools = page.getByTestId('margin-handle').getByTestId('margin-frame-tools')
      const toolsBox = (await tools.boundingBox())!
      const grid = await gridBox(page)
      const centreOf = (column: number) => beadCentre({ technique: 'loom', rotation: 0 }, grid, zoom / 100, { row: before.row, column: before.column + column })
      const pitch = centreOf(1).x - centreOf(0).x
      const under = Math.round((toolsBox.x + toolsBox.width / 2 - centreOf(0).x) / pitch)
      // 4px right of the Move bar, 10px on a coarse pointer so the two 44px hit areas never overlap.
      expect(under).toBe({ 10: touch ? 46 : 42, 20: touch ? 33 : 31 }[zoom])
      if (under < 40) {
        const beadUnder = centreOf(under)
        if (touch) await tap(page, beadUnder)
        else await page.mouse.click(beadUnder.x, beadUnder.y)
        await expect.poll(async () => frameGrid(await savedProject(page))[0]![under]!.color).not.toBeNull()
      }
      await tools.click()
      await expect(page.getByTestId('margin-frame-tools-color')).toBeVisible()
      await page.keyboard.press('Escape')

      // The Move bar drags the Frame 10 beads right (a bead is 20px at 100%).
      const handle = await box(page, 'frame-move-handle')
      const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(from.x + 200 * (zoom / 100), from.y, { steps: 10 })
      await page.mouse.up()
      await expect.poll(async () => placeOf(await savedProject(page)).column).toBe(before.column + 10)
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

/** Whether a press that landed on `testid` is inside the element marked `owner`, or is that element. */
async function inside(page: Page, owner: string, testid: string): Promise<boolean> {
  return testid === owner || (await page.getByTestId(owner).getByTestId(testid).count()) > 0
}

/** What a press at the middle of each of a box's 12px squares lands on, past its rounded corners: the testid of the
 * nearest marked element. */
async function landsOn(page: Page, area: Box, inset: number): Promise<string[]> {
  return page.evaluate(({ area, inset }) => {
    const hits: string[] = []
    for (let x = area.x + inset; x < area.x + area.width - inset; x += 12) {
      for (let y = area.y + inset; y < area.y + area.height - inset; y += 12) {
        hits.push(document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid') ?? 'none')
      }
    }
    return hits
  }, { area, inset })
}

// The Tool pill and its color popover float over the drawing, the margin sheet included (StackingOrder card): the
// sheet's foot, wider at its scale (ticket 0698), used to be drawn over them and take none of their presses.
test('the Tool pill and its color popover are drawn over the margin sheet, whose other controls still take a press', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 30, rows: 20 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  // Fit keeps the sheet clear of the pill (ticket 0850): the Canvas is moved down by hand until its foot lies under it.
  const surface = await box(page, 'project-surface')
  await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2)
  await page.mouse.wheel(0, -90)
  await settle(page)
  await openColorPopover(page)

  const foot = await box(page, 'margin-foot')
  const pill = await box(page, 'tool-pill')
  const popover = await box(page, 'color-popover')
  expect(overlaps(foot, pill) && overlaps(foot, popover), 'the foot lies under the pill and the popover').toBe(true)

  for (const [owner, area, inset] of [['tool-pill-layer', pill, pill.height / 2], ['color-popover', popover, 16]] as const) {
    for (const hit of new Set(await landsOn(page, area, inset))) expect(await inside(page, owner, hit), `a press there lands on ${hit}`).toBe(true)
  }
  // Row done, at the end of Row progress in the foot (ticket 1176), stands clear of the pill: it takes
  // its press.
  const done = await box(page, 'margin-progress-next')
  expect(overlaps(done, pill) || overlaps(done, popover)).toBe(false)
  expect(await landsOn(page, { x: done.x + done.width / 2 - 1, y: done.y + done.height / 2 - 1, width: 2, height: 2 }, 0)).toEqual(['margin-progress-next'])
  await context.close()
})

// An iPad held sideways with the pill on the right: the color popover reaches down past the bottom, and the picker
// opened in it was drawn under the bar (ticket 0726). It is now the Add another color popover beside it (ticket 1226),
// over the bars too, and on a screen too short for it, it scrolls to its last field.
test('the Add another color popover beside a right-hand pill stands beside the Palette popover, takes its presses, and scrolls on a short screen', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce', hasTouch: true })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('openbeads:tool-pill-position', 'right'))
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 30, rows: 30 })])
  await settle(page)
  await openColorPopover(page)
  await page.getByTestId('add-color-button').click()
  await page.getByTestId('add-color-tabs').locator('[data-value="custom"]').click()
  await settle(page)

  const popover = await box(page, 'add-color-popover')
  const palette = await box(page, 'color-popover')
  expect(popover.x + popover.width, 'it stands beside the Palette popover, not over it').toBeLessThanOrEqual(palette.x)
  for (const hit of new Set(await landsOn(page, popover, 16))) expect(await inside(page, 'add-color-popover', hit), `a press there lands on ${hit}`).toBe(true)

  const short = 300
  await page.setViewportSize({ width: 1024, height: short })
  await settle(page)
  const scroller = page.getByTestId('add-color-popover')
  expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight), 'the popover scrolls').toBe(true)
  const shown = await box(page, 'add-color-popover')
  expect(shown.y + shown.height).toBeLessThanOrEqual(short)
  // The tab is as tall as the Bead colors list, so its own last control isn't at the scroll's end.
  const last = page.getByTestId('basic-color').last()
  await last.scrollIntoViewIfNeeded()
  await settle(page)
  const reached = (await last.boundingBox())!
  expect(reached.y, 'the last basic color is scrolled into view').toBeGreaterThanOrEqual(shown.y)
  expect(reached.y + reached.height).toBeLessThanOrEqual(shown.y + shown.height)
  await context.close()
})

// A code pressed in the Bead colors list is the current color at once and the popover stays open with its list; a second
// press on the same row takes it out again (ticket 1092).
test('a Bead color pressed in the list joins the Palette as the current color, the list staying open, and a second press takes it out', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await settle(page)
  await openColorPopover(page)
  await page.getByTestId('add-color-button').click()
  const row = page.locator('[data-testid="bead-color"]:not([data-held])').first()
  const code = (await row.getAttribute('data-code'))!
  const held = page.locator(`[data-testid="bead-color"][data-code="${code}"]`)
  const swatches = await page.getByTestId('palette-swatch').count()

  await row.click()
  await expect(held).toHaveAttribute('data-held', 'held')
  await expect(page.getByTestId('color-popover-name')).toContainText(code)
  await expect(page.getByTestId('bead-colors')).toBeVisible()
  await expect(page.getByTestId('palette-swatch')).toHaveCount(swatches + 1)

  await held.click()
  await expect(held).not.toHaveAttribute('data-held')
  await expect(page.getByTestId('palette-swatch')).toHaveCount(swatches)
  await expect(page.getByTestId('bead-colors')).toBeVisible()
  await context.close()
})

test('the wheel over the margin sheet\'s legend zooms and moves the Table, as over the beads', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 40, rows: 12 })])
  const surface = page.getByTestId('project-surface')
  await setZoom(page, 100)
  const read = async () => ({ zoom: Number(await surface.getAttribute('data-zoom')), x: await surface.getAttribute('data-scroll-x'), y: await surface.getAttribute('data-scroll-y') })

  const legend = await box(page, 'margin-legend')
  await page.mouse.move(legend.x + legend.width / 2, legend.y + legend.height / 2)
  const before = await read()
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -20)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await read()).zoom).toBeGreaterThan(before.zoom)

  const zoomed = await read()
  await page.mouse.wheel(0, 40)
  await expect.poll(async () => (await read()).y).not.toBe(zoomed.y)

  // The Tool pill floats on the drawing area, the other layer over the Table.
  const pill = await box(page, 'tool-pill')
  await page.mouse.move(pill.x + pill.width / 2, pill.y + pill.height / 2)
  const scrolled = await read()
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -20)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await read()).zoom).toBeGreaterThan(scrolled.zoom)
  await context.close()
})
