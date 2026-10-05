import { describe, expect, it } from 'vitest'
import { createProject, type Project } from '../domain/project'
import { recordingContext } from '../testUtils/recordingContext'
import { renderCanvas } from './canvasRenderer'

function framedProject(): Project {
  const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })
  return { ...project, frame: { row: 6, column: 6, rows: 4, columns: 4 } }
}

describe('renderCanvas, the Frame margin (ticket 276)', () => {
  it('draws no dots in the margin and no band over it, leaving a flat gap', () => {
    const { context, calls } = recordingContext()

    renderCanvas(context, { project: framedProject(), region: { x: 0, y: 0, width: 300, height: 300 }, zoom: 1 })

    const dotCells = calls.filter((call) => call.name === 'arc').map(({ args }) => ({ column: Math.floor((args[0] as number) / 20), row: Math.floor((args[1] as number) / 20) }))
    expect(dotCells.length).toBeGreaterThan(0)
    // The Frame is rows and columns 6 to 9; its margin is 3 round it, 3 to 12.
    expect(dotCells.filter(({ row, column }) => row >= 3 && row <= 12 && column >= 3 && column <= 12)).toEqual([])
    expect(calls.filter((call) => call.name === 'fillRect' && call.globalAlpha === 0.5)).toEqual([])
  })
})
