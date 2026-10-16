import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, moveToRow, withFrame, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useFrameFlow } from './useFrameFlow'

const sized = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const open = withFrame(sized, undefined)

function setup(project: Project | null = sized) {
  const harness = editHarness(project ?? undefined, { mirrorAxisCounts: { columns: 1, rows: 0 } })
  const deps = {
    currentProject: harness.currentProject,
    edit: harness.edit,
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
    centreOn: vi.fn(),
  }
  return { deps: { ...deps, replaceProject: harness.replaceProject, harness }, ...useFrameFlow(deps) }
}

function lastFrame(deps: ReturnType<typeof setup>['deps']) {
  return deps.replaceProject.mock.calls.at(-1)?.[0].frame
}

describe('useFrameFlow', () => {
  it('moves the Frame with its beads by dragging the Move handle (ticket 452)', () => {
    const drawn = { ...sized, beads: withColors(sized.beads, [{ row: 0, column: 0, color: '#ff0000' }]) }
    const { deps, press, drag, release } = setup(drawn)
    press({ kind: 'move' }, { row: 1, column: 1 })
    drag({ row: 2, column: 3 })
    release()
    expect(lastFrame(deps)).toEqual({ ...sized.frame, row: 1, column: 2 })
    expect(deps.harness.project.beads).toEqual({ 1: { 2: '#ff0000' } })
    expect(deps.announce).toHaveBeenCalledWith('Frame moved with its beads')
  })

  it('does not move the Frame by a press inside it, so the tool gets it (ticket 452)', () => {
    const { deps, press, drag, release } = setup()
    press({ kind: 'inside' }, { row: 1, column: 1 })
    drag({ row: 2, column: 3 })
    release()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('moves the Frame after Row progress has started, the pointer staying with it (ticket 452)', () => {
    const { deps, press, drag, release } = setup(moveToRow(sized, 1))
    press({ kind: 'move' }, { row: 0, column: 0 })
    drag({ row: 0, column: 2 })
    release()
    expect(lastFrame(deps)).toEqual({ ...sized.frame, column: 2 })
    expect(deps.harness.project.rowProgress.currentRow).toBe(1)
  })

  it('resizes the Frame by the edges of the handle it grabbed', () => {
    const { deps, press, drag, release } = setup()
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 3 })
    drag({ row: 5, column: 6 })
    release()
    expect(lastFrame(deps)).toEqual({ ...sized.frame, rows: 6, columns: 7 })
  })

  it('changes no bead and is no step when the Frame did not change', () => {
    const { deps, press, drag, release } = setup()
    press({ kind: 'move' }, { row: 1, column: 1 })
    drag({ row: 1, column: 1 })
    release()
    expect(deps.harness.history.canUndo.value).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('resizing is refused once Row progress is on and a pass is done (ticket 411)', () => {
    const locked = moveToRow(sized, 1)
    const { deps, frameLocked, settingFrame, press, drag, release, stepEdge, toggleEdit, remove } = setup(locked)
    expect(frameLocked.value).toBe(true)
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 0, column: 0 })
    drag({ row: 1, column: 1 })
    release()
    stepEdge('right', 1)
    toggleEdit()
    expect(settingFrame.value).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
    // Remove Frame is the way out: it asks first, and does nothing until confirmed (ticket 426).
    remove()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('asks before removing the Frame once a pass is done, and removes it with the passes on confirm (ticket 426)', () => {
    const { deps, remove, removeConfirmOpen, cancelRemove, confirmRemove } = setup(moveToRow(sized, 1))
    remove()
    expect(removeConfirmOpen.value).toBe(true)
    cancelRemove()
    expect(removeConfirmOpen.value).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()

    remove()
    confirmRemove()
    expect(removeConfirmOpen.value).toBe(false)
    expect(lastFrame(deps)).toBeUndefined()
  })

  it('asks before removing the Frame even while no pass is done (tickets 426, 455)', () => {
    const { removeConfirmOpen, remove, deps } = setup()
    remove()
    expect(removeConfirmOpen.value).toBe(true)
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('removes the Frame once confirmed, and says so', () => {
    const { deps, remove, confirmRemove } = setup()
    remove()
    confirmRemove()
    expect(lastFrame(deps)).toBeUndefined()
    expect(deps.announce).toHaveBeenCalledWith('Frame removed')
  })

  it('fits the Frame to what is drawn, or says there is nothing to fit', () => {
    const empty = setup(open)
    empty.fit()
    expect(empty.deps.replaceProject).not.toHaveBeenCalled()
    expect(empty.deps.announce).toHaveBeenCalledWith('Nothing drawn yet to fit the Frame to')

    const drawn: Project = { ...open, beads: { 4: { 6: '#ff0000', 8: '#00ff00' }, 7: { 5: '#0000ff' } } }
    const { deps, fit } = setup(drawn)
    fit()
    expect(lastFrame(deps)).toEqual({ row: 4, column: 5, rows: 4, columns: 4 })
  })

  it('sets the Frame to a Selection\'s rectangle as one undo step, with edit on for it (tickets 415, 452)', () => {
    const { deps, settingFrame, setTo } = setup(open)
    setTo({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(lastFrame(deps)).toEqual({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(settingFrame.value).toBe(true)
  })

  it('refuses a Frame that would cut a named Schema, with a Message naming it (ticket 407)', () => {
    const beads = withColors({}, [0, 1, 2, 3].map((column) => ({ row: 0, column, color: '#e63746' })))
    const named = { ...open, beads, pieceNames: [{ row: 0, column: 0, name: 'Fox' }] }
    const { deps, settingFrame, setTo } = setup(named)
    setTo({ row: 0, column: 2, rows: 1, columns: 4 })
    expect(deps.replaceProject).not.toHaveBeenCalled()
    expect(settingFrame.value).toBe(false)
    expect(deps.showToast).toHaveBeenCalledWith('frame-cuts-schema', expect.stringContaining('Fox'), 'info')
    setTo({ row: 0, column: 0, rows: 1, columns: 4 })
    expect(lastFrame(deps)).toEqual({ row: 0, column: 0, rows: 1, columns: 4 })
  })

  it('has edit on by default, toggles it, and keeps it off the Project (ticket 452)', () => {
    const { settingFrame, toggleEdit } = setup()
    expect(settingFrame.value).toBe(true)
    toggleEdit()
    expect(settingFrame.value).toBe(false)
    toggleEdit()
    expect(settingFrame.value).toBe(true)
  })

  it('has no edit with no Project open, with no Frame, or once Row progress holds the Frame; it is on again when the passes are reset (tickets 411, 452)', () => {
    for (const project of [null, open, moveToRow(sized, 1)]) {
      const { settingFrame, toggleEdit } = setup(project)
      toggleEdit()
      expect(settingFrame.value).toBe(false)
    }
  })

  describe('from the keyboard', () => {
    const key = (name: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: name, ...init })

    it('ignores other keys', () => {
      const { deps, onKey } = setup()
      expect(onKey(key('a'))).toBe(false)
      expect(onKey(key('Enter'))).toBe(false)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('moves the Frame with the arrows and resizes it from the bottom-right with Shift', () => {
      const { deps, onKey } = setup()
      expect(onKey(key('ArrowRight'))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sized.frame, column: 1 })
      expect(onKey(key('ArrowDown', { shiftKey: true }))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sized.frame, column: 1, rows: 4 })
    })

    it('still moves the Frame with the arrows once Row progress has started, but does not resize it', () => {
      const { deps, onKey } = setup(moveToRow(sized, 1))
      expect(onKey(key('ArrowDown', { shiftKey: true }))).toBe(true)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(onKey(key('ArrowRight'))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sized.frame, column: 1 })
    })
  })

  describe('the Technique (ticket 351)', () => {
    it('changes the Technique as one undo step, announced, keeping every bead and the Frame', () => {
      const { deps, setTechnique } = setup()
      const before = deps.harness.project
      setTechnique('peyote')
      expect(deps.harness.project).toMatchObject({ technique: 'peyote', frame: before.frame, beads: before.beads })
      expect(deps.harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)
      expect(deps.announce).toHaveBeenCalledWith('Technique changed to Peyote')
      deps.harness.history.onUndo()
      expect(deps.harness.project.technique).toBe('loom')
      deps.harness.history.onRedo()
      expect(deps.harness.project.technique).toBe('peyote')
    })

    it('is no step when the Technique is the one already used', () => {
      const { deps, setTechnique } = setup()
      setTechnique('loom')
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(deps.harness.history.canUndo.value).toBe(false)
    })

    it('is refused once Row progress is on and a pass is done (ticket 411)', () => {
      const { deps, setTechnique } = setup(moveToRow(sized, 1))
      setTechnique('brick')
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })
  })

  it('brings the Frame into view', () => {
    const { deps, bringIntoView } = setup()
    bringIntoView()
    expect(deps.centreOn).toHaveBeenCalledWith(sized.frame)
  })

  it('leaves beads the new Frame would crowd where they are, in the one undo step (ticket 261)', () => {
    const crowded = { ...sized, beads: withColors(sized.beads, [{ row: 5, column: 5, color: '#ff0000' }]) }
    const { deps, press, drag, release } = setup(crowded)
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 3 })
    drag({ row: 4, column: 4 })
    release()

    const updated = deps.replaceProject.mock.calls.at(-1)![0]
    expect(updated.beads).toEqual(crowded.beads)
    deps.harness.history.onUndo()
    expect(deps.harness.project.beads).toEqual(crowded.beads)
    expect(deps.harness.history.canUndo.value).toBe(false)
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  describe('the margin steppers (ticket 417)', () => {
    it('moves one edge a bead at a time, each press one Undo step, the other edges staying', () => {
      const { deps, stepEdge } = setup()
      const frame = sized.frame!
      stepEdge('right', 1)
      expect(lastFrame(deps)).toEqual({ ...frame, columns: frame.columns + 1 })
      stepEdge('left', 1)
      expect(lastFrame(deps)).toEqual({ ...frame, column: frame.column - 1, columns: frame.columns + 2 })
      stepEdge('top', -1)
      expect(lastFrame(deps)).toEqual({ ...frame, column: frame.column - 1, columns: frame.columns + 2, row: frame.row + 1, rows: frame.rows - 1 })
      expect(deps.announce).toHaveBeenCalledTimes(3)
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toEqual({ ...frame, column: frame.column - 1, columns: frame.columns + 2 })
      deps.harness.history.onUndo()
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toEqual(frame)
      expect(deps.harness.history.canUndo.value).toBe(false)
    })

    it('is no step at one bead, and never empties the Frame', () => {
      const { deps, stepEdge } = setup({ ...sized, frame: { row: 2, column: 2, rows: 1, columns: 1 } })
      for (const edge of ['top', 'bottom', 'left', 'right'] as const) stepEdge(edge, -1)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('steps the top edge by a pair of rows where rows alternate', () => {
      const { deps, stepEdge } = setup({ ...sized, technique: 'peyote', frame: { row: 4, column: 0, rows: 6, columns: 3 } })
      stepEdge('top', 1)
      expect(lastFrame(deps)).toEqual({ row: 2, column: 0, rows: 8, columns: 3 })
    })

    it('does nothing with no Frame, or once Row progress holds it (ticket 411)', () => {
      for (const project of [open, moveToRow(sized, 1)]) {
        const { deps, stepEdge } = setup(project)
        stepEdge('right', 1)
        expect(deps.replaceProject).not.toHaveBeenCalled()
      }
    })

    it('refuses an edge that would cut a named Schema, with a Message naming it (ticket 407)', () => {
      const beads = withColors({}, [0, 1, 2, 3].map((column) => ({ row: 0, column, color: '#e63746' })))
      const named = { ...open, frame: { row: 0, column: 0, rows: 1, columns: 4 }, beads, pieceNames: [{ row: 0, column: 0, name: 'Fox' }] }
      const { deps, stepEdge } = setup(named)
      stepEdge('left', -1)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(deps.showToast).toHaveBeenCalledWith('frame-cuts-schema', expect.stringContaining('Fox'), 'info')
    })
  })
})
