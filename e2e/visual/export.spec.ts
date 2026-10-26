import { frameGrid } from '../../src/domain/project'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { PRINT_THEME } from '../../src/rendering/beadLook'
import { BUILT_IN_COLORS } from '../../src/domain/palette'
import { PNG_BEAD_PX, PNG_MARGIN_PX, PNG_MAX_PIXELS, pngZoom } from '../../src/rendering/projectExport'
import { A4_LANDSCAPE, A4_PORTRAIT, planPrint } from '../../src/rendering/printPlan'
import { openApp, openStripPanel } from '../support/app'
import { fixtureProject } from '../support/projects'
import { displayedExtentPx } from '../../src/rendering/surfaceView'

/** Tickets 73 and 74: a Project exported as PNG and printable PDF in a real browser: right bead colors, and a
 * too-big Project comes out whole. */

/** Picks an export from the save box's Export menu (ticket 148) and waits for the file it hands over. Save box sits
 * in the Frame panel (ticket 555). */
async function downloadOf(page: Page, testId: string): Promise<{ name: string; bytes: Buffer }> {
  await openStripPanel(page, 'strip-frame')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testId).click()])
  return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) }
}

function hex(png: PNG, x: number, y: number): string {
  const at = (y * png.width + x) * 4
  return `#${[0, 1, 2].map((channel) => png.data[at + channel]!.toString(16).padStart(2, '0')).join('')}`
}

/** Whether any pixel in the box isn't plain white — the story column has drawn something there, wherever its lines
 * land. */
function nonWhiteIn(png: PNG, x: number, y: number, width: number, height: number): boolean {
  for (let row = y; row < Math.min(y + height, png.height); row += 3) {
    for (let column = x; column < Math.min(x + width, png.width); column += 3) {
      if (hex(png, column, row) !== '#ffffff') return true
    }
  }
  return false
}

/** Whether any pixel in the box has a pale warm tint (accent at low opacity over the board color), unlike the plain
 * margin (ticket 183). */
function hasWarmTintIn(png: PNG, x: number, y: number, width: number, height: number): boolean {
  for (let row = y; row < Math.min(y + height, png.height); row += 2) {
    for (let column = x; column < Math.min(x + width, png.width); column += 2) {
      const at = (row * png.width + column) * 4
      const r = png.data[at]!
      const g = png.data[at + 1]!
      const b = png.data[at + 2]!
      if (r > 247 && g < 240 && r - b > 8) return true
    }
  }
  return false
}

test('PNG export draws each bead in its color, at a legible size, on the print board, with a story column (ticket 164)', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 12, rows: 8 })
  await openApp(page, [project])

  const { name, bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)
  const chartWidth = 12 * PNG_BEAD_PX + PNG_MARGIN_PX * 2
  const chartHeight = 8 * PNG_BEAD_PX + PNG_MARGIN_PX * 2

  expect(name).toBe('openbeads-fixture-loom.png')
  // Wider than tall: the story sits under the chart, so the picture is exactly the chart's width and taller than it.
  expect(png.width).toBe(chartWidth)
  expect(png.height).toBeGreaterThan(chartHeight)
  // Exports are always light, on the print board (DESIGN.md §4.3), whatever the app's theme — rounded, so its very
  // corner is left white.
  expect(hex(png, 15, 15)).toBe(PRINT_THEME.background)
  // The middle of the bead in row 3, column 2 (the gap and rim are at its edge, so the middle is all its color).
  const painted = frameGrid(project)[3]![2]!.color
  expect(hex(png, PNG_MARGIN_PX + 2 * PNG_BEAD_PX + PNG_BEAD_PX / 2, PNG_MARGIN_PX + 3 * PNG_BEAD_PX + PNG_BEAD_PX / 2)).toBe(painted ?? PRINT_THEME.emptyBead)
  expect(BUILT_IN_COLORS.some((color) => color.hex === painted)).toBe(true)
  // The story tells its own words below the chart.
  expect(nonWhiteIn(png, 0, chartHeight, png.width, png.height - chartHeight)).toBe(true)
})

test('PNG export puts the story beside a typical Project', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 10, rows: 30 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)
  const chartWidth = 10 * PNG_BEAD_PX + PNG_MARGIN_PX * 2

  // Taller than wide: the story sits beside the chart, so the picture is wider than the chart alone.
  expect(png.width).toBeGreaterThan(chartWidth)
  expect(nonWhiteIn(png, chartWidth, 0, png.width - chartWidth, png.height)).toBe(true)
})

