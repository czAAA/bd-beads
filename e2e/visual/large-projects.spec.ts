import { frameGrid } from '../../src/domain/project'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { PALETTE } from '../../src/domain/palette'
import { createProject, normalizeProject } from '../../src/domain/project'
import { decodeProject, type EncodedProject } from '../../src/domain/projectEncoding'
import { parseProjectsFile } from '../../src/domain/projectFile'
import { openApp, projectBox, settle, stateConvertSize } from '../support/app'
import { beadCentre } from '../support/projects'
import { fixturePicture } from '../support/picture'

/**
 * Ticket 108: with the limit on size gone (ADR 0019), a 70 × 250 bracelet and a 250 × 250 Project can be created,
 * edited, saved, reloaded, exported as a Project file and undone, and a full device still says so and keeps the edit on
 * screen. In a real browser, on the renderer (the default), at the size the Project opens at.
 */
const RED = PALETTE.find((color) => color.id === 'red')!.hex
const SIZES = [
  { columns: 70, rows: 250 },
  { columns: 250, rows: 250 },
]

async function openSized(page: Page, columns: number, rows: number): Promise<void> {
  // The New Project form states no size any more (ticket 342): the Project starts saved with its Frame, as one reopened.
  await openApp(page, [createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await page.getByTestId('project-surface').scrollIntoViewIfNeeded()
  await settle(page)
  await showTopLeft(page)
}

/** A new Project opens centred on its Frame, which for a tall one is far from its first rows: wheel the canvas to bring them into view. */
async function showTopLeft(page: Page): Promise<void> {
  const surface = page.getByTestId('project-surface')
  const box = (await surface.boundingBox())!
  const margin = 40
  const dx = -margin - (Number(await surface.getAttribute('data-scroll-x')) || 0)
  const dy = -margin - (Number(await surface.getAttribute('data-scroll-y')) || 0)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(dx, dy)
  await settle(page)
}

/** The beads of the first rows are on screen at any zoom; this one is a few beads in from the corner. */
async function firstBeadPoint(page: Page, row: number, column: number) {
  const zoom = Number.parseInt((await page.getByTestId('zoom-level').textContent())!, 10) / 100
  const box = await projectBox(page, (await page.getByTestId('project-surface').boundingBox())!)
  return beadCentre({ technique: 'loom', rotation: 0 }, box, zoom, { row, column })
}

async function savedProject(page: Page) {
  await page.getByTestId('save-button').click()
  const library = JSON.parse((await page.evaluate(() => localStorage.getItem('bd-beads:patterns')))!) as { patterns: EncodedProject[] }
  return normalizeProject(decodeProject(library.patterns[0]!))
}

for (const { columns, rows } of SIZES) {
  test.describe(`${columns} × ${rows}`, () => {
    test('is created at that size, with nothing said against it', async ({ page }) => {
      await openSized(page, columns, rows)

      const saved = await savedProject(page)
      expect([saved.frame!.columns, saved.frame!.rows]).toEqual([columns, rows])
      expect(frameGrid(saved)).toHaveLength(rows)
      expect(frameGrid(saved).every((cells) => cells.length === columns)).toBe(true)
      await expect(page.getByTestId('size-cap-message')).toHaveCount(0)
    })

    test('is painted, saved, reloaded and exported as a Project file', async ({ page }) => {
      await openSized(page, columns, rows)

      const at = await firstBeadPoint(page, 2, 3)
      await page.mouse.click(at.x, at.y)
      expect(frameGrid((await savedProject(page)))[2]![3]!.color).toBe(RED)

      // Reloaded, it opens as it was left.
      await page.reload()
      await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
      const reloaded = await savedProject(page)
      expect([reloaded.frame!.columns, reloaded.frame!.rows]).toEqual([columns, rows])
      expect(frameGrid(reloaded)[2]![3]!.color).toBe(RED)

      // The whole Project goes out in a Project file, and reads back the same. Export Project is in Saved Projects'
      // footer (ticket 147; ExpandablePanel), which only renders once expanded.
      await page.getByTestId('project-list').getByTestId('panel-expand').click()
      const download = page.waitForEvent('download')
      await page.getByTestId('export-project').click()
      const file = readFileSync((await (await download).path())!, 'utf8')
      const exported = parseProjectsFile(file).projects[0]!
      expect([exported.frame!.columns, exported.frame!.rows]).toEqual([columns, rows])
      expect(frameGrid(exported)[2]![3]!.color).toBe(RED)
      expect(frameGrid(exported).flat().filter((cell) => cell.color !== null)).toHaveLength(1)
    })

    test('has a stroke undone, and redone', async ({ page }) => {
      await openSized(page, columns, rows)

      const start = await firstBeadPoint(page, 2, 3)
      const end = await firstBeadPoint(page, 2, 12)
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(end.x, end.y, { steps: 20 })
      await page.mouse.up()
      expect(frameGrid((await savedProject(page))).flat().filter((cell) => cell.color === RED).length).toBeGreaterThan(3)

      await page.getByTestId('undo-button').click()
      expect(frameGrid((await savedProject(page))).flat().every((cell) => cell.color === null)).toBe(true)

      await page.getByTestId('redo-button').click()
      expect(frameGrid((await savedProject(page)))[2]![3]!.color).toBe(RED)
    })

    test('a full device says the change is not saved, and keeps it on screen', async ({ page }) => {
      await openSized(page, columns, rows)
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
      await showTopLeft(page)
      const now = await firstBeadPoint(page, 2, 3)
      const box = (await page.getByTestId('project-surface').boundingBox())!
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
  await page.getByTestId('convert-image-input').setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: fixturePicture(480, 320) })
  await stateConvertSize(page, 250, 250)

  const preview = page.getByTestId('convert-image-box')
  await expect(preview).toBeVisible()
  await page.getByTestId('convert-image-create').click()

  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  const saved = await savedProject(page)
  expect([saved.frame!.columns, saved.frame!.rows]).toEqual([250, 250])
  expect(frameGrid(saved).flat().some((cell) => cell.color !== null)).toBe(true)
})
