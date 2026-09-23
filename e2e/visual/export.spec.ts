import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { PALETTE } from '../../src/domain/palette'
import { PNG_BEAD_PX, PNG_MARGIN_PX, PNG_MAX_PIXELS } from '../../src/rendering/patternExport'
import { openApp } from '../support/app'
import { fixturePattern } from '../support/patterns'

/**
 * Tickets 73 and 74: a Pattern exported as a PNG picture and as a printable PDF, in a real browser, where the canvases
 * are real: the picture has the Pattern's beads in the right colors, and a Pattern far too big for one canvas still comes
 * out whole.
 */
async function downloadOf(page: Page, testId: string): Promise<{ name: string; bytes: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()])
  return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) }
}

function hex(png: PNG, x: number, y: number): string {
  const at = (y * png.width + x) * 4
  return `#${[0, 1, 2].map((channel) => png.data[at + channel]!.toString(16).padStart(2, '0')).join('')}`
}

test('PNG export draws each bead in its color, at a legible size, on white', async ({ page }) => {
  const pattern = fixturePattern({ technique: 'loom', columns: 12, rows: 8 })
  await openApp(page, [pattern])

  const { name, bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)

  expect(name).toBe('bd-beads-fixture-loom.png')
  expect([png.width, png.height]).toEqual([12 * PNG_BEAD_PX + PNG_MARGIN_PX * 2, 8 * PNG_BEAD_PX + PNG_MARGIN_PX * 2])
  expect(hex(png, 2, 2)).toBe('#ffffff')
  // The middle of the bead in row 3, column 2 (the rim is a pixel wide, so the middle is all its color).
  const painted = pattern.grid[3]![2]!.color
  expect(hex(png, PNG_MARGIN_PX + 2 * PNG_BEAD_PX + PNG_BEAD_PX / 2, PNG_MARGIN_PX + 3 * PNG_BEAD_PX + PNG_BEAD_PX / 2)).toBe(painted ?? '#c7cdd5')
  expect(PALETTE.some((color) => color.hex === painted)).toBe(true)
})

test('PNG export of a 250 × 250 peyote Pattern is one picture within the pixel budget', async ({ page }) => {
  await openApp(page, [fixturePattern({ technique: 'peyote', columns: 250, rows: 250 })])

  const { bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)

  expect(png.width * png.height).toBeLessThanOrEqual(PNG_MAX_PIXELS)
  expect(png.width).toBeGreaterThan(3000)
  // The last bands are drawn, not left blank: some of the beads in the bottom-right corner are not white (the Palette has a white of its own, so not every one).
  const corner = new Set<string>()
  for (let y = png.height - PNG_MARGIN_PX - 60; y < png.height - PNG_MARGIN_PX; y += 4) {
    for (let x = png.width - PNG_MARGIN_PX - 60; x < png.width - PNG_MARGIN_PX; x += 4) {
      corner.add(hex(png, x, y))
    }
  }
  expect(corner.size).toBeGreaterThan(2)
})

test('PDF export holds the legend and the chart, and splits a large Pattern over pages', async ({ page }) => {
  await openApp(page, [fixturePattern({ technique: 'brick', columns: 120, rows: 120 })])

  const { name, bytes } = await downloadOf(page, 'export-pdf')
  const pdf = bytes.toString('latin1')

  expect(name).toBe('bd-beads-fixture-brick.pdf')
  expect(pdf.startsWith('%PDF-1.4')).toBe(true)
  // A legend page, then the chart at 4.6 mm a bead: 120 columns don't fit one A4 sheet's width.
  expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBeGreaterThan(3)
})
