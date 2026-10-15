import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, moveToRow, withFrame, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useFrameFlow } from './useFrameFlow'
import { rowProgressOn } from '../../testUtils/rowProgress'

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
  it('moves the Frame by dragging inside it', () => {
    const { deps, press, drag, release } = setup()
    press({ kind: 'inside' }, { row: 1, column: 1 })
    drag({ row: 2, column: 3 })
    release()
    expect(lastFrame(deps)).toEqual({ ...sized.frame, row: 1, column: 2 })
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
    press({ kind: 'inside' }, { row: 1, column: 1 })
    drag({ row: 1, column: 1 })
    release()
    expect(deps.harness.history.canUndo.value).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('is refused once Row progress is on and a pass is done (ticket 411)', () => {
    const locked = moveToRow(rowProgressOn(sized), 1)
    const { deps, frameLocked, start, settingFrame, press, drag, release, stepEdge, remove } = setup(locked)
    expect(frameLocked.value).toBe(true)
    press({ kind: 'inside' }, { row: 0, column: 0 })
    drag({ row: 1, column: 1 })
    release()
    stepEdge('right', 1)
    start()
    expect(settingFrame.value).toBe(false)
    expect(deps.replaceProject).not.toHaveBeenCalled()
    // Remove Frame is the way out: it asks first, and does nothing until confirmed (ticket 426).
    remove()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('asks before removing the Frame once a pass is done, and removes it with the passes on confirm (ticket 426)', () => {
    const { deps, remove, removeConfirmOpen, cancelRemove, confirmRemove } = setup(moveToRow(rowProgressOn(sized), 1))
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

  it('removes the Frame without asking while no pass is done (ticket 426)', () => {
    const { removeConfirmOpen, remove, deps } = setup()
    remove()
    expect(removeConfirmOpen.value).toBe(false)
    expect(lastFrame(deps)).toBeUndefined()
  })

  it('removes the Frame, and says so', () => {
    const { deps, remove } = setup()
    remove()
    expect(lastFrame(deps)).toBeUndefined()
    expect(deps.announce).toHaveBeenCalledWith('Frame removed')
  })

  it('ends Edit Frame with Remove Frame, since there is no Frame left to edit', () => {
    const { settingFrame, start, remove } = setup()
    start()
    expect(settingFrame.value).toBe(true)
    remove()
    expect(settingFrame.value).toBe(false)
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

  it('sets the Frame to a Selection\'s rectangle as one undo step, and enters Edit Frame on it (tickets 415, 417)', () => {
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

  it('starts and finishes Edit Frame', () => {
    const { settingFrame, start, done } = setup()
    start()
    expect(settingFrame.value).toBe(true)
    done()
    expect(settingFrame.value).toBe(false)
  })

  it('does not start with no Project open, with no Frame, or once Row progress holds the Frame (ticket 411)', () => {
    for (const project of [null, open, moveToRow(rowProgressOn(sized), 1)]) {
      const { settingFrame, start } = setup(project)
      start()
      expect(settingFrame.value).toBe(false)
    }
  })

  describe('from the keyboard', () => {
    const key = (name: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: name, ...init })

    it('ignores keys while not editing the Frame', () => {
      const { deps, onKey } = setup()
      expect(onKey(key('ArrowRight'))).toBe(false)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('moves the Frame with the arrows and resizes it from the bottom-right with Shift', () => {
      const { deps, start, onKey } = setup()
      start()
      expect(onKey(key('ArrowRight'))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sized.frame, column: 1 })
      expect(onKey(key('ArrowDown', { shiftKey: true }))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sized.frame, column: 1, rows: 4 })
    })

    it('finishes on Enter or Escape', () => {
      const { settingFrame, start, onKey } = setup()
      start()
      expect(onKey(key('Enter'))).toBe(true)
      expect(settingFrame.value).toBe(false)
      start()
      expect(onKey(key('Escape'))).toBe(true)
      expect(settingFrame.value).toBe(false)
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
      const { deps, setTechnique } = setup(moveToRow(rowProgressOn(sized), 1))
      setTechnique('brick')
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })
  })

  it('brings the Frame into view', () => {
    const { deps, bringIntoView } = setup()
    bringIntoView()
    expect(deps.centreOn).toHaveBeenCalledWith(sized.frame)
  })

  it('moves beads the new Frame would crowd clear, with a Message and the one undo step (ticket 261)', () => {
    const crowded = { ...sized, beads: withColors(sized.beads, [{ row: 5, column: 5, color: '#ff0000' }]) }
    const { deps, start, press, drag, release } = setup(crowded)
    start()
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 3 })
    drag({ row: 4, column: 4 })
    release()

    const updated = deps.replaceProject.mock.calls.at(-1)![0]
    expect(updated.beads[5]?.[5]).toBeUndefined()
    expect(Object.values<Record<number, string>>(updated.beads).flatMap((row) => Object.values(row))).toEqual(['#ff0000'])
    deps.harness.history.onUndo()
    expect(deps.harness.project.beads).toEqual(crowded.beads)
    expect(deps.harness.history.canUndo.value).toBe(false)
    expect(deps.showToast).toHaveBeenCalledWith('frame-margin-cleared', 'Frame resized. 1 Piece was in the margin and moved outside it.', 'info', expect.anything())
    expect(deps.announce).not.toHaveBeenCalled()
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
      for (const project of [open, moveToRow(rowProgressOn(sized), 1)]) {
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

  describe('the margin Message names what was done to the Frame', () => {
    function crowdedBelow() {
      const frame = sized.frame!
      const bead = { row: frame.row + frame.rows + 3, column: frame.column, color: '#ff0000' }
      return { ...sized, beads: withColors(sized.beads, [bead]) }
    }
    const key = (name: string, shiftKey = false) => ({ key: name, shiftKey }) as KeyboardEvent

    it('says "Frame moved." for a move', () => {
      const { deps, start, onKey } = setup(crowdedBelow())
      start()
      onKey(key('ArrowDown'))
      expect(deps.showToast.mock.calls[0]?.[1]).toBe('Frame moved. 1 Piece was in the margin and moved outside it.')
    })

    it('says "Frame resized." for a resize', () => {
      const { deps, stepEdge } = setup(crowdedBelow())
      stepEdge('bottom', 1)
      expect(deps.showToast.mock.calls[0]?.[1]).toBe('Frame resized. 1 Piece was in the margin and moved outside it.')
    })
  })
})
