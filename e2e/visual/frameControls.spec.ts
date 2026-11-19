import { expect, test, type Page } from '@playwright/test'
import { currentZoomPercent, gridBox, openApp, openColorPopover, savedProject, settle, setZoom } from '../support/app'
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

for (const [name, viewport, hasTouch] of [['iPad', { width: 1366, height: 1024 }, true], ['laptop', { width: 1470, height: 956 }, false]] as const) {
  test(`opening the Frame panel pans the Frame beside it, not under it, and closing puts it back, on the ${name} (ticket 0971)`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport, hasTouch, reducedMotion: 'reduce' })
    const page = await context.newPage()
    // The Summer bracelet's size at 100%: 24 columns, which the panel covered 21 of. (Its fit is larger, ticket 0964.)
    await openApp(page, [fixtureProject({ technique: 'loom', columns: 24, rows: 10 })])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, 100)
    const surface = await box(page, 'project-surface')
    const closed = await box(page, 'frame-edit-toggle')
    await page.getByTestId('strip-frame').click()
    await settle(page)
    const panel = await box(page, 'panel-dropdown')
    // The canvas is not pushed; the view moves under it, so the Frame's columns, the first one too, lie right of the panel.
    expect(await box(page, 'project-surface')).toEqual(surface)
    const zoom = (await currentZoomPercent(page)) / 100
    const grid = await gridBox(page)
    const frame = frameOf(await savedProject(page))!
    const first = beadCentre({ technique: 'loom', rotation: 0 }, grid, zoom, { row: frame.row, column: frame.column })
    const last = beadCentre({ technique: 'loom', rotation: 0 }, grid, zoom, { row: frame.row, column: frame.column + frame.columns - 1 })
    expect(first.x).toBeGreaterThan(panel.x + panel.width)
    expect(last.x).toBeLessThan(viewport.width)

    await page.keyboard.press('Escape')
    await settle(page)
    expect(await box(page, 'frame-edit-toggle')).toEqual(closed)
    await context.close()
  })
}

test('closing the Frame panel leaves a view the person moved where they left it (ticket 0971)', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1366, height: 1024 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 24, rows: 10 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await settle(page)
  await page.getByTestId('strip-frame').click()
  await settle(page)
  // A wheel over the Canvas beside the panel pans it, as a person's own move.
  await page.mouse.move(1200, 500)
  await page.mouse.wheel(40, 0)
  await settle(page)
  const moved = await box(page, 'frame-edit-toggle')
  await page.keyboard.press('Escape')
  await settle(page)
  expect(await box(page, 'frame-edit-toggle')).toEqual(moved)
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

// From 130% a loom Frame's band is 104px and its title block roomy (ticket 1015): the Bead with Change, whose pickers
// ask the Frame panel's own question.
test('the roomy title block names the Bead, and a pick from Change asks "Replace bead?"', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 40 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await setZoom(page, 150)
  await expect(page.getByTestId('margin-title')).toHaveAttribute('data-form', 'roomy')

  await page.getByTestId('margin-bead-change').click()
  const pickers = page.getByTestId('margin-bead-popover')
  await expect(pickers).toBeVisible()
  await pickers.getByTestId('bead-brand').getByRole('button').first().click()
  await pickers.locator('[role="menuitemradio"][aria-checked="false"]').first().click()
  await expect(page.getByTestId('replace-bead-modal')).toBeVisible()
  await expect(pickers).toHaveCount(0)
  await context.close()
})

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
// sheet's title block, wider at its scale (ticket 0698), used to be drawn over them and take none of their presses.
test('the Tool pill and its color popover are drawn over the margin sheet, whose other controls still take a press', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 30, rows: 30 })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  // Fit keeps the sheet clear of the pill (ticket 0850): the Canvas is moved down by hand until its title block lies under it.
  const surface = await box(page, 'project-surface')
  await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2)
  await page.mouse.wheel(0, -60)
  await settle(page)
  await openColorPopover(page)

  const title = await box(page, 'margin-title-block')
  const pill = await box(page, 'tool-pill')
  const popover = await box(page, 'color-popover')
  expect(overlaps(title, pill) && overlaps(title, popover), 'the title block lies under the pill and the popover').toBe(true)

  for (const [owner, area, inset] of [['tool-pill-layer', pill, pill.height / 2], ['color-popover', popover, 16]] as const) {
    for (const hit of new Set(await landsOn(page, area, inset))) expect(await inside(page, owner, hit), `a press there lands on ${hit}`).toBe(true)
  }
  // The fold button stands clear of the pill: it takes its press.
  const fold = await box(page, 'margin-title-fold')
  expect(overlaps(fold, pill) || overlaps(fold, popover)).toBe(false)
  expect(await landsOn(page, { x: fold.x + fold.width / 2 - 1, y: fold.y + fold.height / 2 - 1, width: 2, height: 2 }, 0)).toEqual(['margin-title-fold'])
  await context.close()
})

