import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { withColors } from '../../domain/canvas'
import { DEFAULT_FRAME_SIDES, type FrameSides } from '../../domain/frame'
import { createProject, setRowProgressEnabled, withFrame, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useFrameFlow } from './useFrameFlow'

const sized = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const open = withFrame(sized, undefined)

function setup(project: Project | null = sized, sides: FrameSides = DEFAULT_FRAME_SIDES) {
  const harness = editHarness(project ?? undefined, { mirrorAxisCounts: { columns: 1, rows: 0 } })
  const sidesNow = { current: sides }
  const deps = {
    currentProject: harness.currentProject,
    edit: harness.edit,
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
    centreOn: vi.fn(),
    sides: () => sidesNow.current,
    commitIn: vi.fn(),
  }
  return { deps: { ...deps, replaceProject: harness.replaceProject, harness, sidesNow }, ...useFrameFlow(deps) }
}

function lastFrame(deps: ReturnType<typeof setup>['deps']) {
  return deps.replaceProject.mock.calls.at(-1)?.[0].frame
}

describe('useFrameFlow', () => {
  it('draws a Frame by dragging between two beads, in either direction, as one undo step', () => {
    const { deps, start, press, drag, release, draft } = setup(open)
    start()
    press({ kind: 'outside' }, { row: 5, column: 7 })
    drag({ row: 2, column: 3 })
    expect(draft.value).toEqual({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(deps.replaceProject).not.toHaveBeenCalled()

    release()
    expect(draft.value).toBeUndefined()
    expect(lastFrame(deps)).toEqual({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(deps.harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)
    deps.harness.history.onUndo()
    expect(deps.harness.project.frame).toBeUndefined()
    expect(deps.harness.history.canUndo.value).toBe(false)
    expect(deps.harness.mirrorAxisCounts.current).toEqual({ columns: 1, rows: 0 })
    expect(deps.announce).toHaveBeenCalledWith('Frame set, width 5, height 4')
  })

  it('lets go of a drag without committing it when a second finger makes it a pinch', () => {
    const { deps, press, drag, cancel, release, draft } = setup(open)
    press({ kind: 'outside' }, { row: 1, column: 1 })
    drag({ row: 3, column: 4 })
    expect(draft.value).toBeDefined()
    cancel()
    expect(draft.value).toBeUndefined()
    release()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('makes no Frame from a click that did not drag', () => {
    const { deps, press, release, draft } = setup(open)
    press({ kind: 'outside' }, { row: 3, column: 3 })
    expect(draft.value).toBeDefined()
    release()
    expect(deps.replaceProject).not.toHaveBeenCalled()
    expect(deps.harness.history.canUndo.value).toBe(false)
  })

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

  it('is refused while Row progress is on', () => {
    const locked = setRowProgressEnabled(sized, true)
    const { deps, frameLocked, press, drag, release, setSize, remove, pendingFrame, commitPending } = setup(locked)
    expect(frameLocked.value).toBe(true)
    press({ kind: 'inside' }, { row: 0, column: 0 })
    drag({ row: 1, column: 1 })
    release()
    setSize(9, 9)
    expect(pendingFrame.value).toBeUndefined()
    commitPending()
    remove()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('removes the Frame, and says so', () => {
    const { deps, remove } = setup()
    remove()
    expect(lastFrame(deps)).toBeUndefined()
    expect(deps.announce).toHaveBeenCalledWith('Frame removed')
  })

  it('stays ready to draw a new Frame after Remove Frame (ticket 258)', () => {
    const { settingFrame, remove } = setup()
    expect(settingFrame.value).toBe(false)
    remove()
    expect(settingFrame.value).toBe(true)
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

  it('starts and finishes Set Frame, and a tool choice can end it', () => {
    const { settingFrame, start, done, toggle } = setup()
    start()
    expect(settingFrame.value).toBe(true)
    done()
    expect(settingFrame.value).toBe(false)
    toggle()
    expect(settingFrame.value).toBe(true)
    toggle()
    expect(settingFrame.value).toBe(false)
  })

  it('does not start with no Project open', () => {
    const { settingFrame, start } = setup(null)
    start()
    expect(settingFrame.value).toBe(false)
  })

  describe('from the keyboard', () => {
    const key = (name: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: name, ...init })

    it('ignores keys while not setting the Frame', () => {
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

    it('starts a one-bead Frame with an arrow when there is none', () => {
      const { deps, start, onKey } = setup(open)
      start()
      onKey(key('ArrowDown'))
      expect(lastFrame(deps)).toEqual({ row: 0, column: 0, rows: 1, columns: 1 })
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

    it('is refused while Row progress is on', () => {
      const { deps, setTechnique } = setup(setRowProgressEnabled(sized, true))
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
    const crowded = { ...open, beads: withColors(open.beads, [{ row: 5, column: 5, color: '#ff0000' }]) }
    const { deps, start, press, drag, release } = setup(crowded)
    start()
    press({ kind: 'outside' }, { row: 0, column: 0 })
    drag({ row: 3, column: 3 })
    release()

    const updated = deps.replaceProject.mock.calls.at(-1)![0]
    expect(updated.beads[5]?.[5]).toBeUndefined()
    expect(Object.values<Record<number, string>>(updated.beads).flatMap((row) => Object.values(row))).toEqual(['#ff0000'])
    deps.harness.history.onUndo()
    expect(deps.harness.project.beads).toEqual(crowded.beads)
    expect(deps.harness.history.canUndo.value).toBe(false)
    expect(deps.showToast).toHaveBeenCalledWith('frame-margin-cleared', 'Frame set. 1 Piece was in the margin and moved outside it.', 'info', expect.anything())
    expect(deps.announce).not.toHaveBeenCalled()
  })

  describe('the size steppers apply once (ticket 410)', () => {
    /** The Project with a bead `distance` rows below its Frame, so a taller Frame crowds it into the margin. */
    function withBeadBelow(distance: number): Project {
      const frame = sized.frame!
      return { ...sized, beads: withColors(sized.beads, [{ row: frame.row + frame.rows + distance, column: frame.column, color: '#ff0000' }]) }
    }

    it('shows a press on the canvas at once, changing no bead and taking no Undo step', () => {
      const { deps, setSize, draft, pendingFrame } = setup()
      setSize(6, 5)
      expect(pendingFrame.value).toEqual({ ...sized.frame, columns: 6, rows: 5 })
      expect(draft.value).toEqual(pendingFrame.value)
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(deps.harness.history.canUndo.value).toBe(false)
      expect(deps.showToast).not.toHaveBeenCalled()
      expect(deps.announce).not.toHaveBeenCalled()
    })

    it('keeps stepping from the pending Frame, never below one bead', () => {
      const { setSize, pendingFrame } = setup()
      setSize(6, 5)
      setSize(0, 0)
      expect(pendingFrame.value).toEqual({ ...sized.frame, columns: 1, rows: 1 })
    })

    it('commits once on commitPending: one Undo step, restoring the Frame', () => {
      const { deps, setSize, commitPending, pendingFrame, draft } = setup()
      setSize(6, 5)
      setSize(7, 6)
      commitPending()
      expect(pendingFrame.value).toBeUndefined()
      expect(draft.value).toBeUndefined()
      expect(deps.replaceProject).toHaveBeenCalledTimes(1)
      expect(lastFrame(deps)).toEqual({ ...sized.frame, columns: 7, rows: 6 })
      expect(deps.announce).toHaveBeenCalledWith('Frame set, width 7, height 6')
      deps.harness.history.onUndo()
      expect(deps.harness.project.frame).toEqual(sized.frame)
      expect(deps.harness.history.canUndo.value).toBe(false)
    })

    it('grows and shrinks from the chosen sides, the opposite edges staying', () => {
      const frame = sized.frame!
      const { setSize, commitPending, deps } = setup(sized, { horizontal: 'left', vertical: 'top' })
      setSize(frame.columns + 2, frame.rows + 1)
      commitPending()
      expect(lastFrame(deps)).toEqual({ row: frame.row - 1, column: frame.column - 2, rows: frame.rows + 1, columns: frame.columns + 2 })
    })

    it('reads the sides at each press, so the choice can change between presses', () => {
      const frame = sized.frame!
      const { deps, setSize, pendingFrame } = setup()
      setSize(frame.columns + 1, frame.rows)
      expect(pendingFrame.value).toEqual({ ...frame, columns: frame.columns + 1 })
      deps.sidesNow.current = { horizontal: 'left', vertical: 'bottom' }
      setSize(frame.columns + 2, frame.rows)
      expect(pendingFrame.value).toEqual({ ...frame, column: frame.column - 1, columns: frame.columns + 2 })
    })

    it('is no step and no Message when the Frame is shrunk and grown back before closing', () => {
      const { deps, setSize, commitPending, pendingFrame } = setup(withBeadBelow(1))
      const frame = sized.frame!
      for (let press = 1; press <= 2; press++) setSize(frame.columns, frame.rows - press)
      for (let press = 1; press <= 2; press++) setSize(frame.columns, frame.rows - 2 + press)
      expect(pendingFrame.value).toBeUndefined()
      commitPending()
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(deps.harness.history.canUndo.value).toBe(false)
      expect(deps.showToast).not.toHaveBeenCalled()
    })

    it('moves the Pieces the final Frame reaches once, with one Message and one Undo step', () => {
      const frame = sized.frame!
      // The bead is four rows below the Frame's last row: three more rows put it in the margin, so does two.
      const crowded = withBeadBelow(3)
      const { deps, setSize, commitPending } = setup(crowded)
      setSize(frame.columns, frame.rows + 3)
      setSize(frame.columns, frame.rows + 2)
      expect(deps.showToast).not.toHaveBeenCalled()
      commitPending()
      expect(deps.replaceProject).toHaveBeenCalledTimes(1)
      expect(deps.showToast).toHaveBeenCalledTimes(1)
      expect(deps.showToast.mock.calls[0]?.[1]).toBe('Frame resized. 1 Piece was in the margin and moved outside it.')
      deps.harness.history.onUndo()
      expect(deps.harness.project.beads).toEqual(crowded.beads)
      expect(deps.harness.project.frame).toEqual(frame)
    })

    it('pulls nothing out of the margin for a Frame that was only passed through', () => {
      const frame = sized.frame!
      const { deps, setSize, commitPending } = setup(withBeadBelow(4))
      setSize(frame.columns, frame.rows + 3)
      setSize(frame.columns, frame.rows + 1)
      setSize(frame.columns, frame.rows)
      commitPending()
      expect(deps.replaceProject).not.toHaveBeenCalled()
      expect(deps.showToast).not.toHaveBeenCalled()
    })

    it('commits a pending Frame first when another command reads the Frame', () => {
      const frame = sized.frame!
      const drawn = { ...sized, beads: withColors(sized.beads, [{ row: 0, column: 0, color: '#ff0000' }]) }
      const { deps, setSize, fit } = setup(drawn)
      setSize(frame.columns + 3, frame.rows + 3)
      fit()
      const frames = deps.replaceProject.mock.calls.map((call) => call[0].frame)
      expect(frames).toEqual([{ ...frame, columns: frame.columns + 3, rows: frame.rows + 3 }, { row: 0, column: 0, rows: 1, columns: 1 }])
    })

    it('commits a pending Frame before a drag starts, Set Frame starts, the Technique changes or Remove Frame', () => {
      const frame = sized.frame!
      const bigger = { ...frame, columns: frame.columns + 1 }
      const starts: [string, (flow: ReturnType<typeof setup>) => void][] = [
        ['press', (flow) => flow.press({ kind: 'inside' }, { row: 0, column: 0 })],
        ['start', (flow) => flow.start()],
        ['setTechnique', (flow) => flow.setTechnique('peyote')],
        ['remove', (flow) => flow.remove()],
        ['key', (flow) => { flow.start(); flow.onKey({ key: 'ArrowDown', shiftKey: false } as KeyboardEvent) }],
      ]
      for (const [name, act] of starts) {
        const flow = setup()
        flow.setSize(bigger.columns, bigger.rows)
        act(flow)
        expect(flow.deps.replaceProject.mock.calls[0]?.[0].frame, name).toEqual(bigger)
        expect(flow.pendingFrame.value, name).toBeUndefined()
      }
    })

    it('drops a pending Frame on dropPending, as Undo and Redo do', () => {
      const { deps, setSize, dropPending, commitPending, pendingFrame } = setup()
      setSize(9, 9)
      dropPending()
      expect(pendingFrame.value).toBeUndefined()
      commitPending()
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('centres the view on the pending Frame', () => {
      const { deps, setSize, bringIntoView } = setup()
      setSize(9, 9)
      bringIntoView()
      expect(deps.centreOn).toHaveBeenCalledWith({ ...sized.frame, columns: 9, rows: 9 })
    })

    it('does not touch the Frame while Row progress is on', () => {
      const { deps, setSize, pendingFrame, commitPending } = setup(setRowProgressEnabled(sized, true))
      setSize(9, 9)
      commitPending()
      expect(pendingFrame.value).toBeUndefined()
      expect(deps.replaceProject).not.toHaveBeenCalled()
    })

    it('settles a pending Frame on the Project it leaves when another Project is opened', async () => {
      const first = sized
      const second = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } })
      const open = ref<Project>(first)
      const harness = editHarness(first)
      const commitIn = vi.fn()
      const flow = useFrameFlow({
        currentProject: () => open.value,
        edit: harness.edit,
        announce: vi.fn(),
        showToast: vi.fn(),
        onUndo: vi.fn(),
        messages: () => en,
        locale: () => 'en',
        centreOn: vi.fn(),
        sides: () => DEFAULT_FRAME_SIDES,
        commitIn,
      })
      flow.setSize(9, 9)
      open.value = second
      expect(commitIn).toHaveBeenCalledWith(first.id, { ...first.frame, columns: 9, rows: 9 })
      expect(flow.pendingFrame.value).toBeUndefined()
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
      const { deps, setSize, commitPending } = setup(crowdedBelow())
      setSize(sized.frame!.columns, sized.frame!.rows + 1)
      commitPending()
      expect(deps.showToast.mock.calls[0]?.[1]).toBe('Frame resized. 1 Piece was in the margin and moved outside it.')
    })
  })
})
