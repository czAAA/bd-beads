import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { placedFrame } from '../domain/layerWeave'
import type { Project } from '../domain/project'
import { moveToRow, toggleRowDirection } from '../domain/rowProgress'
import { withLayers } from '../testUtils/layerFields'
import { currentPassRegion } from './passRegion'
import { OPEN_SPACE } from './space'
import { surfaceView, type Region } from './surfaceView'

const framed = withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 20, unit: 'beads' } }), {
  frame: { technique: 'loom' as const, row: 2, column: 3, rows: 20, columns: 10, beads: {} },
})

function surfaceOf(project: Project, rotation: 0 | 90 = 0) {
  return surfaceView({ space: OPEN_SPACE, technique: 'loom', frame: placedFrame(project), rotation, zoom: 2, scroll: { x: 40, y: -30 }, viewport: { width: 800, height: 600 } })
}

function expectRegion(found: Region | undefined, expected: Region) {
  expect(found).toBeDefined()
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(found![key]).toBeCloseTo(expected[key], 6)
}

describe('currentPassRegion (ticket 0934)', () => {
  it('is the current row\'s beads with the row before and the row after, as the view shows them', () => {
    const project = moveToRow(framed, 5)
    const surface = surfaceOf(project)
    expectRegion(currentPassRegion(project, surface), surface.beadBox({ row: 2 + 4, column: 3, rows: 3, columns: 10 }, 'frame'))
  })

  it('is the current column with a column either side while rows run down the columns, turned with the view', () => {
    const project = moveToRow(toggleRowDirection(framed), 4)
    const surface = surfaceOf(project, 90)
    expectRegion(currentPassRegion(project, surface), surface.beadBox({ row: 2, column: 3 + 3, rows: 20, columns: 3 }, 'frame'))
  })

  it('is the last row once every row is done, and nothing without a Frame', () => {
    const done = moveToRow(framed, 20)
    const surface = surfaceOf(done)
    expectRegion(currentPassRegion(done, surface), surface.beadBox({ row: 2 + 18, column: 3, rows: 3, columns: 10 }, 'frame'))
    expect(currentPassRegion(withLayers(framed, { frame: undefined }), surface)).toBeUndefined()
  })
})
