import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { PALETTE } from '../../src/domain/palette'
import { decodePattern, type EncodedPattern } from '../../src/domain/patternEncoding'
import { parsePatternsFile } from '../../src/domain/patternFile'
import { openApp, settle } from '../support/app'
import { beadCentre } from '../support/patterns'
import { fixturePicture } from '../support/picture'

/**
 * Ticket 108: with the limit on size gone (ADR 0019), a 70 × 250 bracelet and a 250 × 250 Pattern can be created,
 * edited, saved, reloaded, exported as a Pattern file and undone, and a full device still says so and keeps the edit on
 * screen. In a real browser, on the renderer (the default), at the size the Pattern opens at.
 */
const RED = PALETTE.find((color) => color.id === 'red')!.hex
const SIZES = [
  { columns: 70, rows: 250 },
  { columns: 250, rows: 250 },
]

async function createPattern(page: Page, columns: number, rows: number): Promise<void> {
  await openApp(page, [])
  await page.getByTestId('width-input').fill(String(columns))
  await page.getByTestId('height-input').fill(String(rows))
  await page.locator('button[type="submit"]').click()
  await expect(page.getByTestId('pattern-surface-cells')).toHaveCount(1)
  await page.getByTestId('pattern-surface').scrollIntoViewIfNeeded()
  await settle(page)
}

/** The beads of the first rows are on screen at any zoom; this one is a few beads in from the corner. */
async function firstBeadPoint(page: Page, row: number, column: number) {
  const zoom = Number.parseInt((await page.getByTestId('zoom-level').textContent())!, 10) / 100
  const box = (await page.getByTestId('pattern-surface').boundingBox())!
  return beadCentre({ technique: 'loom', rotation: 0 }, box, zoom, { row, column })
}

async function savedPattern(page: Page) {
  await page.getByTestId('save-button').click()
  const library = JSON.parse((await page.evaluate(() => localStorage.getItem('bd-beads:patterns')))!) as { patterns: EncodedPattern[] }
  return decodePattern(library.patterns[0]!)
}

for (const { columns, rows } of SIZES) {
  test.describe(`${columns} × ${rows}`, () => {
    test('is created at that size, with nothing said against it', async ({ page }) => {
      await createPattern(page, columns, rows)

      const saved = await savedPattern(page)
      expect([saved.columns, saved.rows]).toEqual([columns, rows])
      expect(saved.grid).toHaveLength(rows)
      expect(saved.grid.every((cells) => cells.length === columns)).toBe(true)
      await expect(page.getByTestId('size-cap-message')).toHaveCount(0)
    })

    test('is painted, saved, reloaded and exported as a Pattern file', async ({ page }) => {
      await createPattern(page, columns, rows)

      const at = await firstBeadPoint(page, 2, 3)
      await page.mouse.click(at.x, at.y)
      expect((await savedPattern(page)).grid[2]![3]!.color).toBe(RED)

      // Reloaded, it opens as it was left.
      await page.reload()
      await expect(page.getByTestId('pattern-surface-cells')).toHaveCount(1)
      const reloaded = await savedPattern(page)
      expect([reloaded.columns, reloaded.rows]).toEqual([columns, rows])
      expect(reloaded.grid[2]![3]!.color).toBe(RED)

      // The whole Pattern goes out in a Pattern file, and reads back the same. Export Pattern is in Saved Patterns'
      // footer (ticket 147; ExpandablePanel), which only renders once expanded.
      await page.getByTestId('pattern-list').getByTestId('panel-expand').click()
      const download = page.waitForEvent('download')
      await page.getByTestId('export-pattern').click()
      const file = readFileSync((await (await download).path())!, 'utf8')
      const exported = parsePatternsFile(file).patterns[0]!
      expect([exported.columns, exported.rows]).toEqual([columns, rows])
      expect(exported.grid[2]![3]!.color).toBe(RED)
      expect(exported.grid.flat().filter((cell) => cell.color !== null)).toHaveLength(1)
    })

    test('has a stroke undone, and redone', async ({ page }) => {
      await createPattern(page, columns, rows)

      const start = await firstBeadPoint(page, 2, 3)
      const end = await firstBeadPoint(page, 2, 12)
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(end.x, end.y, { steps: 20 })
      await page.mouse.up()
      expect((await savedPattern(page)).grid.flat().filter((cell) => cell.color === RED).length).toBeGreaterThan(3)

      await page.getByTestId('undo-button').click()
      expect((await savedPattern(page)).grid.flat().every((cell) => cell.color === null)).toBe(true)

      await page.getByTestId('redo-button').click()
      expect((await savedPattern(page)).grid[2]![3]!.color).toBe(RED)
    })

    test('a full device says the change is not saved, and keeps it on screen', async ({ page }) => {
      await createPattern(page, columns, rows)
      await page.evaluate(() => {
        Storage.prototype.setItem = () => {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
        }
      })

      const at = await firstBeadPoint(page, 2, 3)
      await page.mouse.click(at.x, at.y)
      await settle(page)

      await expect(page.getByTestId('save-failed-message')).toBeVisible()
      await settle(page)
      // The bead is drawn: its centre is the color it was painted. The notice row under the header has pushed the canvas
      // box down (ticket 141), so the bead is found again where it is now.
      const now = await firstBeadPoint(page, 2, 3)
      const box = (await page.getByTestId('pattern-surface').boundingBox())!
      const shot = PNG.sync.read(await page.screenshot({ clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) } }))
      const x = Math.floor(now.x - Math.floor(box.x))
      const y = Math.floor(now.y - Math.floor(box.y))
      const pixel = [0, 1, 2].map((channel) => shot.data[(y * shot.width + x) * 4 + channel]!)
      const expected = [1, 3, 5].map((index) => Number.parseInt(RED.slice(index, index + 2), 16))
      expect(pixel.every((value, index) => Math.abs(value - expected[index]!) <= 10)).toBe(true)
    })
  })
}

test('Convert image can frame a picture at 250 × 250, where it was once refused', async ({ page }) => {
  await openApp(page, [])
  await page.getByTestId('width-input').fill('250')
  await page.getByTestId('height-input').fill('250')
  await page.getByTestId('convert-image-input').setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: fixturePicture(480, 320) })

  const preview = page.getByTestId('convert-image-box')
  await expect(preview).toBeVisible()
  await page.getByTestId('convert-image-create').click()

  await expect(page.getByTestId('pattern-surface-cells')).toHaveCount(1)
  const saved = await savedPattern(page)
  expect([saved.columns, saved.rows]).toEqual([250, 250])
  expect(saved.grid.flat().some((cell) => cell.color !== null)).toBe(true)
})
