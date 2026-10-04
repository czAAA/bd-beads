import { frameGrid } from '../../src/domain/project'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import type { Technique } from '../../src/domain/grid'
import { normalizeProject } from '../../src/domain/project'
import { decodeProject } from '../../src/domain/projectEncoding'
import type { EncodedProject } from '../../src/domain/projectEncoding'
import { PALETTE } from '../../src/domain/palette'
import { gridBox, openApp, projectBox, setZoom, settle } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { MAX_DIFFERING_BLOCKS, compareToReference, shownRegion, UPDATING_REFERENCES, writeReference, zoomsFor } from '../support/referenceCheck'

/**
 * The pointer tools on the Drawing surface, in a real browser: the hover preview looks as the references have it, and
 * painting, erasing, Fill, the Row progress lock, Undo, Space-drag pan and a touch stroke paint the beads they should
 * and no others (ticket 174 hid Mirror's own UI pending its own redesign).
 */
const REFERENCES = fileURLToPath(new URL('./__screenshots__/', import.meta.url))
const DEFAULT_COLOR = PALETTE.find((color) => color.id === 'red')!.hex

/** The Project the app has saved, read back the way it is stored. */
async function savedProject(page: Page) {
  await page.getByTestId('save-button').click()
  const stored = await page.evaluate(() => localStorage.getItem('bd-beads:patterns'))
  const library = JSON.parse(stored!) as { patterns: EncodedProject[] }
  return normalizeProject(decodeProject(library.patterns[0]!))
}

/** Where the pointer goes to be on a bead, at the zoom the page is at. */
async function pointOn(page: Page, technique: Technique, rotated: boolean, zoomPercent: number, row: number, column: number) {
  return beadCentre({ technique, rotation: rotated ? 90 : 0 }, await gridBox(page), zoomPercent / 100, { row, column })
}

const colorAt = (project: Awaited<ReturnType<typeof savedProject>>, row: number, column: number) => frameGrid(project)[row]![column]!.color

test.describe('the hover preview', () => {
  const scenarios = [
    { name: 'loom-hover-paint', technique: 'loom' as const, tool: undefined },
    { name: 'peyote-hover-paint', technique: 'peyote' as const, tool: undefined },
    { name: 'brick-hover-paint', technique: 'brick' as const, tool: undefined },
    { name: 'peyote-hover-erase', technique: 'peyote' as const, tool: 'tool-erase' },
  ]

  for (const scenario of scenarios) {
    for (const rotated of [false, true]) {
      const orientation = rotated ? 'rotated' : 'upright'

      test(`${scenario.name}, ${orientation}`, async ({ page }) => {
        const project = fixtureProject({ technique: scenario.technique, rotation: rotated ? 90 : 0 })
        await openApp(page, [project])
        if (scenario.tool) {
          await page.getByTestId(scenario.tool).click()
        }

        for (const zoom of zoomsFor(rotated)) {
          await setZoom(page, zoom)
          const at = await pointOn(page, scenario.technique, rotated, zoom, 3, 5)
          await page.mouse.move(at.x, at.y)
          await settle(page)

          const box = (await page.getByTestId('project-surface').boundingBox())!
          const reference = `${REFERENCES}${scenario.name}-${orientation}-${zoom}.png`
          const corner = await projectBox(page, box)
          if (UPDATING_REFERENCES) await writeReference(page, reference, shownRegion(corner, project, zoom / 100))
          const expected = readFileSync(reference)
          const { width, height } = PNG.sync.read(expected)
          const origin = shownRegion(corner, project, zoom / 100)
          const actual = await page.screenshot({ clip: { ...origin, width, height } })

          const label = `${scenario.name}, ${orientation}, ${zoom}%`
          // The hovered bead's centre carries the preview, which is what is being looked at, not a wrong color.
          const { look, wrong } = compareToReference(actual, expected, project, zoom, corner, origin, new Set(['(3, 5)']))
          expect.soft(look, `${label}: look`).toBeLessThanOrEqual(MAX_DIFFERING_BLOCKS[scenario.technique])
          expect.soft(wrong, `${label}: beads in the wrong color`).toEqual([])
        }
      })
    }
  }
})

