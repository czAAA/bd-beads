import { describe, expect, it, vi } from 'vitest'
import { useSelectionGesture } from './useSelectionGesture'
import { BEAD_CATALOG } from '../../domain/beads'
import { NO_MIRROR_AXES, type MirrorAxisCounts } from '../../domain/mirror'
import { createPattern, paintCells, type Pattern } from '../../domain/pattern'

const cubeBeadId = BEAD_CATALOG[0]!.id
const RED = '#e63746'

/** 4 columns x 4 rows, loom. */
function makePattern(): Pattern {
  return createPattern({ technique: 'loom', beadId: cubeBeadId, size: { width: 6, height: 6, unit: 'mm' } })
}

function paintedPattern(): Pattern {
  return paintCells(makePattern(), [{ row: 0, column: 0 }], RED, NO_MIRROR_AXES)
}

function setup(
  pattern: Pattern | null = makePattern(),
  { axes = NO_MIRROR_AXES, copyMode = false }: { axes?: MirrorAxisCounts; copyMode?: boolean } = {},
) {
  const commitGridChange = vi.fn()
  const gesture = useSelectionGesture(
    () => pattern ?? undefined,
    commitGridChange,
    () => axes,
    () => copyMode,
  )
  return { gesture, commitGridChange }
}

/** Drags a Selection over the top-left cell and copies it, leaving a paste projection armed. */
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

    it('does nothing with no Pattern open', () => {
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
    it('Copy clears the Selection marquee straight away and arms a paste preview', () => {
      const pattern = paintedPattern()
      const { gesture } = setup(pattern)
      gesture.beginPress(0, 0)
      gesture.extendPress(0, 0)
      gesture.endPress()

      gesture.copy()

      expect(gesture.selection.value).toBeUndefined()
      expect(gesture.pastePreviewCells(pattern, { row: 2, column: 2 })).toEqual([
        { row: 2, column: 2, color: RED },
      ])
    })

    it('Copy with no Selection does nothing', () => {
      const pattern = paintedPattern()
      const { gesture } = setup(pattern)

      gesture.copy()

      expect(gesture.pastePreviewCells(pattern, { row: 0, column: 0 })).toEqual([])
    })

    it('a click that never moved stamps the copied block through the shared commitGridChange', () => {
      const pattern = paintedPattern()
      const { gesture, commitGridChange } = setup(pattern)
      copyTopLeft(gesture)

      gesture.beginPress(2, 3)
      gesture.endPress()

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      const [committed, updated] = commitGridChange.mock.calls[0]!
      expect(committed).toBe(pattern)
      expect(updated.grid[2]![3]!.color).toBe(RED)
    })

    it('does not start a Selection on a click while a projection is armed', () => {
      const { gesture } = setup(paintedPattern())
      copyTopLeft(gesture)

      gesture.beginPress(1, 1)

      expect(gesture.selection.value).toBeUndefined()
    })

    it('a drag drops the clipboard, so the click that ends it stamps nothing', () => {
      const pattern = paintedPattern()
      const { gesture, commitGridChange } = setup(pattern)
      copyTopLeft(gesture)

      gesture.beginPress(1, 1)
      gesture.extendPress(2, 2)
      gesture.endPress()

      expect(commitGridChange).not.toHaveBeenCalled()
      expect(gesture.pastePreviewCells(pattern, { row: 0, column: 0 })).toEqual([])
    })

    it('can stamp the same block again without copying again', () => {
      const { gesture, commitGridChange } = setup(paintedPattern())
      copyTopLeft(gesture)

      gesture.beginPress(1, 1)
      gesture.endPress()
      gesture.beginPress(3, 3)
      gesture.endPress()

      expect(commitGridChange).toHaveBeenCalledTimes(2)
    })

    it('stamps every Mirror copy of the block as one commit, using the supplied axis counts and copy mode', () => {
      const pattern = paintedPattern()
      const { gesture, commitGridChange } = setup(pattern, { axes: { columns: 1, rows: 0 }, copyMode: false })
      copyTopLeft(gesture)

      gesture.beginPress(0, 0)
      gesture.endPress()

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      const [, updated] = commitGridChange.mock.calls[0]!
      expect(updated.grid[0]!.map((cell: { color: string | null }) => cell.color)).toEqual([RED, null, null, RED])
    })
  })

  describe('pastePreviewCells', () => {
    it('is empty with nothing copied', () => {
      const pattern = makePattern()
      const { gesture } = setup(pattern)

      expect(gesture.pastePreviewCells(pattern, { row: 0, column: 0 })).toEqual([])
    })

    it('shows every Mirror copy, honouring copy mode', () => {
      const pattern = paintedPattern()
      const { gesture } = setup(pattern, { axes: { columns: 1, rows: 0 }, copyMode: true })
      copyTopLeft(gesture)

      const cells = gesture.pastePreviewCells(pattern, { row: 0, column: 0 })

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
      const pattern = paintedPattern()
      const { gesture, commitGridChange } = setup(pattern)
      copyTopLeft(gesture)

      expect(gesture.cancel()).toBe(true)
      expect(gesture.cancel()).toBe(false)

      expect(gesture.pastePreviewCells(pattern, { row: 0, column: 0 })).toEqual([])
      expect(gesture.pasteAt({ row: 1, column: 1 })).toBe(true)
      expect(commitGridChange).toHaveBeenCalledTimes(1)
    })

    it('a click after cancelling marks a Selection rather than stamping', () => {
      const { gesture, commitGridChange } = setup(paintedPattern())
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
      const { gesture } = setup(paintedPattern())
      copyTopLeft(gesture)

      gesture.cancel()

      expect(gesture.selection.value).toBeUndefined()
    })
  })

  describe('pasteAt (Ctrl/Cmd+V)', () => {
    it('stamps at the given cell through commitGridChange and reports it pasted', () => {
      const pattern = paintedPattern()
      const { gesture, commitGridChange } = setup(pattern)
      copyTopLeft(gesture)

      expect(gesture.pasteAt({ row: 3, column: 3 })).toBe(true)

      const [committed, updated] = commitGridChange.mock.calls[0]!
      expect(committed).toBe(pattern)
      expect(updated.grid[3]![3]!.color).toBe(RED)
    })

    it('is a no-op with nothing copied', () => {
      const { gesture, commitGridChange } = setup()

      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(false)
      expect(commitGridChange).not.toHaveBeenCalled()
    })

    it('is a no-op with the pointer off the grid', () => {
      const { gesture, commitGridChange } = setup(paintedPattern())
      copyTopLeft(gesture)

      expect(gesture.pasteAt(undefined)).toBe(false)
      expect(commitGridChange).not.toHaveBeenCalled()
    })

    it('is a no-op with no Pattern open', () => {
      const { gesture, commitGridChange } = setup(null)

      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(false)
      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  describe('leaveSelectTool', () => {
    it('forgets the Selection and dismisses the projection, but keeps the clipboard for keyboard paste', () => {
      const pattern = paintedPattern()
      const { gesture } = setup(pattern)
      copyTopLeft(gesture)
      gesture.beginPress(2, 2)
      gesture.endPress()
      gesture.cancel()
      gesture.beginPress(1, 1)

      gesture.leaveSelectTool()

      expect(gesture.selection.value).toBeUndefined()
      expect(gesture.pastePreviewCells(pattern, { row: 0, column: 0 })).toEqual([])
      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(true)
    })
  })

  describe('deleteSelection', () => {
    it('clears the selected cells as one commit, leaving the Selection in place', () => {
      const pattern = paintCells(makePattern(), [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 3, column: 3 }], RED, NO_MIRROR_AXES)
      const { gesture, commitGridChange } = setup(pattern)
      gesture.beginPress(0, 0)
      gesture.extendPress(1, 1)

      gesture.deleteSelection()

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      const [committed, updated] = commitGridChange.mock.calls[0]!
      expect(committed).toBe(pattern)
      expect(updated.grid[0]![0]!.color).toBeNull()
      expect(updated.grid[1]![1]!.color).toBeNull()
      expect(updated.grid[3]![3]!.color).toBe(RED)
      expect(gesture.selection.value).toEqual({ top: 0, left: 0, rows: 2, columns: 2 })
    })

    it('does nothing without a Selection', () => {
      const { gesture, commitGridChange } = setup(paintedPattern())

      gesture.deleteSelection()

      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  describe('selectLine (ruler click)', () => {
    it('sets the Selection and drops a copied block, the same as a new drag would', () => {
      const pattern = paintedPattern()
      const { gesture } = setup(pattern)
      copyTopLeft(gesture)

      gesture.selectLine({ top: 2, left: 0, rows: 1, columns: 4 })

      expect(gesture.selection.value).toEqual({ top: 2, left: 0, rows: 1, columns: 4 })
      expect(gesture.pastePreviewCells(pattern, { row: 0, column: 0 })).toEqual([])
      expect(gesture.pasteAt({ row: 0, column: 0 })).toBe(false)
    })
  })

  describe('clearSelection', () => {
    it('clears the Selection but leaves the clipboard armed, as on a Pattern switch (ADR 0016)', () => {
      const pattern = paintedPattern()
      const { gesture } = setup(pattern)
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
})
