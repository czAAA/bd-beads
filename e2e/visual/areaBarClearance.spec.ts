import { expect, test, type BrowserContextOptions, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { gridBox, openApp, selectTool, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { AREA_BAR_GAP_PX } from '../../src/rendering/frameHandles'

/** How far the top edge's handle, a 4px bar, stands out of the sheet's edge (MarginSheet card, hot corners). */
const EDGE_BAR_OUT_PX = 4

/** An Area's bar leaves its sheet's top handle drawn whole and grabbed where drawn (ticket 0833): light and dark (whose
 * bar has a border) and a touch screen (whose bar buttons reach past it), drawn by a mouse so all eight handles show. */
const LOOKS: [string, BrowserContextOptions][] = [
  ['mouse, light', { colorScheme: 'light' }],
  ['mouse, dark', { colorScheme: 'dark' }],
  ['touch screen, dark', { colorScheme: 'dark', hasTouch: true, deviceScaleFactor: 2 }],
]

/** The rows of one column of the page, as colours. */
async function column(page: Page, x: number, top: number, height: number, scale: number): Promise<string[]> {
  const png = PNG.sync.read(await page.screenshot({ clip: { x, y: top, width: 1, height } }))
  return Array.from({ length: height }, (_row, row) => {
    const at = row * scale * png.width * 4
    return `${png.data[at]},${png.data[at + 1]},${png.data[at + 2]}`
  })
}

for (const [name, look] of LOOKS) {
  test(`the Selection bar leaves the top handle drawn and pressable (${name})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce', ...look })
    const page = await context.newPage()
    const project = fixtureProject({ technique: 'brick', columns: 30, rows: 20, blank: true })
    await openApp(page, [project])
    await selectTool(page, 'select')
    const zoom = Number(await page.getByTestId('canvas-strip-zoom').getAttribute('data-zoom-percent')) / 100
    const box = await gridBox(page)
    const start = beadCentre(project, box, zoom, { row: 6, column: 6 })
    const end = beadCentre(project, box, zoom, { row: 12, column: 20 })
    /** The Select tool's marquee from one bead to another, as a person drags it. */
    const drag = async () => {
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(end.x, end.y, { steps: 12 })
      await page.mouse.up()
    }
    await drag()
    await page.mouse.move(5, 5)
    await settle(page)

    // The top handle stands at the sheet's top edge, under the bar's middle: where the column with the Selection
    // first differs from the same column without it, the bar hidden.
    const bar = page.getByTestId('context-bar')
    const placed = (await bar.boundingBox())!
    const x = Math.round(placed.x + placed.width / 2)
    const barBottom = placed.y + placed.height
    const from = Math.floor(barBottom - 20)
    const scale = look.deviceScaleFactor ?? 1
    await bar.evaluate((el) => ((el as HTMLElement).style.visibility = 'hidden'))
    await settle(page)
    const selected = await column(page, x, from, 60, scale)
    await bar.evaluate((el) => ((el as HTMLElement).style.visibility = ''))
    await page.keyboard.press('Escape')
    await settle(page)
    const bare = await column(page, x, from, 60, scale)
    const markTop = from + selected.findIndex((colour, row) => colour !== bare[row])
    expect(markTop, 'the top handle is drawn').toBeGreaterThan(from)

    // Drawn clear of the bar, the bar placed by its outer edge whatever its border: the gap less the handle, to a pixel's
    // anti-aliasing.
    expect(Math.abs(markTop - barBottom - (AREA_BAR_GAP_PX - EDGE_BAR_OUT_PX)), 'room between the bar and the top handle').toBeLessThanOrEqual(1.5)

    // Pressable where it is drawn: the handle's rows, and a little above, are the canvas's, which shows the resize
    // cursor there.
    await drag()
    await settle(page)
    for (let y = markTop - 2; y <= markTop + 4; y += 1) {
      const under = await page.evaluate(([px, py]) => (document.elementFromPoint(px!, py!) as HTMLElement | null)?.dataset.testid, [x, y + 0.5])
      expect(under, `what is under the top handle at ${y - markTop}px`).toBe('project-surface-overlay')
      await page.mouse.move(x, y + 0.5)
      expect(await page.getByTestId('project-surface').evaluate((el) => getComputedStyle(el).cursor), `the cursor at ${y - markTop}px`).toBe('ns-resize')
    }
    await context.close()
  })
}
