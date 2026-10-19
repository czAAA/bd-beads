import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, moveToRow, withFrame, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useFrameFlow } from './useFrameFlow'

const sized = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const open = withFrame(sized, undefined)
/** The rectangle of the Frame `sized` has. */
const sizedRect = { row: 0, column: 0, rows: 3, columns: 4 }

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
    visibleCentre: vi.fn(() => ({ row: 20, column: 30 })),
  }
  return { deps: { ...deps, replaceProject: harness.replaceProject, harness }, ...useFrameFlow(deps) }
}

/** A flow whose handles the weaver has turned on with the edit pencil. */
function setupEditing(project: Project | null = sized) {
  const flow = setup(project)
  flow.toggleHandles()
  return flow
}

/** A Frame\'s rectangle alone, without its Weave. */
const rect = ({ technique: _technique, ...rectangle }: { technique: string; row: number; column: number; rows: number; columns: number }) => rectangle

/** The rectangle of the Frame the last change left (its beads and name aside). */
function lastFrame(deps: ReturnType<typeof setup>['deps']) {
  const frame = deps.replaceProject.mock.calls.at(-1)?.[0].frame
  if (!frame) return undefined
  const { beads: _beads, name: _name, technique: _technique, ...rectangle } = frame
  return rectangle
}

describe('useFrameFlow', () => {
  it('moves the Frame with its own beads by dragging the Move handle, and leaves the Canvas as it is (ticket 452, ADR 0066)', () => {
    const drawn = { ...sized, frame: { ...sized.frame!, beads: withColors({}, [{ row: 0, column: 0, color: '#ff0000' }]) }, beads: { 5: { 5: '#00ff00' } } }
    const { deps, press, drag, release } = setup(drawn)
    press({ kind: 'move' }, { row: 1, column: 1 })
    drag({ row: 2, column: 3 })
    release()
    expect(lastFrame(deps)).toEqual({ row: 1, column: 2, rows: 3, columns: 4 })
    expect(deps.harness.project.frame!.beads).toEqual({ 0: { 0: '#ff0000' } })
    expect(deps.harness.project.beads).toBe(drawn.beads)
    expect(deps.announce).toHaveBeenCalledWith('Frame moved with its beads')
  })

  it('previews a Move drag with the beads carried too, and clears the preview on release', () => {
    const { deps, draftProject, press, drag, release } = setup(sized)
    press({ kind: 'move' }, { row: 1, column: 1 })
    drag({ row: 2, column: 3 })
    expect(draftProject.value?.frame).toEqual({ ...sizedRect, technique: 'loom', row: 1, column: 2, beads: {} })
    release()
    expect(draftProject.value).toBe(deps.harness.project)
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
    expect(lastFrame(deps)).toEqual({ ...sizedRect, column: 2 })
    expect(deps.harness.project.rowProgress.currentRow).toBe(1)
  })

  it('resizes the Frame by the edges of the handle it grabbed, only while the bar is open', () => {
    const closed = setup()
    closed.press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 3 })
    closed.drag({ row: 5, column: 6 })
    closed.release()
    expect(closed.deps.replaceProject).not.toHaveBeenCalled()

    const { deps, press, drag, release } = setupEditing()
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 3 })
    drag({ row: 5, column: 6 })
    release()
    expect(lastFrame(deps)).toEqual({ ...sizedRect, rows: 6, columns: 7 })
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
    const { deps, frameLocked, settingFrame, press, drag, release, stepEdge, toggleHandles, remove } = setup(locked)
    expect(frameLocked.value).toBe(true)
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 0, column: 0 })
    drag({ row: 1, column: 1 })
    release()
    stepEdge('right', 1)
    toggleHandles()
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

  it('asks before removing the Frame even while no pass is done', () => {
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
    // The beads it wraps move into it, counted from its first bead; the Canvas is left empty.
    expect(deps.harness.project.frame!.beads).toEqual({ 0: { 1: '#ff0000', 3: '#00ff00' }, 3: { 0: '#0000ff' } })
    expect(deps.harness.project.beads).toEqual({})
  })

  it('sets the Frame to a Selection\'s rectangle as one undo step, and leaves the bar closed (tickets 415, 473)', () => {
    const { deps, settingFrame, setTo } = setup(open)
    setTo({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(lastFrame(deps)).toEqual({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(settingFrame.value).toBe(false)
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
    expect(deps.harness.project.frame).toMatchObject({ name: 'Fox', beads: { 0: { 0: '#e63746', 1: '#e63746', 2: '#e63746', 3: '#e63746' } } })
  })

  it('has the bar closed by default and toggles it (tickets 452, 473)', () => {
    const { settingFrame, toggleHandles } = setup()
    expect(settingFrame.value).toBe(false)
    toggleHandles()
    expect(settingFrame.value).toBe(true)
    toggleHandles()
    expect(settingFrame.value).toBe(false)
    toggleHandles()
    expect(settingFrame.value).toBe(true)
  })

  it('shows the bar only when opened, apart from the handles, once a pass is done too, and closes it (tickets 473, 475, 510)', () => {
    const closed = setup()
    expect(closed.barShown.value).toBe(false)
    closed.toggleBar()
    expect(closed.barShown.value).toBe(true)
    closed.closeBar()
    expect(closed.barShown.value).toBe(false)
    const done = setup(moveToRow(sized, 1))
    expect(done.barShown.value).toBe(false)
    done.toggleBar()
    expect([done.barShown.value, done.settingFrame.value]).toEqual([true, false])
    done.toggleHandles()
    expect(done.settingFrame.value).toBe(false)
    expect(setup(open).barShown.value).toBe(false)
  })

  it('resizes to a typed size, both sides evenly, as one Undo step, and not once a pass is done (ticket 473)', () => {
    const big = { ...sized, frame: { technique: 'loom' as const, row: 4, column: 4, rows: 6, columns: 6, beads: {} } }
    const { deps, resizeTo } = setup(big)
    resizeTo(10, 8)
    expect(lastFrame(deps)).toEqual({ row: 3, column: 2, rows: 8, columns: 10 })
    expect(deps.announce).toHaveBeenCalledTimes(1)
    deps.harness.history.onUndo()
    expect(deps.harness.project.frame).toEqual(big.frame)

    const same = setup(big)
    same.resizeTo(6, 6)
    expect(same.deps.replaceProject).not.toHaveBeenCalled()
    const locked = setup(moveToRow(big, 1))
    locked.resizeTo(10, 10)
    expect(locked.deps.replaceProject).not.toHaveBeenCalled()
  })

  it('has no edit with no Project open, with no Frame, or once Row progress holds the Frame; it is on again when the passes are reset (tickets 411, 452)', () => {
    for (const project of [null, open, moveToRow(sized, 1)]) {
      const { settingFrame, toggleHandles } = setup(project)
      toggleHandles()
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
      const { deps, onKey } = setupEditing()
      expect(onKey(key('ArrowRight'))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sizedRect, column: 1 })
      expect(onKey(key('ArrowDown', { shiftKey: true }))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sizedRect, column: 1, rows: 4 })
    })

    it('still moves the Frame with the arrows once Row progress has started, but does not resize it', () => {
      const { deps, onKey } = setup(moveToRow(sized, 1))
      expect(onKey(key('ArrowDown', { shiftKey: true }))).toBe(true)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(onKey(key('ArrowRight'))).toBe(true)
      expect(lastFrame(deps)).toEqual({ ...sizedRect, column: 1 })
    })
  })

  describe('the Technique (ticket 351)', () => {
    it('changes the Technique as one undo step, announced, keeping every bead and the Frame', () => {
      const { deps, setTechnique } = setup()
      const before = deps.harness.project
      setTechnique('peyote')
      expect(deps.harness.project).toMatchObject({ technique: 'loom', frame: { ...before.frame, technique: 'peyote' }, beads: before.beads })
      expect(deps.harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)
      expect(deps.announce).toHaveBeenCalledWith('Technique changed to Peyote')
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame?.technique).toBe('loom')
      deps.harness.history.onRedo()
      expect(deps.harness.project.frame?.technique).toBe('peyote')
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

  describe('the Canvas\'s Technique (ticket 492)', () => {
    it('is changed as one announced Undo step, the Frame keeping its own', () => {
      const { deps, setCanvasTechnique } = setup()
      setCanvasTechnique('peyote')
      expect(deps.harness.project).toMatchObject({ technique: 'peyote', frame: { technique: 'loom' } })
      expect(deps.announce).toHaveBeenCalledWith('Technique changed to Peyote')
      deps.harness.history.onUndo()
      expect(deps.harness.project.technique).toBe('loom')
    })

    it('is allowed once Row progress has a pass done', () => {
      const { deps, setCanvasTechnique } = setup(moveToRow(sized, 1))
      setCanvasTechnique('brick')
      expect(deps.harness.project.technique).toBe('brick')
    })

    it('changes the Brick block of the Canvas alone', () => {
      const { deps, setCanvasBrickBlock } = setup({ ...sized, technique: 'brick' })
      setCanvasBrickBlock(3)
      expect(deps.harness.project.brickBlock).toBe(3)
      expect(deps.harness.project.frame?.brickBlock).toBeUndefined()
    })
  })

  describe('asking before a Technique switch (ticket 507)', () => {
    const drawnCanvas = { ...sized, beads: { 0: { 0: '#111111', 1: '#222222' } } }

    it('asks first for a layer with drawn beads, saying how many would be lost, and changes nothing until confirmed', () => {
      const { deps, setCanvasTechnique, switchQuestion, confirmSwitch } = setup(drawnCanvas)
      setCanvasTechnique('netting')
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(switchQuestion.value).toMatchObject({ technique: 'netting', drawn: true, asksNetSize: true, lost: 2 })
      confirmSwitch()
      expect(switchQuestion.value).toBeUndefined()
      expect(deps.harness.project).toMatchObject({ technique: 'netting', netSize: 3, beads: {} })
    })

    it('recounts the loss as the Net size is chosen, and applies the one chosen as one Undo step', () => {
      const { deps, setCanvasTechnique, setSwitchNetSize, switchQuestion, confirmSwitch } = setup(drawnCanvas)
      setCanvasTechnique('netting')
      setSwitchNetSize(5)
      expect(switchQuestion.value?.netSize).toBe(5)
      confirmSwitch()
      expect(deps.harness.project.netSize).toBe(5)
      deps.harness.history.onUndo()
      expect(deps.harness.project).toMatchObject({ technique: 'loom', beads: drawnCanvas.beads })
    })

    it('changes nothing when cancelled', () => {
      const { deps, setCanvasTechnique, cancelSwitch, switchQuestion } = setup(drawnCanvas)
      setCanvasTechnique('peyote')
      cancelSwitch()
      expect(switchQuestion.value).toBeUndefined()
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('skips the question for a layer with no beads, except to ask Netting for its Net size', () => {
      const { deps, setCanvasTechnique, switchQuestion } = setup()
      setCanvasTechnique('peyote')
      expect(deps.harness.project.technique).toBe('peyote')
      setCanvasTechnique('netting')
      expect(switchQuestion.value).toMatchObject({ drawn: false, asksNetSize: true })
    })

    it('asks about the Frame\'s beads, not the Canvas\'s, and not at all while Row progress is on', () => {
      const framedBeads = { ...sized, frame: { ...sized.frame!, beads: { 1: { 1: '#111111' } } } }
      const { setTechnique, switchQuestion } = setup(framedBeads)
      setTechnique('peyote')
      expect(switchQuestion.value).toMatchObject({ technique: 'peyote', drawn: true, lost: 0 })
      const locked = setup(moveToRow(framedBeads, 1))
      locked.setTechnique('peyote')
      expect(locked.switchQuestion.value).toBeUndefined()
    })
  })

  describe('the Brick block (ticket 477)', () => {
    const brick = { ...sized, frame: { ...sized.frame!, technique: 'brick' as const } }

    it('changes the Brick block as one announced undo step, keeping every bead and the Frame row', () => {
      const { deps, setBrickBlock } = setup(brick)
      const before = deps.harness.project
      setBrickBlock(3)
      expect(deps.harness.project).toMatchObject({ frame: { ...before.frame, brickBlock: 3 }, beads: before.beads })
      expect(deps.announce).toHaveBeenCalledWith('Brick block changed to 3')
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame?.brickBlock ?? 1).toBe(1)
      deps.harness.history.onRedo()
      expect(deps.harness.project.frame?.brickBlock).toBe(3)
    })

    it('is no step for the number already used', () => {
      const { deps, setBrickBlock } = setup(brick)
      setBrickBlock(1)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('is refused once Row progress is on and a pass is done', () => {
      const { deps, setBrickBlock } = setup(moveToRow(brick, 1))
      setBrickBlock(2)
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
    const { deps, press, drag, release } = setupEditing(crowded)
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

  describe('the edge steppers (ticket 417)', () => {
    it('moves one edge a bead at a time, each press one Undo step, the other edges staying', () => {
      const big = { ...sized, frame: { technique: 'loom' as const, row: 2, column: 2, rows: 6, columns: 6, beads: {} } }
      const { deps, stepEdge } = setup(big)
      const frame = { technique: 'loom' as const, row: 2, column: 2, rows: 6, columns: 6 }
      stepEdge('right', 1)
      expect(lastFrame(deps)).toEqual({ ...rect(frame), columns: frame.columns + 1 })
      stepEdge('left', 1)
      expect(lastFrame(deps)).toEqual({ ...rect(frame), column: frame.column - 1, columns: frame.columns + 2 })
      stepEdge('top', -1)
      expect(lastFrame(deps)).toEqual({ ...rect(frame), column: frame.column - 1, columns: frame.columns + 2, row: frame.row + 1, rows: frame.rows - 1 })
      expect(deps.announce).toHaveBeenCalledTimes(3)
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toEqual({ ...frame, column: frame.column - 1, columns: frame.columns + 2, beads: {} })
      deps.harness.history.onUndo()
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toEqual({ ...frame, beads: {} })
      expect(deps.harness.history.canUndo.value).toBe(false)
    })

    it('is no step at four beads, and never shrinks the Frame past them (ticket 473)', () => {
      const { deps, stepEdge } = setup({ ...sized, frame: { technique: 'loom' as const, row: 2, column: 2, rows: 4, columns: 4, beads: {} } })
      for (const edge of ['top', 'bottom', 'left', 'right'] as const) stepEdge(edge, -1)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('steps the top edge by a pair of rows where rows alternate', () => {
      const { deps, stepEdge } = setup({ ...sized, technique: 'peyote', frame: { technique: 'peyote' as const, row: 4, column: 0, rows: 6, columns: 3, beads: {} } })
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

    it('does not refuse an edge over a named Schema: the Frame only covers the Canvas (ADR 0066)', () => {
      const beads = withColors({}, [0, 1, 2, 3].map((column) => ({ row: 0, column, color: '#e63746' })))
      const named = { ...open, frame: { technique: 'loom' as const, row: 0, column: 0, rows: 4, columns: 6, beads: {} }, beads, pieceNames: [{ row: 0, column: 0, name: 'Fox' }] }
      const { deps, stepEdge } = setup(named)
      stepEdge('left', -1)
      expect(lastFrame(deps)).toMatchObject({ column: 1, columns: 5 })
      expect(deps.harness.project.beads).toBe(beads)
      expect(deps.showToast).not.toHaveBeenCalled()
    })
  })
  describe('Add Frame from Template and Replace Frame (ticket 495)', () => {
    const bracelet = { technique: 'loom' as const, beadId: 'toho-cube-1.5mm', size: { width: 12, height: 90, unit: 'beads' as const } }

    it('puts an empty Frame in the middle of the view in an open Project, over the Canvas, as one announced step', () => {
      const painted = { ...open, beads: { 22: { 33: '#00ff00' } } }
      const { deps, placeFromTemplate } = setup(painted)
      placeFromTemplate(bracelet)
      expect(lastFrame(deps)).toEqual({ row: 20 - 45, column: 30 - 6, rows: 90, columns: 12 })
      expect(deps.harness.project.frame!.beads).toEqual({})
      expect(deps.harness.project.beads).toBe(painted.beads)
      expect(deps.announce).toHaveBeenCalledWith('Frame set, width 12, height 90')
    })

    it('weaves the new Frame in the Template\'s Technique, whatever the Canvas is woven in', () => {
      const { deps, placeFromTemplate } = setup(open)
      placeFromTemplate({ ...bracelet, technique: 'peyote' })
      expect(deps.harness.project.frame!.technique).toBe('peyote')
      expect(deps.harness.project.technique).toBe('loom')
    })

    it('replaces an empty Frame at once, starting Row progress at the first pass', () => {
      const { deps, placeFromTemplate, replaceConfirmOpen } = setup(sized)
      placeFromTemplate(bracelet)
      expect(replaceConfirmOpen.value).toBe(false)
      expect(deps.harness.project.frame).toMatchObject({ rows: 90, columns: 12, beads: {} })
      expect(deps.harness.project.rowProgress).toMatchObject({ currentRow: 0, currentColumn: 0 })
    })

    it('asks before replacing a Frame that holds beads, and replaces nothing on No', () => {
      const drawn = { ...sized, frame: { ...sized.frame!, beads: withColors({}, [{ row: 0, column: 0, color: '#ff0000' }]) } }
      const { deps, placeFromTemplate, replaceConfirmOpen, cancelReplace } = setup(drawn)
      placeFromTemplate(bracelet)
      expect(replaceConfirmOpen.value).toBe(true)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      cancelReplace()
      expect(replaceConfirmOpen.value).toBe(false)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('drops the old Frame with its beads on Yes, as one Undo step', () => {
      const drawn = { ...sized, frame: { ...sized.frame!, beads: withColors({}, [{ row: 0, column: 0, color: '#ff0000' }]) } }
      const { deps, placeFromTemplate, confirmReplace, replaceConfirmOpen } = setup(drawn)
      placeFromTemplate(bracelet)
      confirmReplace()
      expect(replaceConfirmOpen.value).toBe(false)
      expect(deps.replaceProject).toHaveBeenCalledTimes(1)
      expect(deps.harness.project.frame).toMatchObject({ rows: 90, columns: 12, beads: {} })
    })

    it('does nothing once a pass is done', () => {
      const done = moveToRow(sized, 1)
      const { deps, placeFromTemplate } = setup(done)
      placeFromTemplate(bracelet)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })
  })
})
