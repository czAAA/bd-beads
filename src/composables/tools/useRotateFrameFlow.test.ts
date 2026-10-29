import { describe, expect, it, vi } from 'vitest'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateFrameFlow } from './useRotateFrameFlow'
import { beadsOfLayer, frameOf } from '../../domain/layerRecord'
import { frameSheetOf, withLayers } from '../../testUtils/layerFields'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead in its first row, over a Canvas holding a green one under it. */
const framed: Project = withLayers(base, {
frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) },
  beads: withColors({}, [{ row: 21, column: 21, color: GREEN }]),
})

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

describe('useRotateFrameFlow (tickets 471, 0667, ADR 0066, 0079)', () => {
  it('turns the Frame a quarter as one step, its beads where they were, and Undo brings back its orientation', () => {
    const { deps, harness, onRotateFrame } = setup()
    onRotateFrame()

    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(deps.announce).toHaveBeenCalledWith('Frame rotated')

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(framed))
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
    expect(beadsOfLayer(harness.project, 'canvas')).toBe(beadsOfLayer(framed, 'canvas'))
  })

  it('turns a Frame whose rows are marked done without asking, its pointers kept, and one Undo brings it back (ticket 0647)', () => {
    const woven = moveToRow(framed, 1)
    const { deps, harness, onRotateFrame } = setup(woven)
    onRotateFrame()

    // Row 1 is done: the same beads stay finished, the red bead in it kept, not trimmed.
    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(woven))
    expect(colorAt(frameOf(harness.project)!.beads, 0, 0)).toBe(RED)
    expect(deps.announce).toHaveBeenCalledWith('Frame rotated')

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(woven))
    expect(rowProgressOf(harness.project)).toEqual(rowProgressOf(woven))
  })

  it('does nothing without a Frame or without a Project', () => {
    for (const project of [withLayers(framed, { frame: undefined }), null]) {
      const { harness, onRotateFrame } = setup(project)
      onRotateFrame()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})

describe('useRotateFrameFlow on an empty Frame (ticket 471)', () => {
  it('still turns the Frame when it holds no bead', () => {
    const { harness, onRotateFrame } = setup(withLayers(framed, { frame: { ...frameOf(framed)!, beads: {} } }))
    onRotateFrame()
    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(harness.history.canUndo.value).toBe(true)
  })
})