test('a Project with no maker name leaves it out of the PNG (printed-output.md, The maker\'s name)', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 10, rows: 10 })])

  const { bytes } = await downloadOf(page, 'export-png')
  // Nothing throws, and the file is a normal, decodable size (no stray "by " with a blank name, no crash reading an
  // unset name).
  const png = PNG.sync.read(bytes)
  expect(png.width).toBeGreaterThan(0)
})

test('a Project with a maker name leaves no pale name or line behind the chart, wide or not (ticket 0577)', async ({ page }) => {
  for (const [columns, rows] of [[10, 10], [60, 12]] as const) {
    const project = { ...fixtureProject({ technique: 'loom', columns, rows }), makerName: 'Ada' }
    await openApp(page, [project])

    const { bytes } = await downloadOf(page, 'export-png')
    const png = PNG.sync.read(bytes)
    const zoom = pngZoom(project)
    const chart = displayedExtentPx(project.technique, project.frame!.columns, project.frame!.rows, zoom, project.rotation)
    const chartWidth = Math.ceil(chart.width) + PNG_MARGIN_PX * 2
    const chartHeight = Math.ceil(chart.height) + PNG_MARGIN_PX * 2
    // The bottom margin under the board is blank: the background name and the accent line used to tint it.
    expect(hasWarmTintIn(png, 0, chartHeight - PNG_MARGIN_PX + 4, chartWidth, PNG_MARGIN_PX - 8)).toBe(false)
  }
})

test('PNG export of a 250 × 250 peyote Project is one picture within the pixel budget', async ({ page }) => {
  const project = fixtureProject({ technique: 'peyote', columns: 250, rows: 250 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)

  expect(png.width * png.height).toBeLessThanOrEqual(PNG_MAX_PIXELS)
  expect(png.width).toBeGreaterThan(3000)
  // The chart itself, drawn at the zoom the budget allows: the last bands are drawn, not left blank (some of the
  // beads in its bottom-right corner are not white — the Palette has a white of its own, so not every one).
  const zoom = pngZoom(project)
  const chart = displayedExtentPx(project.technique, project.frame!.columns, project.frame!.rows, zoom, project.rotation)
  const chartRight = Math.ceil(chart.width) + PNG_MARGIN_PX
  const chartBottom = Math.ceil(chart.height) + PNG_MARGIN_PX
  const corner = new Set<string>()
  for (let y = chartBottom - 60; y < chartBottom; y += 4) {
    for (let x = chartRight - 60; x < chartRight; x += 4) {
      corner.add(hex(png, x, y))
    }
  }
  expect(corner.size).toBeGreaterThan(2)
})

test('PDF export holds the legend and the chart, and splits a large Project over pages', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'brick', columns: 120, rows: 120 })])

  const { name, bytes } = await downloadOf(page, 'export-pdf')
  const pdf = bytes.toString('latin1')

  expect(name).toBe('openbeads-fixture-brick.pdf')
  expect(pdf.startsWith('%PDF-1.4')).toBe(true)
  // A legend page, then the chart at 4.6 mm a bead: 120 columns don't fit one A4 sheet's width.
  expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBeGreaterThan(3)
})

/** The size (in pt) of the PDF's first page, from its MediaBox: [0 0 width height]. */
function firstPageSize(pdf: string): [number, number] {
  const [, width, height] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf)!
  return [Number(width), Number(height)]
}

test('PDF export: a wide Project prints landscape, one part filling each chart page (ticket 163, PrintWide)', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 96, rows: 24 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-pdf')
  const pdf = bytes.toString('latin1')

  const [width, height] = firstPageSize(pdf)
  expect(width).toBeGreaterThan(height)
  const plan = planPrint(project)
  expect(plan.page).toEqual(A4_LANDSCAPE)
  expect(plan.strip).toBe(false)
  expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBe(plan.pageCount)
})

test('PDF export: a taller-or-square Project prints portrait', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 40, rows: 40 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-pdf')
  const [width, height] = firstPageSize(bytes.toString('latin1'))

  expect(height).toBeGreaterThan(width)
  expect([width, height].map(Math.round)).toEqual([Math.round((A4_PORTRAIT.width * 72) / 150), Math.round((A4_PORTRAIT.height * 72) / 150)])
})

test('PDF export: a bracelet-length Project stacks several parts on one sheet (ticket 163, PrintStrips)', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 300, rows: 8 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-pdf')
  const pdf = bytes.toString('latin1')

  const plan = planPrint(project)
  expect(plan.strip).toBe(true)
  expect(plan.partsAcross).toBeGreaterThan(plan.pageCount - 1) // fewer sheets than parts: some sheets share several
  expect(Number(/\/Count (\d+)/.exec(pdf)![1])).toBe(plan.pageCount)
})
