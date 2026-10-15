import { describe, expect, it } from 'vitest'
import { editHarness } from '../../testUtils/editHarness'
import { useSelectionGesture } from './useSelectionGesture'
import { BEAD_CATALOG } from '../../domain/beads'
import { NO_MIRROR_AXES, type MirrorAxisCounts } from '../../domain/mirror'
import { createProject, frameGrid, paintCells, withFrame, type Project } from '../../domain/project'

const cubeBeadId = BEAD_CATALOG[0]!.id
const RED = '#e63746'

/** 4 columns x 4 rows, loom. */
function makeProject(): Project {
  return createProject({ technique: 'loom', beadId: cubeBeadId, size: { width: 6, height: 6, unit: 'mm' } })
}

function paintedProject(): Project {
  return paintCells(makeProject(), [{ row: 0, column: 0 }], RED, NO_MIRROR_AXES)
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

    it('Cut copies without arming paste mode and keeps the Selection', () => {
      const { gesture } = setup(paintedProject())
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()

      gesture.cut()

      expect(gesture.hasClipboard()).toBe(true)
      expect(gesture.pasteProjectionActive.value).toBe(false)
      expect(gesture.selection.value).toBeDefined()
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
    it('Cut copies the Selection and empties it as one Undo step, keeping the Selection', () => {
      const { gesture, harness } = setup(paintedProject())
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()

      gesture.cut()

      expect(gesture.hasClipboard()).toBe(true)
      expect(gesture.selection.value).toBeDefined()
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
      const project = paintCells(makeProject(), [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 3, column: 3 }], RED, NO_MIRROR_AXES)
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

  describe('selectLine (ruler click)', () => {
    it('sets the Selection and drops a copied block, the same as a new drag would', () => {
      const project = paintedProject()
      const { gesture } = setup(project)
      copyTopLeft(gesture)

      gesture.selectLine({ top: 2, left: 0, rows: 1, columns: 4 })

      expect(gesture.selection.value).toEqual({ top: 2, left: 0, rows: 1, columns: 4 })
      expect(gesture.pastePreviewCells(project, { row: 0, column: 0 })).toEqual([])
      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(false)
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
      project = paintCells(project, [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 3, column: 3 }], RED, NO_MIRROR_AXES)
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
      harness.replaceProject(withFrame(harness.currentProject()!, undefined))
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

  describe('the keep-out margin (ticket 428)', () => {
    it('clamps a drag that ends in the margin to the Frame\'s edge', () => {
      const { gesture } = setup(withFrame(makeProject(), { row: 10, column: 10, rows: 4, columns: 6 }))
      gesture.beginPress(11, 11)
      gesture.extendPress(8, 12)
      expect(gesture.selection.value).toEqual({ top: 10, left: 11, rows: 2, columns: 2 })
    })
  })

  describe('every path keeps out of the margin (ticket 433)', () => {
    const frame = { row: 10, column: 10, rows: 4, columns: 6 }
    const framed = () => setup(withFrame(makeProject(), frame))

    it('refuses a drag that starts in the margin', () => {
      const { gesture } = framed()
      gesture.beginPress(8, 11)
      expect(gesture.extendPress(12, 12)).toBe(false)
      expect(gesture.selection.value).toBeUndefined()
    })

    it('reports a drag the margin held back, and one that reached its cell', () => {
      const { gesture } = framed()
      gesture.beginPress(11, 11)
      expect(gesture.extendPress(11, 12)).toBe(true)
      expect(gesture.extendPress(8, 12)).toBe(false)
    })

    it('a ruler number selects the Frame\'s part of the line, and nothing outside the Frame', () => {
      const { gesture } = framed()
      expect(gesture.selectLine({ top: 11, left: 0, rows: 1, columns: 100 })).toBe(true)
      expect(gesture.selection.value).toEqual({ top: 11, left: 10, rows: 1, columns: 6 })
      expect(gesture.selectLine({ top: 8, left: 0, rows: 1, columns: 100 })).toBe(false)
      expect(gesture.selection.value).toEqual({ top: 11, left: 10, rows: 1, columns: 6 })
    })

    it('a Piece tap selects the tapped bead\'s side only, and a tap in the margin is refused with the cue', () => {
      const beads = [{ row: 11, column: 11 }, { row: 11, column: 12 }, { row: 2, column: 2 }, { row: 2, column: 3 }, { row: 8, column: 11 }]
      const { gesture } = setup(paintCells(withFrame(makeProject(), frame), beads, RED, NO_MIRROR_AXES))
      gesture.tapPiece(11, 11)
      expect(gesture.selection.value).toEqual({ top: 11, left: 11, rows: 1, columns: 2 })
      gesture.tapPiece(2, 2)
      expect(gesture.selection.value).toEqual({ top: 2, left: 2, rows: 1, columns: 2 })
      const before = gesture.refusals.value
      gesture.tapPiece(8, 11)
      expect(gesture.selection.value).toEqual({ top: 2, left: 2, rows: 1, columns: 2 })
      expect(gesture.refusals.value).toBe(before + 1)
    })
  })

  describe('a legacy Project with beads in the margin (ticket 433)', () => {
    const frame = { row: 10, column: 10, rows: 4, columns: 6 }
    const legacy = () => {
      const project = withFrame(makeProject(), frame)
      return setup({ ...project, beads: { 8: { 11: RED }, 11: { 11: RED } } })
    }

    it('no path can select a margin bead: drag, ruler, key and Piece tap all keep out', () => {
      const { gesture } = legacy()
      gesture.beginPress(8, 11)
      expect(gesture.extendPress(8, 11)).toBe(false)
      expect(gesture.selection.value).toBeUndefined()
      gesture.tapPiece(8, 11)
      expect(gesture.selection.value).toBeUndefined()
      expect(gesture.selectLine({ top: 8, left: 0, rows: 1, columns: 100 })).toBe(false)
      expect(gesture.selection.value).toBeUndefined()
    })

    it('a drag from outside across the whole Frame and its margin selects them, and Copy takes the beads, margin ones too', () => {
      const { gesture, harness } = legacy()
      gesture.beginPress(2, 2)
      expect(gesture.extendPress(30, 30)).toBe(true)
      gesture.endPress()
      expect(gesture.selection.value).toEqual({ top: 2, left: 2, rows: 29, columns: 29 })
      expect(gesture.copy()).toBe(true)
      expect(gesture.pastePreviewCells(harness.currentProject()!, { row: 40, column: 40 })).toHaveLength(2)
    })

    it('Cut and Clear selection leave a margin bead alone, while Erase still clears it', () => {
      const { gesture, harness } = legacy()
      gesture.selectAll()
      gesture.cut()
      expect(harness.currentProject()!.beads[8]?.[11]).toBe(RED)
      expect(harness.currentProject()!.beads[11]?.[11]).toBeUndefined()
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
