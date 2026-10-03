import { describe, expect, it, vi } from 'vitest'
import { useMirrorState } from './useMirrorState'
import { BEAD_CATALOG } from '../../domain/beads'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { createPattern, frameGrid, paintCells, type Pattern } from '../../domain/pattern'

const cubeBeadId = BEAD_CATALOG[0]!.id

/** 4 columns x 4 rows, loom. */
function makePattern(): Pattern {
  return createPattern({ technique: 'loom', beadId: cubeBeadId, size: { width: 6, height: 6, unit: 'mm' } })
}

describe('useMirrorState', () => {
  it('starts with no axes, copy mode off, and nothing hovered', () => {
    const mirror = useMirrorState(() => undefined, vi.fn())

    expect(mirror.axisCounts.value).toEqual(NO_MIRROR_AXES)
    expect(mirror.copyMode.value).toBe(false)
    expect(mirror.previewedAxisCounts.value).toEqual(NO_MIRROR_AXES)
    expect(mirror.currentDimmedCells.value).toEqual([])
  })

  describe('setAxisCount', () => {
    it('clamps to the open Pattern current size', () => {
      const pattern = makePattern() // maxAxisCount(4) === 3
      const mirror = useMirrorState(() => pattern, vi.fn())

      mirror.setAxisCount('columns', 99)
      expect(mirror.axisCounts.value.columns).toBe(3)

      mirror.setAxisCount('columns', -5)
      expect(mirror.axisCounts.value.columns).toBe(0)
    })

    it('does nothing with no Pattern open', () => {
      const mirror = useMirrorState(() => undefined, vi.fn())

      mirror.setAxisCount('columns', 2)

      expect(mirror.axisCounts.value).toEqual(NO_MIRROR_AXES)
    })

    it('changes one direction without touching the other', () => {
      const pattern = makePattern()
      const mirror = useMirrorState(() => pattern, vi.fn())

      mirror.setAxisCount('columns', 2)
      mirror.setAxisCount('rows', 1)

      expect(mirror.axisCounts.value).toEqual({ columns: 2, rows: 1 })
    })
  })

  it('toggleCopyMode flips the switch', () => {
    const mirror = useMirrorState(() => undefined, vi.fn())

    mirror.toggleCopyMode()
    expect(mirror.copyMode.value).toBe(true)

    mirror.toggleCopyMode()
    expect(mirror.copyMode.value).toBe(false)
  })

  describe('previewedAxisCounts (ticket 47 hover preview)', () => {
    it('is exactly axisCounts with nothing hovered', () => {
      const pattern = makePattern()
      const mirror = useMirrorState(() => pattern, vi.fn())
      mirror.setAxisCount('columns', 2)

      expect(mirror.previewedAxisCounts.value).toEqual({ columns: 2, rows: 0 })
    })

    it('previews the hovered direction at its effective count (0 acts as 1), leaving the other alone', () => {
      const pattern = makePattern()
      const mirror = useMirrorState(() => pattern, vi.fn())
      mirror.setAxisCount('columns', 2)

      mirror.onHoverCurrent('vertical')

      expect(mirror.previewedAxisCounts.value).toEqual({ columns: 2, rows: 1 })
    })

    it('goes back to the stored counts once the pointer leaves', () => {
      const pattern = makePattern()
      const mirror = useMirrorState(() => pattern, vi.fn())

      mirror.onHoverCurrent('horizontal')
      mirror.onHoverCurrent(null)

      expect(mirror.previewedAxisCounts.value).toEqual(NO_MIRROR_AXES)
    })
  })

  describe('currentDimmedCells (ticket 47 hover preview)', () => {
    it('is empty with nothing hovered or no Pattern open', () => {
      const pattern = makePattern()
      const mirror = useMirrorState(() => pattern, vi.fn())

      expect(mirror.currentDimmedCells.value).toEqual([])
    })

    it('is what a "Mirror current" click on the hovered axis would actually change', () => {
      let pattern = makePattern()
      pattern = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
      const mirror = useMirrorState(() => pattern, vi.fn())

      mirror.onHoverCurrent('horizontal')

      // axisCount 0 acts as 1 axis (2 strips of 2 columns): column 3 gets column 0's color mirrored.
      expect(mirror.currentDimmedCells.value).toEqual([{ row: 0, column: 3 }])
    })
  })

  describe('mirrorCurrent', () => {
    it('commits through the given commitGridChange, not a private copy', () => {
      let pattern = makePattern()
      pattern = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
      const commitGridChange = vi.fn()
      const mirror = useMirrorState(() => pattern, commitGridChange)

      mirror.mirrorCurrent('horizontal')

      expect(commitGridChange).toHaveBeenCalledTimes(1)
      const [committedPattern, updated] = commitGridChange.mock.calls[0]!
      expect(committedPattern).toBe(pattern)
      expect(frameGrid(updated)[0]!.map((cell: { color: string | null }) => cell.color)).toEqual([
        '#e63746',
        null,
        null,
        '#e63746',
      ])
    })

    it('uses that direction own axis count and copy mode', () => {
      let pattern = makePattern()
      pattern = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
      const commitGridChange = vi.fn()
      const mirror = useMirrorState(() => pattern, commitGridChange)
      mirror.setAxisCount('columns', 1)
      mirror.toggleCopyMode()

      mirror.mirrorCurrent('horizontal')

      const [, updated] = commitGridChange.mock.calls[0]!
      // Copy mode on, 1 axis (2 strips of 2): column 2 (same relative offset in the other strip) takes the color.
      expect(frameGrid(updated)[0]!.map((cell: { color: string | null }) => cell.color)).toEqual([
        '#e63746',
        null,
        '#e63746',
        null,
      ])
    })

    it('does nothing with no Pattern open', () => {
      const commitGridChange = vi.fn()
      const mirror = useMirrorState(() => undefined, commitGridChange)

      mirror.mirrorCurrent('vertical')

      expect(commitGridChange).not.toHaveBeenCalled()
    })
  })

  it('restoreAxisCounts sets the counts directly, for an Undo/Redo snapshot', () => {
    const mirror = useMirrorState(() => undefined, vi.fn())

    mirror.restoreAxisCounts({ columns: 2, rows: 3 })

    expect(mirror.axisCounts.value).toEqual({ columns: 2, rows: 3 })
  })

  it('clearAxisCounts resets just the axis counts, leaving copy mode and hover alone', () => {
    const pattern = makePattern()
    const mirror = useMirrorState(() => pattern, vi.fn())
    mirror.setAxisCount('columns', 2)
    mirror.toggleCopyMode()
    mirror.onHoverCurrent('horizontal')

    mirror.clearAxisCounts()

    expect(mirror.axisCounts.value).toEqual(NO_MIRROR_AXES)
    expect(mirror.copyMode.value).toBe(true)
    expect(mirror.previewedAxisCounts.value).toEqual({ columns: 1, rows: 0 }) // still hovering horizontal
  })

  it('reset clears axis counts, copy mode and hover state together, on a Pattern switch', () => {
    const pattern = makePattern()
    const mirror = useMirrorState(() => pattern, vi.fn())
    mirror.setAxisCount('columns', 2)
    mirror.toggleCopyMode()
    mirror.onHoverCurrent('horizontal')

    mirror.reset()

    expect(mirror.axisCounts.value).toEqual(NO_MIRROR_AXES)
    expect(mirror.copyMode.value).toBe(false)
    expect(mirror.previewedAxisCounts.value).toEqual(NO_MIRROR_AXES)
  })
})
