import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateSelectionFlow } from './useRotateSelectionFlow'
import { beadsOfLayer, frameOf } from '../../domain/layerRecord'
import { sheetOf, withFields } from '../../testUtils/flatFields'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 1 x 3 strip of red beads at row 10, in a Frame all round it: the Frame\'s own beads, since it lies over the Canvas. */
const strip: Selection = { top: 10, left: 10, rows: 1, columns: 3 }
const framed: Project = withFields(base, {
frame: { technique: 'loom' as const, row: 0, column: 0, rows: 40, columns: 40, beads: withColors({}, [10, 11, 12].map((column) => ({ row: 10, column, color: RED }))) },
  beads: {},
})

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
    expect(frameOf(harness.project)).toMatchObject({ row: 0, column: 0, rows: 40, columns: 40 })
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
    expect(colorAt(frameOf(harness.project)!.beads, 10, 10)).toBeNull()
    expect(colorAt(frameOf(harness.project)!.beads, 9, 11)).toBe(RED)
    expect(beadsOfLayer(harness.project, 'canvas')).toBe(beadsOfLayer(framed, 'canvas'))

    harness.history.onUndo()
    expect(sheetOf(harness.project)).toEqual(sheetOf(framed))
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('only announces it when it covered no bead', () => {
    const { deps, onRotate } = setup()
    onRotate()
    expect(deps.announce).toHaveBeenCalledWith('Selection rotated')
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('says so once when it covered beads, with an Undo that undoes the one step', () => {
    const covering: Project = withFields(framed, { frame: { ...frameOf(framed)!, beads: withColors(frameOf(framed)!.beads, [{ row: 9, column: 11, color: GREEN }, { row: 11, column: 11, color: GREEN }]) } })
    const { deps, harness, onRotate } = setup(covering)
    onRotate()

    expect(deps.showToast).toHaveBeenCalledTimes(1)
    const [id, text, tone, action] = deps.showToast.mock.calls[0]!
    expect(id).toBe('selection-rotated')
    expect(text).toBe(en.frame.rotateCoveredMessage)
    expect(tone).toBe('info')
    action.run()
    expect(deps.onUndo).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(sheetOf(harness.project)).toEqual(sheetOf(covering))
  })

  it('drops what the turn would put outside the Frame, and says nothing for it', () => {
    // The Frame\'s top edge is row 10: the turn\'s top bead would stand on row 9, which the Frame does not hold.
    const edge: Project = withFields(framed, { frame: { technique: 'loom' as const, row: 10, column: 0, rows: 30, columns: 40, beads: withColors({}, [0, 1, 2].map((column) => ({ row: 0, column: 10 + column, color: RED }))) } })
    const { deps, harness, onRotate } = setup(edge)
    onRotate()
    expect(Object.values(frameOf(harness.project)!.beads).flatMap((row) => Object.keys(row))).toHaveLength(2)
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('turns the Canvas\'s beads for a Selection that begins on the Canvas, and leaves the Frame', () => {
    const sketch: Project = withFields(framed, { frame: { technique: 'loom' as const, row: 30, column: 30, rows: 4, columns: 4, beads: {} }, beads: withColors({}, [10, 11, 12].map((column) => ({ row: 10, column, color: RED }))) })
    const { harness, onRotate } = setup(sketch)
    onRotate()
    expect(colorAt(beadsOfLayer(harness.project, 'canvas'), 9, 11)).toBe(RED)
    expect(frameOf(harness.project)).toBe(frameOf(sketch))
  })

  it('turns a Selection clear of finished passes once rows are marked done, on the Frame or the Canvas (ticket 0647)', () => {
    const { harness, onRotate } = setup(moveToRow(framed, 1))
    onRotate()
    expect(colorAt(frameOf(harness.project)!.beads, 9, 11)).toBe(RED)

    const sketch: Project = moveToRow(withFields(framed, { frame: { technique: 'loom' as const, row: 30, column: 30, rows: 4, columns: 4, beads: {} }, beads: withColors({}, [10, 11, 12].map((column) => ({ row: 10, column, color: RED }))) }), 4)
    const onCanvas = setup(sketch)
    onCanvas.onRotate()
    expect(colorAt(beadsOfLayer(onCanvas.harness.project, 'canvas'), 9, 11)).toBe(RED)
  })

  it('does nothing with no Selection, no Project, or a Selection that reaches into finished rows (ticket 0647)', () => {
    const reached = moveToRow(framed, 11)
    for (const [project, selection] of [[framed, null], [null, strip], [reached, strip]] as const) {
      const { harness, onRotate } = setup(project, selection)
      onRotate()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})
