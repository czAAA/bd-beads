import { expect, test } from '@playwright/test'
import { openApp } from '../support/app'
import { fixtureProject } from '../support/projects'
import { changeFrame } from '../../src/domain/changeFrame'
import { frameLayoutOf, type CustomFrameKindId } from '../../src/domain/frameKind'
import { onLayer } from '../../src/domain/layers'
import { paintCells, type Project } from '../../src/domain/project'

// A Custom frame (ticket 0592): a peyote Triangle and Warped Square on a loom Canvas, every bead at the angle its panel
// lies, the Seams as thin lines and the Off-shape round them in the Canvas colour with no position marks. Each round
// painted a colour of its own, so the rounds and their step from panel to panel show.
const ROUND_COLORS = ['#e63746', '#f2c94c', '#2f6fed', '#27ae60', '#9b51e0']

function customFramed(kind: CustomFrameKindId, rounds: number): Project {
  const { frame: _frame, ...open } = fixtureProject({ technique: 'loom', blank: true })
  const placed = changeFrame(open, { custom: { kind, rounds, centre: { row: 8, column: 10 } } })
  if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
  const positions = frameLayoutOf(placed.project.frame!)!.positions.filter(({ row }) => row < rounds - 1)
  return ROUND_COLORS.reduce(
    (project, color, index) => onLayer(project, 'frame', (view) => paintCells(view, positions.filter(({ row }) => row % ROUND_COLORS.length === index), color)),
    placed.project,
  )
}

for (const kind of ['triangle', 'warpedSquare'] as const) {
  test(`a ${kind} Custom frame`, async ({ page }) => {
    await openApp(page, [customFramed(kind, 7)])
    await expect(page.getByTestId('project-surface-cells')).toHaveCount(1)
    await page.mouse.move(5, 5)
    await expect(page.getByTestId('app-canvas')).toHaveScreenshot(`custom-frame-${kind}.png`, { maxDiffPixelRatio: 0.01 })
  })
}