test.describe('the pointer tools', () => {
  async function openBlank(page: Page, technique: Technique = 'loom', rotated = false, extra: Parameters<typeof fixtureProject>[0] = { technique }) {
    const project = fixtureProject({ ...extra, technique, rotation: rotated ? 90 : 0, blank: true })
    await openApp(page, [project])
    await setZoom(page, 100)
    return project
  }

  for (const technique of ['loom', 'peyote', 'brick'] as const) {
    for (const rotated of [false, true]) {
      test(`a click paints the bead under the pointer, ${technique}${rotated ? ', rotated' : ''}`, async ({ page }) => {
        await openBlank(page, technique, rotated)

        const at = await pointOn(page, technique, rotated, 100, 4, 7)
        await page.mouse.click(at.x, at.y)

        const saved = await savedProject(page)
        expect(colorAt(saved, 4, 7)).toBe(DEFAULT_COLOR)
        expect(frameGrid(saved).flat().filter((cell) => cell.color !== null)).toHaveLength(1)
      })
    }
  }

  test('a dragged stroke paints every bead it crosses, and is one undo step', async ({ page }) => {
    await openBlank(page)

    const start = await pointOn(page, 'loom', false, 100, 2, 1)
    const end = await pointOn(page, 'loom', false, 100, 2, 6)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 20 })
    await page.mouse.up()

    const saved = await savedProject(page)
    expect([1, 2, 3, 4, 5, 6].map((column) => colorAt(saved, 2, column))).toEqual(Array(6).fill(DEFAULT_COLOR))
    expect(colorAt(saved, 2, 0)).toBeNull()

    await page.getByTestId('undo-button').click()
    expect(frameGrid((await savedProject(page))).flat().every((cell) => cell.color === null)).toBe(true)
  })

  test('a right click erases, and a right-button drag erases a stroke', async ({ page }) => {
    const project = fixtureProject({ technique: 'loom' })
    await openApp(page, [project])
    await setZoom(page, 100)

    const at = await pointOn(page, 'loom', false, 100, 4, 7)
    await page.mouse.click(at.x, at.y, { button: 'right' })
    const after = await pointOn(page, 'loom', false, 100, 4, 10)
    await page.mouse.move(after.x, after.y)
    await page.mouse.down({ button: 'right' })
    const end = await pointOn(page, 'loom', false, 100, 4, 13)
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await page.mouse.up({ button: 'right' })

    const saved = await savedProject(page)
    expect([7, 10, 11, 12, 13].map((column) => colorAt(saved, 4, column))).toEqual(Array(5).fill(null))
    // What was not touched is as it was.
    expect(colorAt(saved, 4, 8)).toBe(frameGrid(project)[4]![8]!.color)
  })

  test('the Fill tool fills the area under a click', async ({ page }) => {
    await openBlank(page)
    await page.getByTestId('tool-fill').click()

    const at = await pointOn(page, 'loom', false, 100, 4, 7)
    await page.mouse.click(at.x, at.y)

    expect(frameGrid((await savedProject(page))).flat().every((cell) => cell.color === DEFAULT_COLOR)).toBe(true)
  })

  test('the Erase tool erases with the left button', async ({ page }) => {
    const project = fixtureProject({ technique: 'peyote' })
    await openApp(page, [project])
    await setZoom(page, 100)
    await page.getByTestId('tool-erase').click()

    const at = await pointOn(page, 'peyote', false, 100, 3, 5)
    await page.mouse.click(at.x, at.y)

    expect(colorAt(await savedProject(page), 3, 5)).toBeNull()
  })

  test('finished rows are never touched, and the row being woven is', async ({ page }) => {
    const project = await openBlank(page, 'loom', false, {
      technique: 'loom',
      rowProgress: { enabled: true, direction: 'rows', currentRow: 4 },
    })

    for (const row of [1, 4]) {
      const at = await pointOn(page, 'loom', false, 100, row, 3)
      await page.mouse.click(at.x, at.y)
    }

    const saved = await savedProject(page)
    expect(colorAt(saved, 1, 3)).toBeNull()
    expect(colorAt(saved, 4, 3)).toBe(DEFAULT_COLOR)
    expect(frameGrid(project)[1]![3]!.color).toBeNull()
  })

  test('holding Space and dragging pans instead of painting', async ({ page }) => {
    await openBlank(page)

    await page.keyboard.down('Space')
    const start = await pointOn(page, 'loom', false, 100, 2, 2)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    const end = await pointOn(page, 'loom', false, 100, 2, 8)
    await page.mouse.move(end.x, end.y, { steps: 10 })
    await page.mouse.up()
    await page.keyboard.up('Space')

    expect(frameGrid((await savedProject(page))).flat().every((cell) => cell.color === null)).toBe(true)
  })
})

test.describe('touch', () => {
  test.use({ hasTouch: true })

  test('a touch stroke paints the beads it crosses and does not scroll the page', async ({ page }) => {
    // The page itself never scrolls (ticket 141), so a stroke that scrolled it instead would be seen at once. 40 rows fit
    // the drawing area at 100%, the level this test strokes at.
    const project = fixtureProject({ technique: 'loom', rows: 40, blank: true })
    await openApp(page, [project])
    await setZoom(page, 100)
    const cdp = await page.context().newCDPSession(page)

    const start = await pointOn(page, 'loom', false, 100, 3, 4)
    const end = await pointOn(page, 'loom', false, 100, 12, 4)
    const scrolledBefore = await page.evaluate(() => window.scrollY)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] })
    for (let step = 1; step <= 18; step += 1) {
      const y = start.y + ((end.y - start.y) * step) / 18
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    const saved = await savedProject(page)
    expect([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((row) => colorAt(saved, row, 4))).toEqual(Array(10).fill(DEFAULT_COLOR))
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolledBefore)
  })
})
