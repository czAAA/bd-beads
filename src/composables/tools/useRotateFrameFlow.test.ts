import { describe, expect, it, vi } from 'vitest'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateFrameFlow } from './useRotateFrameFlow'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead in its first row. */
const framed: Project = {
  ...base,
  frame: { row: 20, column: 20, rows: 4, columns: 6 },
  beads: withColors({}, [{ row: 20, column: 20, color: RED }]),
}

function setup(project: Project | null = framed) {
  const harness = editHarness(project ?? undefined)
  const deps = {
    edit: harness.edit,
    currentProject: harness.currentProject,
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, harness, ...useRotateFrameFlow(deps) }
}

describe('useRotateFrameFlow (ticket 471)', () => {
  it('turns the Frame and its beads as one step, swaps Width and Height, and Undo brings both back', () => {
    const { deps, harness, onRotateFrame } = setup()
    onRotateFrame()

    expect(harness.project.frame).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(colorAt(harness.project.beads, 20, 20)).toBeNull()
    expect(colorAt(harness.project.beads, 19, 24)).toBe(RED)
    expect(deps.announce).toHaveBeenCalledWith('Frame rotated')
    expect(deps.showToast).not.toHaveBeenCalled()

    harness.history.onUndo()
    expect(harness.project.frame).toEqual(framed.frame)
    expect(harness.project.beads).toEqual(framed.beads)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('resets what was built against the old Frame, as any change of the Frame does', () => {
    const { harness, onRotateFrame } = setup()
    onRotateFrame()
    expect(harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)
  })

  it('keeps the beads of the turned margin: the old margin is not trimmed from under the turned Frame', () => {
    // A bead in the old margin turns into the new one; one the turned Frame lands on beside the old margin stays too.
    const withMarginBead: Project = { ...framed, beads: withColors(framed.beads, [{ row: 16, column: 22, color: GREEN }]) }
    const { harness, onRotateFrame } = setup(withMarginBead)
    onRotateFrame()
    expect(colorAt(harness.project.beads, 21, 28)).toBe(GREEN)
    expect(colorAt(harness.project.beads, 19, 24)).toBe(RED)
  })

  it('says how many beads outside it the turned area covered, once, with an Undo', () => {
    // The 16 x 18 area turns to 18 x 16: row 13 is new ground, and two beads there are replaced.
    const covering: Project = { ...framed, beads: withColors(framed.beads, [{ row: 13, column: 20, color: GREEN }, { row: 13, column: 21, color: GREEN }]) }
    const { deps, harness, onRotateFrame } = setup(covering)
    onRotateFrame()

    expect(deps.showToast).toHaveBeenCalledTimes(1)
    const [id, text, tone, action] = deps.showToast.mock.calls[0]!
    expect(id).toBe('frame-rotated')
    expect(text).toBe('2 beads covered.')
    expect(tone).toBe('info')
    action.run()
    expect(deps.onUndo).toHaveBeenCalledTimes(1)

    harness.history.onUndo()
    expect(harness.project.beads).toEqual(covering.beads)
  })

  it('leaves a Piece outside the Frame and its margin where it is', () => {
    const far: Project = { ...framed, beads: withColors(framed.beads, [{ row: 2, column: 2, color: GREEN }]) }
    const { harness, onRotateFrame } = setup(far)
    onRotateFrame()
    expect(colorAt(harness.project.beads, 2, 2)).toBe(GREEN)
  })

  it('snaps the turned top row to an even row on peyote, as Rotate does', () => {
    const peyote: Project = { ...framed, technique: 'peyote', frame: { row: 20, column: 20, rows: 4, columns: 9 }, beads: {} }
    const { harness, onRotateFrame } = setup(peyote)
    onRotateFrame()
    // 16 x 21 area at (14, 14) turns to 21 x 16 at row 14 - 2 = 12: even already.
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
    const { harness, onRotateFrame } = setup({ ...framed, beads: {} })
    onRotateFrame()
    expect(harness.project.frame).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(harness.history.canUndo.value).toBe(true)
  })
})