// An iPad held sideways with the pill on the right: the color popover reaches down past the Progress bar, and the Custom
// color picker opened in it was drawn under the bar, out of reach (ticket 0726). It sits over the canvas box's bars, and
// on a screen too short for it, it scrolls to its last field.
test('the Custom color picker beside a right-hand pill is drawn over the Progress bar, and scrolls on a short screen', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce', hasTouch: true })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('openbeads:tool-pill-position', 'right'))
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 30, rows: 30 })])
  await settle(page)
  await openColorPopover(page)
  await page.getByTestId('custom-color-button').click()
  await settle(page)

  const popover = await box(page, 'color-popover')
  expect(overlaps(popover, await box(page, 'progress-bar')), 'the popover reaches over the Progress bar').toBe(true)
  for (const hit of new Set(await landsOn(page, popover, 16))) expect(await inside(page, 'color-popover', hit), `a press there lands on ${hit}`).toBe(true)

  const short = 420
  await page.setViewportSize({ width: 1024, height: short })
  await settle(page)
  const scroller = page.getByTestId('color-popover')
  expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight), 'the popover scrolls').toBe(true)
  const shown = await box(page, 'color-popover')
  expect(shown.y + shown.height).toBeLessThanOrEqual(short)
  await scroller.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await settle(page)
  const hex = await box(page, 'custom-color-hex')
  expect(hex.y, 'the hex field is scrolled into view').toBeGreaterThanOrEqual(shown.y)
  expect(hex.y + hex.height).toBeLessThanOrEqual(shown.y + shown.height)
  await context.close()
})

// "Add {bead} colors" keeps its place on the screen while its list opens and closes (ticket 1092), so a second press in
// the same place undoes the first: beside a pill at any edge, and on a screen too short for the whole list, where the
// popover is cut at the screen's edge and scrolls inside itself.
for (const [position, width, height] of [
  ['bottom', 1400, 900],
  ['top', 1400, 900],
  ['left', 1024, 560],
  ['right', 1024, 560],
] as const) {
  test(`Add colors stays under the press while its list opens and closes, pill at the ${position}, ${width}×${height}`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light', viewport: { width, height }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.addInitScript((value) => localStorage.setItem('openbeads:tool-pill-position', value), position)
    await openApp(page, [fixtureProject({ technique: 'loom' })])
    await settle(page)
    await openColorPopover(page)
    const popover = page.getByTestId('color-popover')
    await popover.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)))

    const closed = await box(page, 'bead-colors-toggle')
    const press = { x: closed.x + closed.width - 12, y: closed.y + closed.height / 2 }
    await page.mouse.click(press.x, press.y)
    await expect(page.getByTestId('bead-colors')).toBeVisible()
    await settle(page)
    const open = await box(page, 'bead-colors-toggle')
    const shown = await box(page, 'color-popover')
    for (const side of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(open[side] - closed[side]), `the button's ${side} with the list open`).toBeLessThanOrEqual(1)
    expect(shown.y, 'the popover stays on the screen').toBeGreaterThanOrEqual(0)
    expect(shown.y + shown.height).toBeLessThanOrEqual(height)

    await page.mouse.click(press.x, press.y)
    await expect(page.getByTestId('bead-colors')).toHaveCount(0)
    await settle(page)
    const again = await box(page, 'bead-colors-toggle')
    for (const side of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(again[side] - closed[side]), `the button's ${side} with the list closed again`).toBeLessThanOrEqual(1)
    await context.close()
  })
}

// A code pressed in the Bead colors list is the current color at once and the popover stays open with its list; a second
// press on the same row takes it out again (ticket 1092).
test('a Bead color pressed in the list joins the Palette as the current color, the list staying open, and a second press takes it out', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openApp(page, [fixtureProject({ technique: 'loom' })])
  await settle(page)
  await openColorPopover(page)
  await page.getByTestId('bead-colors-toggle').click()
  const row = page.locator('[data-testid="bead-color"]:not([data-taken])').first()
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
