import { describe, expect, it, vi } from 'vitest'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateFrameFlow } from './useRotateFrameFlow'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead in its first row, over a Canvas holding a green one under it. */
const framed: Project = {
  ...base,
  frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) },
  beads: withColors({}, [{ row: 21, column: 21, color: GREEN }]),
}

function setup(project: Project | null = framed) {
  const harness = editHarness(project ?? undefined)
  const deps = {
    edit: harness.edit,
    currentProject: harness.currentProject,
    announce: vi.fn(),
    messages: () => en,
  }
  return { deps, harness, ...useRotateFrameFlow(deps) }
}

describe('useRotateFrameFlow (ticket 471, ADR 0066)', () => {
  it('turns the Frame and its own beads as one step, swaps Width and Height, and Undo brings both back', () => {
    const { deps, harness, onRotateFrame } = setup()
    onRotateFrame()

    expect(harness.project.frame).toMatchObject({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(colorAt(harness.project.frame!.beads, 0, 0)).toBeNull()
    expect(colorAt(harness.project.frame!.beads, 0, 3)).toBe(RED)
    expect(deps.announce).toHaveBeenCalledWith('Frame rotated')

    harness.history.onUndo()
    expect(harness.project.frame).toEqual(framed.frame)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('resets what was built against the old Frame, as any change of the Frame does', () => {
    const { harness, onRotateFrame } = setup()
    onRotateFrame()
    expect(harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)
  })

  it('leaves the Canvas where it is: nothing is covered or turned', () => {
    const { harness, onRotateFrame } = setup()
    onRotateFrame()
    expect(harness.project.beads).toBe(framed.beads)
  })

  it('snaps the turned top row to an even row on peyote, as Rotate does', () => {
    const peyote: Project = { ...framed, technique: 'peyote', frame: { technique: 'peyote' as const, row: 20, column: 20, rows: 4, columns: 9, beads: {} } }
    const { harness, onRotateFrame } = setup(peyote)
    onRotateFrame()
    expect(harness.project.frame!.row % 2).toBe(0)
    expect(harness.project.frame).toMatchObject({ rows: 9, columns: 4 })
  })

  it('does nothing without a Frame, without a Project, or once a Row progress pass is done (ticket 411)', () => {
    const locked = moveToRow(framed, 1)
    for (const project of [{ ...framed, frame: undefined }, null, locked]) {
      const { harness, onRotateFrame } = setup(project)
      onRotateFrame()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})

describe('useRotateFrameFlow on an empty Frame (ticket 471)', () => {
  it('still turns the Frame when it holds no bead', () => {
    const { harness, onRotateFrame } = setup({ ...framed, frame: { ...framed.frame!, beads: {} } })
    onRotateFrame()
    expect(harness.project.frame).toMatchObject({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(harness.history.canUndo.value).toBe(true)
  })
})
