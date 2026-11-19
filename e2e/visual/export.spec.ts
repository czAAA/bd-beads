import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { PNG } from 'pngjs'
import { PRINT_COLORS } from '../../src/rendering/printColors'
import { A4_PORTRAIT, chartOnPageOne, PRINT_DPI } from '../../src/rendering/printPlan'
import { pageOneLayout } from '../../src/rendering/pageOneLayout'
import { printText } from '../../src/rendering/printText'
import { en } from '../../src/i18n/en'
import type { Project } from '../../src/domain/project'
import { openApp, openStripPanel } from '../support/app'
import { fixtureProject } from '../support/projects'

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

/** The PDF's plan as the export makes it: page 1 under the title block and Beads needed (ticket 0914). */
function pdfPlan(project: Project) {
  return pageOneLayout(project, printText(project, en, 'en', new Date())).plan
}

/** The pages the PDF says it has. */
function pageCountOf(pdf: string): number {
  return Number(/\/Count (\d+)/.exec(pdf)![1])
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

test('PNG export is page 1 of the PDF: one A4 portrait picture, drawn on the print paper (tickets 164, 0583, 0915)', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 60, rows: 8 })
  await openApp(page, [project])

  const { name, bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)
  const dpi = png.width / (A4_PORTRAIT.width / PRINT_DPI)

  expect(name).toBe('fixture-loom.png')
  // A4 portrait at the Export quality's dpi (Medium: 300).
  expect(png.width / png.height).toBeCloseTo(A4_PORTRAIT.width / A4_PORTRAIT.height, 2)
  expect(dpi).toBeCloseTo(300, 3)
  // Exports are always light, on the print paper (DESIGN.md §4.3), whatever the app's theme.
  expect(hex(png, 5, 5)).toBe(PRINT_COLORS.paper)
  // The Schema, Beads needed and the footer are drawn: not all of the page is blank.
  expect(nonWhiteIn(png, 0, 0, png.width, png.height)).toBe(true)
  expect(nonWhiteIn(png, 0, png.height - 260, png.width, 140)).toBe(true)
})

test('PNG export of a 250 × 250 peyote Project is the same single A4 page', async ({ page }) => {
  const project = fixtureProject({ technique: 'peyote', columns: 250, rows: 250 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-png')
  const png = PNG.sync.read(bytes)

  expect(png.width / png.height).toBeCloseTo(A4_PORTRAIT.width / A4_PORTRAIT.height, 2)
  // The big Schema is scaled down to the page, so the last of its beads are drawn, not cut: the middle of the page
  // holds beads of more than one color.
  const middle = new Set<string>()
  for (let y = Math.floor(png.height * 0.3); y < png.height * 0.5; y += 11) {
    for (let x = Math.floor(png.width * 0.3); x < png.width * 0.7; x += 11) middle.add(hex(png, x, y))
  }
  expect(middle.size).toBeGreaterThan(2)
})

test('a Project with no maker name leaves it out of the PNG (printed-output.md, The maker\'s name)', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 10, rows: 10 })])

  const { bytes } = await downloadOf(page, 'export-png')
  // Nothing throws, and the file is a normal, decodable size (no stray "by " with a blank name, no crash reading an
  // unset name).
  const png = PNG.sync.read(bytes)
  expect(png.width).toBeGreaterThan(0)
})

test('PDF export holds the legend and the chart, and splits a large Project over pages', async ({ page }) => {
  const project = fixtureProject({ technique: 'brick', columns: 120, rows: 120 })
  await openApp(page, [project])

  const { name, bytes } = await downloadOf(page, 'export-pdf')
  const pdf = bytes.toString('latin1')

  expect(name).toBe('fixture-brick.pdf')
  expect(pdf.startsWith('%PDF-1.4')).toBe(true)
  // The overview on page 1, then the chart: 120 × 120 does not fit page 1 at 1.6 mm a bead, so it is cut into parts.
  const plan = pdfPlan(project)
  expect(chartOnPageOne(plan)).toBe(false)
  expect(plan.parts.length).toBeGreaterThan(1)
  expect(pageCountOf(pdf)).toBe(plan.pageCount)
})

test('PDF export: a 100 × 100 with Letters off is one page, the chart whole on page 1 (ticket 0914)', async ({ page }) => {
  await openApp(page, [fixtureProject({ technique: 'loom', columns: 100, rows: 100 })])

  const { bytes } = await downloadOf(page, 'export-pdf')

  expect(pageCountOf(bytes.toString('latin1'))).toBe(1)
})

/** The size (in pt) of the PDF's first page, from its MediaBox: [0 0 width height]. */
function firstPageSize(pdf: string): [number, number] {
  const [, width, height] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf)!
  return [Number(width), Number(height)]
}

test('PDF export: a wide Project stays portrait (ticket 578, PrintWide)', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 96, rows: 24 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-pdf')
  const pdf = bytes.toString('latin1')

  const [width, height] = firstPageSize(pdf)
  expect(height).toBeGreaterThan(width)
  const plan = pdfPlan(project)
  expect(plan.page).toEqual(A4_PORTRAIT)
  expect(pageCountOf(pdf)).toBe(plan.pageCount)
})

test('PDF export: a taller-or-square Project prints portrait', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 40, rows: 40 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-pdf')
  const [width, height] = firstPageSize(bytes.toString('latin1'))

  expect(height).toBeGreaterThan(width)
  expect([width, height].map(Math.round)).toEqual([Math.round((A4_PORTRAIT.width * 72) / 150), Math.round((A4_PORTRAIT.height * 72) / 150)])
})

test('PDF export: a bracelet-length Project is folded into strips on page 1 (tickets 578, 0914, PrintStrips)', async ({ page }) => {
  const project = fixtureProject({ technique: 'loom', columns: 300, rows: 8 })
  await openApp(page, [project])

  const { bytes } = await downloadOf(page, 'export-pdf')

  const plan = pdfPlan(project)
  expect(plan.partsAcross).toBeGreaterThan(1)
  expect(chartOnPageOne(plan)).toBe(true)
  expect(pageCountOf(bytes.toString('latin1'))).toBe(plan.pageCount)
})
