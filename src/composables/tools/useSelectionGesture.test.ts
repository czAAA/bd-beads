import { describe, expect, it } from 'vitest'
import { editHarness } from '../../testUtils/editHarness'
import { useSelectionGesture } from './useSelectionGesture'
import { BEAD_CATALOG } from '../../domain/beads'
import { NO_MIRROR_AXES, type MirrorAxisCounts } from '../../domain/mirror'
import { createProject, frameGrid, withFrame, type Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'

const cubeBeadId = BEAD_CATALOG[0]!.id
const RED = '#e63746'

/** 4 columns x 4 rows, loom. */
function makeProject(): Project {
  return createProject({ technique: 'loom', beadId: cubeBeadId, size: { width: 6, height: 6, unit: 'mm' } })
}

function paintedProject(): Project {
  return paintAt(makeProject(), [{ row: 0, column: 0 }], RED, NO_MIRROR_AXES)
}

function setup(
  project: Project | null = makeProject(),
  { axes = NO_MIRROR_AXES, copyMode = false }: { axes?: MirrorAxisCounts; copyMode?: boolean } = {},
) {
  const harness = editHarness(project ?? undefined)
  const gesture = useSelectionGesture(
    harness.currentProject,
    harness.edit,
    () => axes,
    () => copyMode,
  )
  /** Counts the Edits that landed on the Project. */
  return { gesture, commitGridChange: harness.replaceProject, harness }
}

/** Drags a Selection over the top-left cell and copies it, which arms paste mode (ticket 437). */
function copyTopLeft(gesture: ReturnType<typeof setup>['gesture']) {
  gesture.beginPress(0, 0)
  gesture.extendPress(0, 0)
  gesture.endPress()
  gesture.copy()
}

describe('useSelectionGesture in Right-angle weave (ticket 483)', () => {
  const woven: Project = {
    ...createProject({ technique: 'rightAngle', beadId: cubeBeadId, size: { width: 3, height: 2, unit: 'beads' } }),
    frame: { row: 0, column: 0, rows: 5, columns: 4, beads: {} },
  }

  it('marks a Selection of whole Units: a press on one bead selects its Unit', () => {
    const { gesture } = setup(woven)
    gesture.beginPress(1, 1)
    expect(gesture.selection.value).toEqual({ top: 0, left: 1, rows: 3, columns: 2 })
  })

  it('grows a dragged Selection to whole Units and keeps a press on the last line inside the Frame', () => {
    const { gesture } = setup(woven)
    gesture.beginPress(1, 0)
    gesture.extendPress(2, 2)
    expect(gesture.selection.value).toEqual({ top: 0, left: 0, rows: 3, columns: 3 })

    gesture.beginPress(4, 3)
    expect(gesture.selection.value).toEqual({ top: 2, left: 2, rows: 3, columns: 2 })
  })
})

describe('useSelectionGesture', () => {
  it('starts with no Selection', () => {
    expect(setup().gesture.selection.value).toBeUndefined()
  })

  describe('a Select press', () => {
    it('marks a single-cell Selection as soon as it begins', () => {
      const { gesture } = setup()

      gesture.beginPress(1, 2)

      expect(gesture.selection.value).toEqual({ top: 1, left: 2, rows: 1, columns: 1 })
    })

    it('grows the Selection to wherever the drag has reached, in either direction', () => {
      const { gesture } = setup()

      gesture.beginPress(2, 2)
      gesture.extendPress(0, 1)

      expect(gesture.selection.value).toEqual({ top: 0, left: 1, rows: 3, columns: 2 })
    })

    it('does nothing with no Project open', () => {
      const { gesture } = setup(null)

      gesture.beginPress(0, 0)
      gesture.extendPress(1, 1)

      expect(gesture.selection.value).toBeUndefined()
    })

    it('a drag ending commits nothing', () => {
      const { gesture, commitGridChange } = setup()

      gesture.beginPress(0, 0)
      gesture.extendPress(1, 1)
      gesture.endPress()

      expect(commitGridChange).not.toHaveBeenCalled()
    })

    it('ignores a move or an end with no press in progress', () => {
      const { gesture, commitGridChange } = setup()

      gesture.extendPress(1, 1)
      gesture.endPress()

      expect(gesture.selection.value).toBeUndefined()
      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  describe('Copy and Paste by click', () => {
    it('Copy clears the Selection and arms paste mode at once (ticket 437)', () => {
      const project = paintedProject()
      const { gesture } = setup(project)
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()

      expect(gesture.copy()).toBe(true)

      expect(gesture.selection.value).toBeUndefined()
      expect(gesture.hasClipboard()).toBe(true)
      expect(gesture.pasteProjectionActive.value).toBe(true)
      expect(gesture.pastePreviewCells(project, { row: 2, column: 2 })).toEqual([{ row: 2, column: 2, color: RED }])
    })

    it('Copy of a Selection with no drawn bead copies nothing and keeps the Selection', () => {
      const { gesture } = setup(paintedProject())
      gesture.beginPress(3, 3)
      gesture.extendPress(3, 3)
      gesture.endPress()

      expect(gesture.copy()).toBe(false)

      expect(gesture.hasClipboard()).toBe(false)
      expect(gesture.pasteProjectionActive.value).toBe(false)
      expect(gesture.selection.value).toBeDefined()
    })

    it('Cut copies, clears the Selection and arms paste mode, as Copy does (ticket 447)', () => {
      const { gesture } = setup(paintedProject())
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()

      expect(gesture.cut()).toBe(true)

      expect(gesture.hasClipboard()).toBe(true)
      expect(gesture.pasteProjectionActive.value).toBe(true)
      expect(gesture.selection.value).toBeUndefined()
    })

    it('armPaste turns paste mode back on without stamping, and refuses with an empty clipboard (ticket 447)', () => {
      const { gesture, harness } = setup(paintedProject())
      expect(gesture.armPaste()).toBe(false)
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()
      gesture.copy()
      gesture.dismissPaste()
      expect(gesture.pasteProjectionActive.value).toBe(false)
      const before = harness.project

      expect(gesture.armPaste()).toBe(true)

      expect(gesture.pasteProjectionActive.value).toBe(true)
      expect(harness.project).toBe(before)
    })

    it('Copy with no Selection does nothing', () => {
      const project = paintedProject()
      const { gesture } = setup(project)

      gesture.copy()

      expect(gesture.pastePreviewCells(project, { row: 0, column: 0 })).toEqual([])
    })

    it('a click that never moved stamps the copied block as an Edit', () => {
      const project = paintedProject()
      const { gesture, commitGridChange, harness } = setup(project)
      copyTopLeft(gesture)

      gesture.beginPress(2, 3)
      gesture.endPress()

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      expect(frameGrid(harness.project)[2]![3]!.color).toBe(RED)

      harness.history.onUndo()
      expect(frameGrid(harness.project)[2]![3]!.color).toBeNull()
    })

    it('does not start a Selection on a click while a projection is armed', () => {
      const { gesture } = setup(paintedProject())
      copyTopLeft(gesture)

      gesture.beginPress(1, 1)

      expect(gesture.selection.value).toBeUndefined()
    })

    it('a drag in paste mode is one stamp at the press point and never selects (ticket 437)', () => {
      const { gesture, commitGridChange, harness } = setup(paintedProject())
      copyTopLeft(gesture)

      gesture.beginPress(1, 1)
      gesture.extendPress(2, 2)
      gesture.extendPress(3, 3)
      gesture.endPress()

      expect(gesture.selection.value).toBeUndefined()
      expect(commitGridChange).toHaveBeenCalledTimes(1)
      expect(frameGrid(harness.project)[1]![1]!.color).toBe(RED)
      expect(gesture.pasteProjectionActive.value).toBe(true)
    })

    it('after leaving paste mode a drag selects again and drops the clipboard', () => {
      const { gesture, commitGridChange } = setup(paintedProject())
      copyTopLeft(gesture)
      gesture.dismissPaste()

      gesture.beginPress(1, 1)
      gesture.extendPress(2, 2)
      gesture.endPress()

      expect(commitGridChange).not.toHaveBeenCalled()
      expect(gesture.selection.value).toEqual({ top: 1, left: 1, rows: 2, columns: 2 })
      expect(gesture.hasClipboard()).toBe(false)
    })

    it('leaving paste mode keeps the clipboard, and pasteAt re-arms it', () => {
      const { gesture } = setup(paintedProject())
      copyTopLeft(gesture)

      gesture.dismissPaste()
      expect(gesture.pasteProjectionActive.value).toBe(false)
      expect(gesture.hasClipboard()).toBe(true)

      expect(gesture.pasteAt({ row: 2, column: 2 })).toBe(true)
      expect(gesture.pasteProjectionActive.value).toBe(true)
    })

    it('can stamp the same block again without copying again', () => {
      const { gesture, commitGridChange } = setup(paintedProject())
      copyTopLeft(gesture)

      gesture.beginPress(1, 1)
      gesture.endPress()
      gesture.beginPress(3, 3)
      gesture.endPress()

      expect(commitGridChange).toHaveBeenCalledTimes(2)
    })

    it('stamps every Mirror copy of the block as one commit, using the supplied axis counts and copy mode', () => {
      const project = paintedProject()
      const { gesture, commitGridChange, harness } = setup(project, { axes: { columns: 1, rows: 0 }, copyMode: false })
      copyTopLeft(gesture)

      gesture.beginPress(0, 0)
      gesture.endPress()

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      expect(frameGrid(harness.project)[0]!.map((cell: { color: string | null }) => cell.color)).toEqual([RED, null, null, RED])
    })
  })

  describe('Cut and Fill (ticket 415)', () => {
    it('Cut copies the Selection and empties it as one Undo step, then clears the Selection', () => {
      const { gesture, harness } = setup(paintedProject())
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()

      gesture.cut()

      expect(gesture.hasClipboard()).toBe(true)
      expect(gesture.selection.value).toBeUndefined()
      expect(frameGrid(harness.project)[0]![0]!.color).toBeNull()

      harness.history.onUndo()
      expect(frameGrid(harness.project)[0]![0]!.color).toBe(RED)
    })

    it('Fill gives every position in the Selection the colour, empty ones too, as one Undo step', () => {
      const { gesture, harness } = setup(paintedProject())
      gesture.beginPress(0, 0)
      gesture.extendPress(1, 1)
      gesture.endPress()

      gesture.fill('#00ff00')

      for (const [row, column] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        expect(frameGrid(harness.project)[row!]![column!]!.color).toBe('#00ff00')
      }
      harness.history.onUndo()
      expect(frameGrid(harness.project)[0]![0]!.color).toBe(RED)
      expect(frameGrid(harness.project)[1]![1]!.color).toBeNull()
    })

    it('Fill with no Selection does nothing', () => {
      const { gesture, commitGridChange } = setup(paintedProject())
      gesture.fill('#00ff00')
      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  describe('pastePreviewCells', () => {
    it('is empty with nothing copied', () => {
      const project = makeProject()
      const { gesture } = setup(project)

      expect(gesture.pastePreviewCells(project, { row: 0, column: 0 })).toEqual([])
    })

    it('shows every Mirror copy, honouring copy mode', () => {
      const project = paintedProject()
      const { gesture } = setup(project, { axes: { columns: 1, rows: 0 }, copyMode: true })
      copyTopLeft(gesture)

      const cells = gesture.pastePreviewCells(project, { row: 0, column: 0 })

      expect(cells).toEqual(
        expect.arrayContaining([
          { row: 0, column: 0, color: RED },
          { row: 0, column: 2, color: RED },
        ]),
      )
      expect(cells).toHaveLength(2)
    })
  })

  describe('cancel (Escape / right-click, once the app shell has given precedence to nothing else)', () => {
    it('dismisses an armed paste projection first, leaving the block pasteable by keyboard', () => {
      const project = paintedProject()
      const { gesture, commitGridChange } = setup(project)
      copyTopLeft(gesture)

      expect(gesture.cancel()).toBe(true)
      expect(gesture.cancel()).toBe(false)

      expect(gesture.pastePreviewCells(project, { row: 0, column: 0 })).toEqual([])
      expect(gesture.pasteAt({ row: 1, column: 1 })).toBe(true)
      expect(commitGridChange).toHaveBeenCalledTimes(1)
    })

    it('a click after cancelling marks a Selection rather than stamping', () => {
      const { gesture, commitGridChange } = setup(paintedProject())
      copyTopLeft(gesture)
      gesture.cancel()

      gesture.beginPress(1, 1)
      gesture.endPress()

      expect(gesture.selection.value).toEqual({ top: 1, left: 1, rows: 1, columns: 1 })
      expect(commitGridChange).not.toHaveBeenCalled()
    })

    it('clears the Selection when no projection is armed', () => {
      const { gesture } = setup()
      gesture.beginPress(0, 0)

      gesture.cancel()

      expect(gesture.selection.value).toBeUndefined()
    })

    it('does not revive a Selection while cancelling a projection', () => {
      const { gesture } = setup(paintedProject())
      copyTopLeft(gesture)

      gesture.cancel()

      expect(gesture.selection.value).toBeUndefined()
    })
  })

  describe('pasteAt (Ctrl/Cmd+V)', () => {
    it('stamps at the given cell through commitGridChange and reports it pasted', () => {
      const project = paintedProject()
      const { gesture, harness } = setup(project)
      copyTopLeft(gesture)

      expect(gesture.pasteAt({ row: 3, column: 3 })).toBe(true)

      expect(frameGrid(harness.project)[3]![3]!.color).toBe(RED)
    })

    it('is a no-op with nothing copied', () => {
      const { gesture, commitGridChange } = setup()

      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(false)
      expect(commitGridChange).not.toHaveBeenCalled()
    })

    it('is a no-op with the pointer off the grid', () => {
      const { gesture, commitGridChange } = setup(paintedProject())
      copyTopLeft(gesture)

      expect(gesture.pasteAt(undefined)).toBe(false)
      expect(commitGridChange).not.toHaveBeenCalled()
    })

    it('is a no-op with no Project open', () => {
      const { gesture, commitGridChange } = setup(null)

      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(false)
      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  describe('leaveSelectTool', () => {
    it('forgets the Selection and dismisses the projection, but keeps the clipboard for keyboard paste', () => {
      const project = paintedProject()
      const { gesture } = setup(project)
      copyTopLeft(gesture)
      gesture.beginPress(2, 2)
      gesture.endPress()
      gesture.cancel()
      gesture.beginPress(1, 1)

      gesture.leaveSelectTool()

      expect(gesture.selection.value).toBeUndefined()
      expect(gesture.pastePreviewCells(project, { row: 0, column: 0 })).toEqual([])
      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(true)
    })
  })

  describe('deleteSelection', () => {
    it('clears the selected cells as one commit, leaving the Selection in place', () => {
      const project = paintAt(makeProject(), [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 3, column: 3 }], RED, NO_MIRROR_AXES)
      const { gesture, commitGridChange, harness } = setup(project)
      gesture.beginPress(0, 0)
      gesture.extendPress(1, 1)

      gesture.deleteSelection()

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      expect(frameGrid(harness.project)[0]![0]!.color).toBeNull()
      expect(frameGrid(harness.project)[1]![1]!.color).toBeNull()
      expect(frameGrid(harness.project)[3]![3]!.color).toBe(RED)
      expect(gesture.selection.value).toEqual({ top: 0, left: 0, rows: 2, columns: 2 })
    })

    it('does nothing without a Selection', () => {
      const { gesture, commitGridChange } = setup(paintedProject())

      gesture.deleteSelection()

      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  describe('clearSelection', () => {
    it('clears the Selection but leaves the clipboard armed, as on a Project switch (ADR 0016)', () => {
      const project = paintedProject()
      const { gesture } = setup(project)
      copyTopLeft(gesture)
      gesture.beginPress(1, 1)
      gesture.extendPress(2, 2)
      gesture.copy()
      gesture.beginPress(3, 3)
      gesture.cancel()

      gesture.clearSelection()

      expect(gesture.selection.value).toBeUndefined()
      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(true)
    })

    it('clears a marked Selection', () => {
      const { gesture } = setup()
      gesture.beginPress(1, 1)

      gesture.clearSelection()

      expect(gesture.selection.value).toBeUndefined()
    })
  })

  describe('Piece and Select all (ticket 414)', () => {
    /** Two Pieces: a pair at the top left and a lone bead at (3, 3), on a 4 x 4 loom. */
    function twoPieces() {
      let project = makeProject()
      project = paintAt(project, [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 3, column: 3 }], RED, NO_MIRROR_AXES)
      return setup(project)
    }

    it('a tap on a bead selects its Piece\'s rectangle', () => {
      const { gesture } = twoPieces()

      gesture.tapPiece(1, 1)

      expect(gesture.selection.value).toEqual({ top: 0, left: 0, rows: 2, columns: 2 })
    })

    it('a tap on empty space clears the Selection', () => {
      const { gesture } = twoPieces()
      gesture.tapPiece(0, 0)

      gesture.tapPiece(2, 0)

      expect(gesture.selection.value).toBeUndefined()
    })

    it('a new Piece Selection drops what was copied', () => {
      const { gesture } = twoPieces()
      gesture.tapPiece(0, 0)
      gesture.copy()
      expect(gesture.hasClipboard()).toBe(true)

      gesture.tapPiece(3, 3)

      expect(gesture.hasClipboard()).toBe(false)
    })

    it('Select all selects the rectangle round every bead without a Frame, and does nothing on an empty canvas', () => {
      const { gesture, harness } = twoPieces()
      const framed = harness.currentProject()!
      harness.replaceProject({ ...framed, beads: framed.frame!.beads, frame: undefined })
      expect(gesture.selectAll()).toBe(true)
      expect(gesture.selection.value).toEqual({ top: 0, left: 0, rows: 4, columns: 4 })

      const empty = setup(withFrame(makeProject(), undefined))
      expect(empty.gesture.selectAll()).toBe(false)
      expect(empty.gesture.selection.value).toBeUndefined()
    })

    it('Select all selects the Frame\'s inside when there is a Frame (ticket 428)', () => {
      const framed = withFrame(makeProject(), { row: 5, column: 6, rows: 7, columns: 8 })
      const { gesture } = setup(framed)
      expect(gesture.selectAll()).toBe(true)
      expect(gesture.selection.value).toEqual({ top: 5, left: 6, rows: 7, columns: 8 })
    })
  })

  describe('a Selection against the Frame (ADR 0066)', () => {
    const frame = { row: 10, column: 10, rows: 4, columns: 6 }
    const framed = () => setup(withFrame(makeProject(), frame))

    it('is any rectangle: a drag ends where the pointer does, across the Frame\'s edge too', () => {
      const { gesture } = framed()
      gesture.beginPress(11, 11)
      gesture.extendPress(8, 12)
      expect(gesture.selection.value).toEqual({ top: 8, left: 11, rows: 4, columns: 2 })
    })

    it('begins on a position right against the Frame', () => {
      const { gesture } = framed()
      gesture.beginPress(9, 11)
      expect(gesture.selection.value).toEqual({ top: 9, left: 11, rows: 1, columns: 1 })
    })

    it('a Piece tap selects the tapped bead\'s side only', () => {
      const inFrame = [{ row: 11, column: 11 }, { row: 11, column: 12 }]
      const onCanvas = [{ row: 2, column: 2 }, { row: 2, column: 3 }, { row: 9, column: 11 }]
      const { gesture } = setup(paintAt(paintAt(withFrame(makeProject(), frame), inFrame, RED, NO_MIRROR_AXES), onCanvas, RED, NO_MIRROR_AXES))
      gesture.tapPiece(11, 11)
      expect(gesture.selection.value).toEqual({ top: 11, left: 11, rows: 1, columns: 2 })
      gesture.tapPiece(2, 2)
      expect(gesture.selection.value).toEqual({ top: 2, left: 2, rows: 1, columns: 2 })
      gesture.tapPiece(9, 11)
      expect(gesture.selection.value).toEqual({ top: 9, left: 11, rows: 1, columns: 1 })
    })
  })

  describe('a Canvas bead against the Frame (ADR 0066)', () => {
    const frame = { row: 10, column: 10, rows: 4, columns: 6 }
    const against = () => {
      const project = withFrame(makeProject(), frame)
      return setup({ ...project, beads: { 9: { 11: RED } }, frame: { ...project.frame!, beads: { 1: { 1: RED } } } })
    }

    it('a drag from outside across the whole Frame selects it, and Copy takes the Canvas beads of its layer', () => {
      const { gesture, harness } = against()
      gesture.beginPress(2, 2)
      gesture.extendPress(30, 30)
      gesture.endPress()
      expect(gesture.selection.value).toEqual({ top: 2, left: 2, rows: 29, columns: 29 })
      expect(gesture.copy()).toBe(true)
      expect(gesture.pastePreviewCells(harness.currentProject()!, { row: 40, column: 40 })).toHaveLength(1)
    })

    it('Cut on a Selection that begins on the Canvas and goes round the whole Frame empties the bead against it, and leaves the Frame', () => {
      const { gesture, harness } = against()
      gesture.beginPress(2, 2)
      gesture.extendPress(30, 30)
      gesture.endPress()
      gesture.cut()
      expect(harness.currentProject()!.beads[9]?.[11]).toBeUndefined()
      expect(harness.currentProject()!.frame!.beads[1]?.[1]).toBe(RED)
    })

    it('Cut on Select all empties the Frame and leaves the bead against it', () => {
      const { gesture, harness } = against()
      gesture.selectAll()
      gesture.cut()
      expect(harness.currentProject()!.beads[9]?.[11]).toBe(RED)
      expect(harness.currentProject()!.frame!.beads[1]?.[1]).toBeUndefined()
    })
  })

  describe('handles (ticket 414)', () => {
    function selected() {
      const harness = setup()
      harness.gesture.beginPress(1, 1)
      harness.gesture.extendPress(2, 2)
      harness.gesture.endPress()
      return harness.gesture
    }

    it('dragging a handle resizes the Selection by the sides it stands on', () => {
      const gesture = selected()

      gesture.beginAdjust({ kind: 'handle', edges: ['bottom', 'right'] }, { row: 2, column: 2 }, 'select')
      gesture.dragAdjust({ row: 3, column: 3 })
      gesture.endAdjust()

      expect(gesture.selection.value).toEqual({ top: 1, left: 1, rows: 3, columns: 3 })
    })

    it('dragging inside moves the outline and leaves the beads alone', () => {
      const { gesture, harness } = (() => {
        const made = setup(paintedProject())
        made.gesture.beginPress(0, 0)
        made.gesture.extendPress(1, 1)
        made.gesture.endPress()
        return made
      })()
      const before = harness.currentProject()!.beads

      gesture.beginAdjust({ kind: 'inside' }, { row: 0, column: 0 }, 'select')
      gesture.dragAdjust({ row: 1, column: 2 })
      gesture.endAdjust()

      expect(gesture.selection.value).toEqual({ top: 1, left: 2, rows: 2, columns: 2 })
      expect(harness.currentProject()!.beads).toBe(before)
    })

    it('a press inside that never moves is a tap: one bead under Select, the bead\'s Piece under Piece', () => {
      const gesture = selected()
      gesture.beginAdjust({ kind: 'inside' }, { row: 2, column: 1 }, 'select')
      gesture.endAdjust()
      expect(gesture.selection.value).toEqual({ top: 2, left: 1, rows: 1, columns: 1 })

      const piece = selected()
      piece.beginAdjust({ kind: 'inside' }, { row: 2, column: 1 }, 'piece')
      piece.endAdjust()
      expect(piece.selection.value).toBeUndefined()
    })
  })
})
