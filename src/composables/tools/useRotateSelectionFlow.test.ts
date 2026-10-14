import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject, type Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateSelectionFlow } from './useRotateSelectionFlow'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 1 x 3 strip of red beads at row 10, in a Frame all round it. */
const strip: Selection = { top: 10, left: 10, rows: 1, columns: 3 }
const framed: Project = {
  ...base,
  frame: { row: 0, column: 0, rows: 40, columns: 40 },
  beads: withColors({}, [10, 11, 12].map((column) => ({ row: 10, column, color: RED }))),
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

    expect(deps.selection.value).toEqual({ top: 9, left: 11, rows: 3, columns: 1 })
    expect(harness.project.frame).toEqual(framed.frame)
    expect(harness.resetAfterFrameChange).not.toHaveBeenCalled()
    expect(colorAt(harness.project.beads, 10, 10)).toBeNull()
    expect(colorAt(harness.project.beads, 9, 11)).toBe(RED)

    harness.history.onUndo()
    expect(harness.project.beads).toEqual(framed.beads)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('only announces it when it covered no bead', () => {
    const { deps, onRotate } = setup()
    onRotate()
    expect(deps.announce).toHaveBeenCalledWith('Selection rotated')
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('says how many beads it covered, once, with an Undo that undoes the one step', () => {
    const covering: Project = { ...framed, beads: withColors(framed.beads, [{ row: 9, column: 11, color: GREEN }, { row: 11, column: 11, color: GREEN }]) }
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
    expect(harness.project.beads).toEqual(covering.beads)
  })

  it('counts nothing for a covered bead the keep-out margin took back', () => {
    // A Frame with its top edge at row 10: row 9 is in the margin, where nothing is drawn, so the turn's top bead is trimmed.
    const edge: Project = { ...framed, frame: { row: 10, column: 0, rows: 30, columns: 40 }, beads: withColors(framed.beads, [{ row: 9, column: 11, color: GREEN }]) }
    const { deps, harness, onRotate } = setup(edge)
    onRotate()
    expect(colorAt(harness.project.beads, 9, 11)).toBe(GREEN)
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('does nothing with no Selection or no Project', () => {
    for (const [project, selection] of [[framed, null], [null, strip]] as const) {
      const { harness, onRotate } = setup(project, selection)
      onRotate()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})
