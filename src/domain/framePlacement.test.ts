// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { frameCornerAt, framePlacement } from './framePlacement'
import { frameOf, withLayer } from './layerRecord'
import { rotateFrame, turnCanvasTo } from './rotate'
import { changeFrame } from './changeFrame'
import { findBead } from './beads'
import type { Project } from './project'

const made = (technique: 'loom' | 'peyote' | 'brick') => createProject({ technique, beadId: 'miyuki/delica/11-0', size: { width: 6, height: 5, unit: 'beads' } })

/** The Project with its Frame moved by whole Canvas positions. */
function moved(project: Project, rows: number, columns: number): Project {
  const result = changeFrame(project, { move: { rows, columns } })
  return result.kind === 'changed' ? result.project : project
}

describe('framePlacement (spec 1182, ticket 1185)', () => {
  it('puts an upright loom Frame\'s centre half its size from its corner, in the Canvas\'s bead widths', () => {
    const square = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } })
    expect(framePlacement(square)).toEqual({ angle: 0, at: { x: 2, y: 1 } })
    expect(framePlacement(moved(square, 3, -5))).toEqual({ angle: 0, at: { x: -3, y: 4 } })
    expect(framePlacement(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Open' }))).toBeUndefined()
  })

  it('turns the centre round the Canvas\'s origin with the Canvas', () => {
    const square = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } })
    const placement = framePlacement(turnCanvasTo(square, 90))!
    expect(placement.angle).toBe(90)
    expect(placement.at.x).toBeCloseTo(-1, 9)
    expect(placement.at.y).toBeCloseTo(2, 9)
  })

  it('reads back the very Canvas position it was worked out from, in every Technique, turned, twisted and in another Bead', () => {
    const fifteen = findBead('miyuki/round/15-0')!
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const placed = moved(made(technique), 7, -3)
      const small = withLayer(placed, 'frame', { bead: fifteen })
      for (const project of [placed, rotateFrame(placed)!, turnCanvasTo(rotateFrame(placed)!, 37.5), turnCanvasTo(placed, 212), small, turnCanvasTo(rotateFrame(small)!, 301)]) {
        const { row, column } = frameOf(project)!
        expect(frameCornerAt(project, framePlacement(project)!.at), technique).toEqual({ row, column })
      }
    }
  })
})
