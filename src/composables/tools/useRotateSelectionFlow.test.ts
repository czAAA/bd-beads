import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject, moveToRow, type Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateSelectionFlow } from './useRotateSelectionFlow'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 1 x 3 strip of red beads at row 10, in a Frame all round it: the Frame\'s own beads, since it lies over the Canvas. */
const strip: Selection = { top: 10, left: 10, rows: 1, columns: 3 }
const framed: Project = {
  ...base,
  frame: { technique: 'loom' as const, row: 0, column: 0, rows: 40, columns: 40, beads: withColors({}, [10, 11, 12].map((column) => ({ row: 10, column, color: RED }))) },
  beads: {},
}

function setup(project: Project | null = framed, selection: Selection | null = strip) {
  const harness = editHarness(project ?? undefined)
  const deps = {
    edit: harness.edit,
    currentProject: harness.currentProject,
    selection: ref<Selection | undefined>(selection ?? undefined),
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, harness, ...useRotateSelectionFlow(deps) }
}

describe('useRotateSelectionFlow', () => {
  it('turns the Selection as one drawing step, leaves the Frame, and Undo brings the old beads back', () => {
    const { deps, harness, onRotate } = setup()
    onRotate()

    expect(deps.selection.value).toMatchObject({ top: 9, left: 11, rows: 3, columns: 1 })
    expect(harness.project.frame).toMatchObject({ row: 0, column: 0, rows: 40, columns: 40 })
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
    expect(colorAt(harness.project.frame!.beads, 10, 10)).toBeNull()
    expect(colorAt(harness.project.frame!.beads, 9, 11)).toBe(RED)
    expect(harness.project.beads).toBe(framed.beads)

    harness.history.onUndo()
    expect(harness.project.frame).toEqual(framed.frame)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('in Right-angle weave turns whole Units: a horizontal bead becomes vertical, in one step Undo takes back (ticket 483)', () => {
    const woven: Project = {
      ...createProject({ technique: 'rightAngle', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }),
      frame: { technique: 'loom' as const, row: 50, column: 50, rows: 9, columns: 9, beads: {} },
      beads: withColors({}, [{ row: 0, column: 0, color: RED }, { row: 1, column: 0, color: GREEN }]),
    }
    const { deps, harness, onRotate } = setup(woven, { top: 0, left: 0, rows: 5, columns: 4 })
    onRotate()

    expect(deps.selection.value).toMatchObject({ top: 0, left: 1, rows: 7, columns: 3 })
    expect(colorAt(harness.project.beads, 1, 3)).toBe(RED)
    expect(colorAt(harness.project.beads, 0, 2)).toBe(GREEN)
    expect(colorAt(harness.project.beads, 0, 0)).toBeNull()

    harness.history.onUndo()
    expect(harness.project.beads).toEqual(woven.beads)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('only announces it when it covered no bead', () => {
    const { deps, onRotate } = setup()
    onRotate()
    expect(deps.announce).toHaveBeenCalledWith('Selection rotated')
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('says how many beads it covered, once, with an Undo that undoes the one step', () => {
    const covering: Project = { ...framed, frame: { ...framed.frame!, beads: withColors(framed.frame!.beads, [{ row: 9, column: 11, color: GREEN }, { row: 11, column: 11, color: GREEN }]) } }
    const { deps, harness, onRotate } = setup(covering)
    onRotate()

    expect(deps.showToast).toHaveBeenCalledTimes(1)
    const [id, text, tone, action] = deps.showToast.mock.calls[0]!
    expect(id).toBe('selection-rotated')
    expect(text).toBe('2 beads covered.')
    expect(tone).toBe('info')
    action.run()
    expect(deps.onUndo).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(harness.project.frame).toEqual(covering.frame)
  })

  it('drops what the turn would put outside the Frame, and counts nothing for it', () => {
    // The Frame\'s top edge is row 10: the turn\'s top bead would stand on row 9, which the Frame does not hold.
    const edge: Project = { ...framed, frame: { technique: 'loom' as const, row: 10, column: 0, rows: 30, columns: 40, beads: withColors({}, [0, 1, 2].map((column) => ({ row: 0, column: 10 + column, color: RED }))) } }
    const { deps, harness, onRotate } = setup(edge)
    onRotate()
    expect(Object.values(harness.project.frame!.beads).flatMap((row) => Object.keys(row))).toHaveLength(2)
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('turns the Canvas\'s beads for a Selection that begins on the Canvas, and leaves the Frame', () => {
    const sketch: Project = { ...framed, frame: { technique: 'loom' as const, row: 30, column: 30, rows: 4, columns: 4, beads: {} }, beads: withColors({}, [10, 11, 12].map((column) => ({ row: 10, column, color: RED }))) }
    const { harness, onRotate } = setup(sketch)
    onRotate()
    expect(colorAt(harness.project.beads, 9, 11)).toBe(RED)
    expect(harness.project.frame).toBe(sketch.frame)
  })

  it('does nothing with no Selection, no Project, or once a Row progress pass is done (ticket 411)', () => {
    const locked = moveToRow(framed, 1)
    for (const [project, selection] of [[framed, null], [null, strip], [locked, strip]] as const) {
      const { harness, onRotate } = setup(project, selection)
      onRotate()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})
