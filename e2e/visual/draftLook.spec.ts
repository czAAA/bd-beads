import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import { MARGIN } from '../../src/domain/margin'
import { openApp, projectBox, setZoom } from '../support/app'
import { beadCentre, fixtureProject } from '../support/projects'
import { wrongBeads } from '../support/referenceCheck'
import { withLayers } from '../../src/testUtils/layerFields'

// Zoomed out to 4 px a bead, the editor draws each layer as one draft image, a pixel a bead (ticket 0676): every bead's
// centre keeps its color, on peyote's and brick stitch's half-shifted rows too, the Frame's Row progress included.
const STRIPES = ['#d03030', '#2050c0', '#f0c020', '#30a060']
const ZOOM = 20
/** How many positions round the margin the Canvas check leaves out. */
const NEAR = 6

for (const technique of ['loom', 'peyote', 'brick'] as const) {
  test(`${technique} in the draft look at ${ZOOM}%`, async ({ page }) => {
    const framed = fixtureProject({ technique, columns: 40, rows: 30, rowProgress: { currentRow: 4 } })
    // A Canvas Piece round the Frame and its margin, in diagonal stripes three rows by five columns.
    const canvas: { row: number; column: number; color: string }[] = []
    for (let row = -24; row < 54; row += 1) {
      for (let column = -24; column < 64; column += 1) {
        if (row >= -MARGIN && row < 30 + MARGIN && column >= -MARGIN && column < 40 + MARGIN) continue
        canvas.push({ row, column, color: STRIPES[Math.floor((row + 100) / 3 + (column + 100) / 5) % STRIPES.length]! })
      }
    }
    const beads: Record<number, Record<number, string>> = {}
    for (const { row, column, color } of canvas) (beads[row] ??= {})[column] = color
    const project = withLayers(framed, { beads })
    await openApp(page, [project])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await setZoom(page, ZOOM)
    // A zoom moves the drawn beads until it settles, then draws them sharp (ticket 0689).
    await expect(page.getByTestId('project-surface-cells')).toHaveCSS('transform', 'none')
    await page.mouse.move(5, 5)

    const corner = await projectBox(page, (await page.getByTestId('project-surface').boundingBox())!)
    const shot = await page.screenshot()
    expect(wrongBeads(shot, project, ZOOM / 100, corner, { x: 0, y: 0 })).toEqual([])
    const png = PNG.sync.read(shot)
    // The beads near the margin are left out: a shifted row's reaches half a bead under it, and the Move bar stands over
    // the rows above it zoomed out (ticket 0682).
    const clear = ({ row, column }: { row: number; column: number }) => row < -MARGIN - NEAR || row > 29 + MARGIN + NEAR || column < -MARGIN - NEAR || column > 39 + MARGIN + NEAR
    const wrong = canvas.filter(clear).filter(({ row, column, color }) => {
      const centre = beadCentre(project, corner, ZOOM / 100, { row, column })
      const at = (Math.floor(centre.y) * png.width + Math.floor(centre.x)) * 4
      const want = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16))
      return want.some((channel, index) => Math.abs(channel - png.data[at + index]!) > 2)
    })
    expect(wrong.map(({ row, column }) => `(${row}, ${column})`)).toEqual([])
    if (technique !== 'loom') await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`draft-look-${technique}.png`, { maxDiffPixelRatio: 0.01 })
  })
}
