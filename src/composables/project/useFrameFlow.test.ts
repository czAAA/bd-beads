import { describe, expect, it, vi } from 'vitest'
import { withColors } from '../../domain/canvas'
import { createProject, setRowProgressEnabled, withFrame, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { useFrameFlow } from './useFrameFlow'

const sized = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const open = withFrame(sized, undefined)

function setup(project: Project | null = sized) {
  const deps = {
    currentProject: () => project ?? undefined,
    replaceProject: vi.fn(),
    recordHistory: vi.fn(),
    mirrorAxisCounts: () => ({ columns: 1, rows: 0 }),
    clearMirrorAxisCounts: vi.fn(),
    clearSelectionAndHover: vi.fn(),
    announce: vi.fn(),
    showToast: vi.fn(),
    onUndo: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
    centreOn: vi.fn(),
  }
  return { deps, ...useFrameFlow(deps) }
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
    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledWith({ beads: open.beads, rowProgress: open.rowProgress, size: { frame: undefined, mirrorAxisCounts: { columns: 1, rows: 0 } } })
    expect(deps.announce).toHaveBeenCalledWith('Frame set, 5 columns, 4 rows')
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
    expect(deps.recordHistory).not.toHaveBeenCalled()
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
    expect(deps.recordHistory).not.toHaveBeenCalled()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('is refused while Row progress is on', () => {
    const locked = setRowProgressEnabled(sized, true)
    const { deps, frameLocked, press, drag, release, setSize, remove } = setup(locked)
    expect(frameLocked.value).toBe(true)
    press({ kind: 'inside' }, { row: 0, column: 0 })
    drag({ row: 1, column: 1 })
    release()
    setSize(9, 9)
    remove()
    expect(deps.replaceProject).not.toHaveBeenCalled()
  })

  it('sets the size from the steppers, keeping the top-left corner, never below one bead', () => {
    const { deps, setSize } = setup()
    setSize(6, 5)
    expect(lastFrame(deps)).toEqual({ ...sized.frame, columns: 6, rows: 5 })
    setSize(0, 0)
    expect(lastFrame(deps)).toEqual({ ...sized.frame, columns: 1, rows: 1 })
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
      expect(lastFrame(deps)).toEqual({ ...sized.frame, rows: 4 })
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

    const updated = deps.replaceProject.mock.calls.at(-1)?.[0]
    expect(updated.beads[5]?.[5]).toBeUndefined()
    expect(Object.values<Record<number, string>>(updated.beads).flatMap((row) => Object.values(row))).toEqual(['#ff0000'])
    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory.mock.calls[0]?.[0].beads).toBe(crowded.beads)
    expect(deps.showToast).toHaveBeenCalledWith('frame-margin-cleared', 'Frame set. 1 piece was in the margin and moved outside it.', 'info', expect.anything())
    expect(deps.announce).not.toHaveBeenCalled()
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
      expect(deps.showToast.mock.calls[0]?.[1]).toBe('Frame moved. 1 piece was in the margin and moved outside it.')
    })

    it('says "Frame resized." for a resize', () => {
      const { deps, setSize } = setup(crowdedBelow())
      setSize(sized.frame!.columns, sized.frame!.rows + 1)
      expect(deps.showToast.mock.calls[0]?.[1]).toBe('Frame resized. 1 piece was in the margin and moved outside it.')
    })
  })
})
