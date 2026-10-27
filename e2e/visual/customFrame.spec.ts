import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'
import { changeFrame } from '../../src/domain/changeFrame'
import { frameLayoutOf, type CustomFrameKindId } from '../../src/domain/frameKind'
import { onLayer } from '../../src/domain/layers'
import { paintCells, type Project } from '../../src/domain/project'

// A Custom frame (tickets 0592, 0593): a peyote Triangle, Warped Square, Star, Kaleidocycle and Kite on a loom Canvas, every bead at the angle its panel
// lies, the Seams as thin lines and the Off-shape round them in the Canvas colour with no position marks. Each round
// or row painted a colour of its own, so the rounds and their step from panel to panel show.
const ROUND_COLORS = ['#e63746', '#f2c94c', '#2f6fed', '#27ae60', '#9b51e0']

function customFramed(kind: CustomFrameKindId, size: number): Project {
  const { frame: _frame, ...open } = fixtureProject({ technique: 'loom', blank: true })
  const placed = changeFrame(open, { custom: { kind, size, centre: { row: 8, column: 10 } } })
  if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
  const positions = frameLayoutOf(placed.project.frame!)!.positions.filter(({ row }) => row < size - 1)
  return ROUND_COLORS.reduce(
    (project, color, index) => onLayer(project, 'frame', (view) => paintCells(view, positions.filter(({ row }) => row % ROUND_COLORS.length === index), color)),
    placed.project,
  )
}

// Each at a size that fits the screen whole: a Star's arms and a Kaleidocycle's triangles in Part size rounds, a Kite in
// Rows.
const SIZES = { triangle: 7, warpedSquare: 7, star: 5, kaleidocycle: 5, kite: 15 } as const satisfies Record<CustomFrameKindId, number>

for (const kind of ['triangle', 'warpedSquare', 'star', 'kaleidocycle', 'kite'] as const) {
  test(`a ${kind} Custom frame`, async ({ page }) => {
    await openApp(page, [customFramed(kind, SIZES[kind])])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`custom-frame-${kind}.png`, { maxDiffPixelRatio: 0.01 })
  })
}
