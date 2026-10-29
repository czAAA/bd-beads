import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { PNG } from 'pngjs'
import { openApp, openStripPanel, selectTool, settle } from '../support/app'
import { fixtureProject } from '../support/projects'
import { changeFrame } from '../../src/domain/changeFrame'
import { frameLayoutOf, type FrameShapeId } from '../../src/domain/frameShape'
import { onLayer } from '../../src/domain/layers'
import { moveToRow } from '../../src/domain/rowProgress'
import { paintCells } from '../../src/domain/drawing'
import type { Project } from '../../src/domain/project'
import { frameOf, withFrameSheet } from '../../src/domain/layerRecord'

// A Custom frame (tickets 0592, 0593): a peyote Triangle, Warped Square, Star, Kaleidocycle and Kite on a loom Canvas, every bead at the angle its panel
// lies, the Seams as thin lines and the Off-shape round them in the Canvas colour with no position marks. Each round
// or row painted a colour of its own, so the rounds and their step from panel to panel show.
const ROUND_COLORS = ['#e63746', '#f2c94c', '#2f6fed', '#27ae60', '#9b51e0']

function customFramed(shape: FrameShapeId, size: number): Project {
  const open = withFrameSheet(fixtureProject({ technique: 'loom', blank: true }), undefined)
  const placed = changeFrame(open, { custom: { shape, size, centre: { row: 8, column: 10 } } })
  if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
  const positions = frameLayoutOf(frameOf(placed.project)!)!.positions.filter(({ row }) => row < size - 1)
  return ROUND_COLORS.reduce(
    (project, color, index) => onLayer(project, 'frame', (view) => paintCells(view, positions.filter(({ row }) => row % ROUND_COLORS.length === index), color)),
    placed.project,
  )
}

// Each at a size that fits the screen whole: a Star's arms and a Kaleidocycle's triangles in Part size rounds, a Kite in
// Rows, a Fringe earring by its Top width (ticket 0597).
const SIZES = { triangle: 7, warpedSquare: 7, star: 5, kaleidocycle: 5, kite: 15, fringeEarring: 7 } as const satisfies Record<FrameShapeId, number>

for (const shape of ['triangle', 'warpedSquare', 'star', 'kaleidocycle', 'kite', 'fringeEarring'] as const) {
  test(`a ${shape} Custom frame`, async ({ page }) => {
    await openApp(page, [customFramed(shape, SIZES[shape])])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`custom-frame-${shape}.png`, { maxDiffPixelRatio: 0.01 })
  })
}

// Ticket 0594: Row progress on a Star (its second arm's first round current, the first arm faded), a Selection over a
// Triangle, and the PNG export drawing the whole shape.
test('Row progress on a Star Custom frame', async ({ page }) => {
  await openApp(page, [moveToRow(customFramed('star', SIZES.star), SIZES.star)])
  await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('app-canvas')).toHaveScreenshot('custom-frame-star-progress.png', { maxDiffPixelRatio: 0.01 })
})

test('a Selection over a Custom frame', async ({ page }) => {
  await openApp(page, [customFramed('triangle', SIZES.triangle)])
  await selectTool(page, 'select')
  await page.keyboard.press('ControlOrMeta+a')
  await settle(page)
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('app-canvas')).toHaveScreenshot('custom-frame-selection.png', { maxDiffPixelRatio: 0.01 })
})

test('the PNG export of a Custom frame draws the whole shape', async ({ page }) => {
  await openApp(page, [customFramed('kaleidocycle', SIZES.kaleidocycle)])
  await openStripPanel(page, 'strip-frame')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-png').click()])
  const png = PNG.sync.read(await readFile((await download.path())!))
  // The page's picture, a quarter of its size: its header and footer (the export time) left out.
  const scale = 4
  const top = Math.floor(png.height * 0.12)
  const picture = new PNG({ width: Math.floor(png.width / scale), height: Math.floor((png.height * 0.7) / scale) })
  for (let y = 0; y < picture.height; y += 1) {
    for (let x = 0; x < picture.width; x += 1) {
      const from = ((top + y * scale) * png.width + x * scale) * 4
      png.data.copy(picture.data, (y * picture.width + x) * 4, from, from + 4)
    }
  }
  expect(PNG.sync.write(picture)).toMatchSnapshot('custom-frame-export.png', { maxDiffPixelRatio: 0.01 })
})
