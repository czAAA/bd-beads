import { describe, expect, it, vi } from 'vitest'
import { withColors, type Rect } from '../../domain/canvas'
import { changeFrame } from '../../domain/changeFrame'
import type { FrameKindId } from '../../domain/frameKind'
import { createProject, moveToRow, withFrame, type Project } from '../../domain/project'
import { starterById, starterDesign } from '../../domain/starters'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useFrameFlow } from './useFrameFlow'

const sized = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const open = withFrame(sized, undefined)
/** The rectangle of the Frame `sized` has. */
const sizedRect = { row: 0, column: 0, rows: 3, columns: 4 }

function setup(project: Project | null = sized) {
  const harness = editHarness(project ?? undefined)
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
const rect = ({ technique: _technique, ...rectangle }: Rect & { technique: string }) => rectangle

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

  it('drops what a shrinking handle drag gives up once, on release, as one Undo step (ticket 513)', () => {
    const own = withColors({}, [{ row: 0, column: 0, color: '#e63746' }, { row: 2, column: 3, color: '#2a9d8f' }])
    const start = { ...sized, frame: { ...sized.frame!, beads: own } }
    const { deps, draftProject, press, drag, release } = setupEditing(start)
    press({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 3 })
    drag({ row: 2, column: 2 })
    expect(deps.replaceProject).not.toHaveBeenCalled()
    expect(draftProject.value?.beads).toEqual(withColors({}, [{ row: 2, column: 3, color: '#2a9d8f' }]))
    release()
    expect(deps.replaceProject).toHaveBeenCalledTimes(1)
    expect(deps.harness.project.beads).toEqual(withColors({}, [{ row: 2, column: 3, color: '#2a9d8f' }]))
    deps.harness.history.onUndo()
    expect(deps.harness.project).toMatchObject({ beads: {}, frame: start.frame })
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
    expect(deps.harness.project.frame).toBeUndefined()
  })

  it('asks before removing the Frame even while no pass is done, and says so once confirmed', () => {
    const { removeConfirmOpen, remove, confirmRemove, deps } = setup()
    remove()
    expect(removeConfirmOpen.value).toBe(true)
    expect(deps.replaceProject).not.toHaveBeenCalled()
    confirmRemove()
    expect(deps.harness.project.frame).toBeUndefined()
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
    // Fit makes the Frame round the beads, so they leave the Canvas for it; setting a Frame would leave them there.
    expect(deps.harness.project.beads).toEqual({})
  })

  it('sets the Frame to a Selection\'s rectangle as one undo step, and leaves the bar closed (tickets 415, 473)', () => {
    const { deps, settingFrame, setTo } = setup(open)
    setTo({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(lastFrame(deps)).toEqual({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(settingFrame.value).toBe(false)
  })

  describe('explains a snap that grew the Frame (ticket 570)', () => {
    const woven = (technique: 'brick' | 'netting' | 'rightAngle') =>
      withFrame(createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 12, height: 12, unit: 'beads' } }), undefined)

    it('says nothing on a Loom, which does not snap', () => {
      const { deps, setTo } = setup(open)
      setTo({ row: 1, column: 1, rows: 3, columns: 3 })
      expect(deps.showToast).not.toHaveBeenCalled()
    })

    it('says one row was added on top', () => {
      const { deps, setTo } = setup(woven('brick'))
      setTo({ row: 3, column: 0, rows: 4, columns: 4 })
      expect(deps.showToast).toHaveBeenCalledWith('frame-snapped', 'Added an empty row on top: a Frame must start on an unshifted row.', 'info')
    })

    it('covers every edge that grew in one toast', () => {
      const { deps, setTo } = setup(woven('netting'))
      setTo({ row: 5, column: 5, rows: 3, columns: 3 })
      expect(deps.showToast).toHaveBeenCalledTimes(1)
      expect(deps.showToast).toHaveBeenCalledWith(
        'frame-snapped',
        'Added an empty row on top: a Frame must start on an unshifted row. Added an empty row at the bottom: a Frame must be whole Units or cycles. Added an empty column on the left: a Frame must be whole Units or cycles. Added an empty column on the right: a Frame must be whole Units or cycles.',
        'info',
      )
    })

    it('counts several rows added on top', () => {
      const { deps, setTo } = setup({ ...woven('brick'), brickBlock: 4 })
      setTo({ row: 11, column: 0, rows: 4, columns: 4 })
      expect(deps.showToast).toHaveBeenCalledWith('frame-snapped', 'Added 3 empty rows on top: a Frame must start on an unshifted row.', 'info')
    })

    it('says nothing when the Frame is refused', () => {
      const beads = withColors({}, [0, 1, 2, 3].map((column) => ({ row: 4, column, color: '#e63746' })))
      const { deps, setTo } = setup({ ...woven('brick'), beads, pieceNames: [{ row: 4, column: 0, name: 'Fox' }] })
      setTo({ row: 4, column: 2, rows: 1, columns: 4 })
      expect(deps.showToast).toHaveBeenCalledTimes(1)
      expect(deps.showToast).toHaveBeenCalledWith('frame-cuts-schema', expect.any(String), 'info')
    })
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

  it('opens the panel with no Frame too, and keeps it open when the Frame goes (ticket 555)', () => {
    const bare = setup(open)
    bare.toggleBar()
    expect(bare.barShown.value).toBe(true)
    const framedFlow = setup()
    framedFlow.toggleBar()
    framedFlow.remove()
    framedFlow.confirmRemove()
    expect(framedFlow.barShown.value).toBe(true)
  })

  it('names the Frame as one Undo step, and an empty name clears it, even once a pass is done (ticket 555)', () => {
    const { deps, rename } = setup(moveToRow(sized, 1))
    rename('Moth wing')
    expect(deps.harness.project.frame!.name).toBe('Moth wing')
    rename('')
    expect(deps.harness.project.frame!.name).toBeUndefined()
    expect(deps.replaceProject).toHaveBeenCalledTimes(2)
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
      const { deps, setCanvasTechnique, confirmSwitch } = setup(moveToRow(sized, 1))
      setCanvasTechnique('brick')
      confirmSwitch()
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
      expect(deps.harness.project).not.toHaveProperty('netSize')
    })

    it('changes nothing when cancelled', () => {
      const { deps, setCanvasTechnique, cancelSwitch, switchQuestion } = setup(drawnCanvas)
      setCanvasTechnique('peyote')
      cancelSwitch()
      expect(switchQuestion.value).toBeUndefined()
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('skips the question for a layer with no beads, except to ask Netting for its Net size and Brick stitch for its Brick block (ticket 568)', () => {
      const { deps, setCanvasTechnique, switchQuestion, cancelSwitch } = setup()
      setCanvasTechnique('peyote')
      expect(deps.harness.project.technique).toBe('peyote')
      setCanvasTechnique('netting')
      expect(switchQuestion.value).toMatchObject({ drawn: false, asksNetSize: true, asksBrickBlock: false, keeps: false })
      cancelSwitch()
      setCanvasTechnique('brick')
      expect(switchQuestion.value).toMatchObject({ drawn: false, asksNetSize: false, asksBrickBlock: true, brickBlock: 1 })
    })

    it('takes the Brick block chosen in the question along with the switch to brick stitch (ticket 568)', () => {
      const { deps, setCanvasTechnique, setSwitchBrickBlock, confirmSwitch } = setup(drawnCanvas)
      setCanvasTechnique('brick')
      setSwitchBrickBlock(3)
      confirmSwitch()
      expect(deps.harness.project).toMatchObject({ technique: 'brick', brickBlock: 3 })
      expect(deps.announce).toHaveBeenCalledWith('Technique changed to Brick stitch')
      deps.harness.history.onUndo()
      expect(deps.harness.project.technique).toBe('loom')
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

  describe('the Net size (ticket 568)', () => {
    const net = { ...sized, technique: 'netting' as const, netSize: 3, frame: { ...sized.frame!, technique: 'netting' as const, netSize: 3 } }

    it('changes at once while no bead would be lost, as one announced Undo step', () => {
      const { deps, setNetSize, switchQuestion } = setup(net)
      setNetSize(5)
      expect(switchQuestion.value).toBeUndefined()
      expect(deps.harness.project.frame).toMatchObject({ technique: 'netting', netSize: 5 })
      expect(deps.announce).toHaveBeenCalledWith('Net size changed to 5')
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame?.netSize).toBe(3)
    })

    it('asks first when beads would lose their place, counting them as the size is chosen, and keeps the Technique', () => {
      const drawn = { ...net, beads: { 0: { 0: '#111111', 1: '#222222' } } }
      const { deps, setCanvasNetSize, setSwitchNetSize, switchQuestion, confirmSwitch } = setup(drawn)
      setCanvasNetSize(5)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(switchQuestion.value).toMatchObject({ technique: 'netting', keeps: true, asksNetSize: true, netSize: 5 })
      const lost = switchQuestion.value!.lost
      setSwitchNetSize(7)
      expect(switchQuestion.value!.netSize).toBe(7)
      confirmSwitch()
      expect(deps.harness.project.netSize).toBe(7)
      expect(lost).toBeGreaterThan(0)
    })

    it('Undo brings back the Canvas\'s Net size along with its beads, and Redo the new size without them (ticket 0610)', () => {
      const drawn = { ...net, beads: { 0: { 0: '#111111', 1: '#222222' } } }
      const { deps, setCanvasNetSize, confirmSwitch } = setup(drawn)
      setCanvasNetSize(5)
      confirmSwitch()
      deps.harness.history.onUndo()
      expect(deps.harness.project).toMatchObject({ netSize: 3, beads: drawn.beads })
      deps.harness.history.onRedo()
      expect(deps.harness.project.netSize).toBe(5)
      expect(deps.harness.project.beads).toEqual({})
    })

    it('Undo brings back the Frame\'s Net size along with its beads, and Redo the new size without them (ticket 0610)', () => {
      const drawn = { ...net, frame: { ...net.frame, beads: { 0: { 0: '#111111', 1: '#222222' } } } }
      const { deps, setNetSize, confirmSwitch } = setup(drawn)
      setNetSize(5)
      confirmSwitch()
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toMatchObject({ netSize: 3, beads: drawn.frame.beads })
      deps.harness.history.onRedo()
      expect(deps.harness.project.frame?.netSize).toBe(5)
      expect(deps.harness.project.frame?.beads).toEqual({})
    })

    it('is no step for the size already used', () => {
      const { deps, setNetSize } = setup(net)
      setNetSize(3)
      expect(deps.replaceProject).not.toHaveBeenCalled()
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
  })

  it('brings the Frame into view', () => {
    const { deps, bringIntoView } = setup()
    bringIntoView()
    expect(deps.centreOn).toHaveBeenCalledWith(sized.frame)
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

    it('does not refuse an edge over a named Schema: the Frame covers the Canvas, and a strip it gives up clears it (ADR 0066, ticket 513)', () => {
      const beads = withColors({}, [0, 1, 2, 3].map((column) => ({ row: 0, column, color: '#e63746' })))
      const named = { ...open, frame: { technique: 'loom' as const, row: 0, column: 0, rows: 4, columns: 6, beads: {} }, beads, pieceNames: [{ row: 0, column: 0, name: 'Fox' }] }
      const { deps, stepEdge } = setup(named)
      stepEdge('left', -1)
      expect(lastFrame(deps)).toMatchObject({ column: 1, columns: 5 })
      expect(deps.harness.project.beads).toEqual(withColors({}, [1, 2, 3].map((column) => ({ row: 0, column, color: '#e63746' }))))
      expect(deps.showToast).not.toHaveBeenCalled()
    })
  })
  describe('Add Frame from Starter and Replace Frame (tickets 495, 0596)', () => {
    const star = starterById('star')

    it('puts the Starter\'s design in the middle of the view in an open Project, over the Canvas, as one announced Undo step', () => {
      const painted = { ...open, beads: { 22: { 33: '#00ff00' } } }
      const { deps, placeFromStarter } = setup(painted)
      placeFromStarter(star, { sizes: { partSize: 5 }, useDesign: true })
      const frame = deps.harness.project.frame!
      expect(frame).toMatchObject({ kind: 'star', settings: { partSize: 5 } })
      // Round the middle of the view, (20, 30).
      expect([frame.row < 20, frame.row + frame.rows > 20, frame.column < 30, frame.column + frame.columns > 30]).toEqual([true, true, true, true])
      expect(frame.beads).toEqual(starterDesign(star))
      expect(deps.harness.project.beads).toBe(painted.beads)
      expect(deps.announce).toHaveBeenCalledWith('Star frame set, part size 5')
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toBeUndefined()
    })

    it('puts the same Frame in place empty on Start empty', () => {
      const { deps, placeFromStarter } = setup(open)
      placeFromStarter(star, { sizes: { partSize: 5 }, useDesign: false })
      expect(deps.harness.project.frame).toMatchObject({ kind: 'star', beads: {} })
    })

    it('replaces an empty Frame at once, starting Row progress at the first pass', () => {
      const { deps, placeFromStarter, replaceConfirmOpen } = setup(sized)
      placeFromStarter(star, { sizes: { partSize: 5 }, useDesign: true })
      expect(replaceConfirmOpen.value).toBe(false)
      expect(deps.harness.project.frame!.kind).toBe('star')
      expect(deps.harness.project.rowProgress).toMatchObject({ currentRow: 0, currentColumn: 0 })
    })

    it('asks before replacing a Frame that holds beads, and replaces nothing on No', () => {
      const drawn = { ...sized, frame: { ...sized.frame!, beads: withColors({}, [{ row: 0, column: 0, color: '#ff0000' }]) } }
      const { deps, placeFromStarter, replaceConfirmOpen, cancelReplace } = setup(drawn)
      placeFromStarter(star, { sizes: { partSize: 5 }, useDesign: true })
      expect(replaceConfirmOpen.value).toBe(true)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      cancelReplace()
      expect(replaceConfirmOpen.value).toBe(false)
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('drops the old Frame with its beads on Yes, as one Undo step', () => {
      const drawn = { ...sized, frame: { ...sized.frame!, beads: withColors({}, [{ row: 0, column: 0, color: '#ff0000' }]) } }
      const { deps, placeFromStarter, confirmReplace } = setup(drawn)
      placeFromStarter(star, { sizes: { partSize: 5 }, useDesign: true })
      confirmReplace()
      expect(deps.replaceProject).toHaveBeenCalledTimes(1)
      expect(deps.harness.project.frame!.kind).toBe('star')
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toEqual(drawn.frame)
    })

    it('does nothing once a pass is done', () => {
      const { deps, placeFromStarter } = setup(moveToRow(sized, 1))
      placeFromStarter(star, { sizes: { partSize: 5 }, useDesign: true })
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })
  })
})

describe('useFrameFlow with a Custom frame (ticket 0592)', () => {
  /** The open Project with an empty Custom frame of a kind and size. */
  function custom(kind: FrameKindId, size: number): Project {
    const result = changeFrame(open, { custom: { kind, size, centre: { row: 20, column: 30 } } })
    if (result.kind !== 'changed') throw new Error(result.kind)
    return result.project
  }

  it('grows its Rounds at once, and asks before fewer Rounds drop painted beads', () => {
    const { deps, setSettings, sizeAsk, confirmSize } = setup(custom('triangle', 9))
    setSettings({ rounds: 10 })
    expect(deps.harness.project.frame!.settings).toEqual({ rounds: 10 })
    deps.harness.replaceProject({ ...deps.harness.project, frame: { ...deps.harness.project.frame!, beads: { 9: { 0: '#ff0000' } } } })
    setSettings({ rounds: 9 })
    expect(sizeAsk.value).toEqual({ change: { rounds: 9 }, lost: 1 })
    confirmSize()
    expect(deps.harness.project.frame).toMatchObject({ settings: { rounds: 9 }, beads: {} })
  })

  it('sizes a Star and a Kaleidocycle by Part size and a Kite by Rows (ticket 0593)', () => {
    const star = setup(custom('star', 10))
    star.setSettings({ partSize: 8 })
    expect(star.deps.harness.project.frame!.settings).toEqual({ partSize: 8 })
    expect(star.deps.announce).toHaveBeenLastCalledWith('Part size: 8')
    const kaleidocycle = setup(custom('kaleidocycle', 9))
    kaleidocycle.setSettings({ partSize: 11 })
    expect(kaleidocycle.deps.harness.project.frame!.settings).toEqual({ partSize: 11 })
    const kite = setup(custom('kite', 21))
    kite.setSettings({ rows: 30 })
    expect(kite.deps.announce).toHaveBeenLastCalledWith('Rows: 30')
  })

  it('changes a Fringe earring one setting at a time, and asks before a V drops painted strands\' ends (ticket 0597)', () => {
    const placed = changeFrame(open, { custom: { kind: 'fringeEarring', settings: { topWidth: 7, topRows: 6, fringeStyle: 'straight', fringeLength: 12 }, centre: { row: 20, column: 30 } } })
    if (placed.kind !== 'changed') throw new Error(placed.kind)
    const { deps, setSettings, sizeAsk, confirmSize } = setup(placed.project)
    setSettings({ fringeLength: 14 })
    expect(deps.harness.project.frame!.settings).toMatchObject({ fringeLength: 14 })
    expect(deps.announce).toHaveBeenLastCalledWith('Fringe length: 14')
    // The first strand's last bead, which a V leaves off.
    deps.harness.replaceProject({ ...deps.harness.project, frame: { ...deps.harness.project.frame!, beads: { 1013: { 0: '#ff0000' } } } })
    setSettings({ fringeStyle: 'v' })
    expect(sizeAsk.value).toEqual({ change: { fringeStyle: 'v' }, lost: 1 })
    confirmSize()
    expect(deps.harness.project.frame).toMatchObject({ settings: { fringeStyle: 'v' }, beads: {} })
    expect(deps.announce).toHaveBeenLastCalledWith('Fringe style: V fringe')
  })

  it('removes an empty one at once, with nothing to ask, and asks first once it holds beads', () => {
    const empty = setup(custom('triangle', 9))
    expect(empty.removeTakesBeads.value).toBe(true)
    empty.remove()
    expect(empty.deps.harness.project.frame).toBeUndefined()
    const triangle = custom('triangle', 9)
    const painted = setup({ ...triangle, frame: { ...triangle.frame!, beads: { 0: { 0: '#ff0000' } } } })
    painted.remove()
    expect(painted.removeConfirmOpen.value).toBe(true)
  })
})
