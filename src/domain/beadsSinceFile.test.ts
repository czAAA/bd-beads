// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { changedBeadCount, countedBeads, labelStep, lastFileAgo, saveThreshold, staleOnOpen, STALE_FILE_MS } from './beadsSinceFile'
import { withColors, type BeadMap } from './canvas'
import { deleteAll } from './drawing'
import { bareProject, withLayers } from '../testUtils/layerFields'
import type { FrameSheet } from './canvas'

const RED = '#e63746'
const BLUE = '#3366cc'
const sheet = (beads: BeadMap, place: Partial<FrameSheet> = {}): FrameSheet => ({ row: 0, column: 0, rows: 10, columns: 10, technique: 'loom', beads, ...place })
const painted = (cells: [number, number][], color = RED): BeadMap => withColors({}, cells.map(([row, column]) => ({ row, column, color })))

describe('changedBeadCount', () => {
  it('counts every position whose value changed, on the Canvas and in the Frame', () => {
    const before = bareProject({ beads: painted([[0, 0]]), frame: sheet(painted([[1, 1]])) })
    const after = withLayers(before, { beads: painted([[0, 0], [0, 1], [5, 5]]), frame: sheet(painted([[1, 1]], BLUE)) })

    expect(changedBeadCount(before, after)).toBe(3)
  })

  it('counts a bead taken away as a change, so painting a bead then erasing it counts 2', () => {
    const empty = bareProject({})
    const one = withLayers(empty, { beads: painted([[2, 3]]) })

    expect(changedBeadCount(empty, one) + changedBeadCount(one, withLayers(one, { beads: {} }))).toBe(2)
  })

  it('is the same both ways, so Undo takes off what the Edit added and Redo puts it back', () => {
    const before = bareProject({ beads: painted([[0, 0], [0, 1]]) })
    const after = withLayers(before, { beads: painted([[0, 1], [3, 3]], BLUE) })

    expect(changedBeadCount(before, after)).toBe(changedBeadCount(after, before))
  })

  it('counts Clear all beads', () => {
    const before = bareProject({ beads: painted([[0, 0], [1, 1]]), frame: sheet(painted([[2, 2]])) })

    expect(changedBeadCount(before, deleteAll(before))).toBe(3)
  })

  it('skips a layer whose Technique or Bead changed, and counts the other', () => {
    const before = bareProject({ beads: painted([[0, 0]]), frame: sheet(painted([[1, 1]])) })
    const newBead = { ...before, layers: [{ ...before.layers[0], beadId: 'toho/round/11-0', beads: {} }, before.layers[1]!] } as typeof before
    const newTechnique = withLayers(before, { frame: sheet(painted([[4, 4]]), { technique: 'peyote' }) })

    expect(changedBeadCount(before, newBead)).toBe(0)
    expect(changedBeadCount(before, newTechnique)).toBe(0)
    expect(changedBeadCount(before, withLayers(newTechnique, { beads: {} }))).toBe(1)
  })

  it('skips a Frame that moved, changed size or turned: no drawing', () => {
    const before = bareProject({ frame: sheet(painted([[1, 1]])) })

    expect(changedBeadCount(before, withLayers(before, { frame: sheet(painted([[1, 1]]), { row: 4 }) }))).toBe(0)
    expect(changedBeadCount(before, withLayers(before, { frame: sheet(painted([[2, 2]]), { rows: 12 }) }))).toBe(0)
    expect(changedBeadCount(before, withLayers(before, { frame: sheet(painted([[2, 2]]), { quarterTurns: 1 }) }))).toBe(0)
  })

  it('skips a Frame made or removed', () => {
    const before = bareProject({})

    expect(changedBeadCount(before, withLayers(before, { frame: sheet(painted([[1, 1]])) }))).toBe(0)
  })

  it('compares only the rows the two states do not share', () => {
    const shared = painted([[0, 0]])
    const before = bareProject({ beads: shared })
    const after = withLayers(before, { beads: { ...shared, 7: { 7: BLUE } } })

    expect(changedBeadCount(before, after)).toBe(1)
  })
})

describe('countedBeads', () => {
  it('adds and takes off, never below 0, keeping the last-file time', () => {
    expect(countedBeads({ beads: 3, lastFileAt: 9 }, 4)).toEqual({ beads: 7, lastFileAt: 9 })
    expect(countedBeads({ beads: 3 }, -5)).toEqual({ beads: 0 })
  })
})

describe('saveThreshold and labelStep', () => {
  it('is 50 beads, or 100 where the browser keeps storage', () => {
    expect(saveThreshold(false)).toBe(50)
    expect(saveThreshold(true)).toBe(100)
  })

  it('steps up at the threshold and every further 100 beads', () => {
    expect([0, 49, 50, 149, 150, 250].map((beads) => labelStep(beads, 50))).toEqual([-1, -1, 0, 0, 1, 2])
  })
})

describe('staleOnOpen', () => {
  const now = 100 * STALE_FILE_MS

  it('opens the label once for a Project at the threshold whose last file is 7 days old or more', () => {
    expect(staleOnOpen({ beads: 50, lastFileAt: now - STALE_FILE_MS }, 0, 50, now)).toBe(true)
    expect(staleOnOpen({ beads: 50, lastFileAt: now - STALE_FILE_MS + 1 }, 0, 50, now)).toBe(false)
    expect(staleOnOpen({ beads: 49, lastFileAt: 0 }, 0, 50, now)).toBe(false)
  })

  it('goes by the Project\'s creation when it never had a file', () => {
    expect(staleOnOpen({ beads: 60 }, now - STALE_FILE_MS, 50, now)).toBe(true)
    expect(staleOnOpen({ beads: 60 }, now - 1, 50, now)).toBe(false)
  })
})

describe('lastFileAgo', () => {
  const now = new Date(2026, 10, 5, 9).getTime()
  const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime()

  it('counts calendar days, then weeks, months and years', () => {
    expect(lastFileAgo(at(10, 5, 1), now)).toEqual({ value: 0, unit: 'day' })
    expect(lastFileAgo(at(10, 4, 23), now)).toEqual({ value: -1, unit: 'day' })
    expect(lastFileAgo(at(9, 22), now)).toEqual({ value: -2, unit: 'week' })
    expect(lastFileAgo(at(7, 1), now)).toEqual({ value: -3, unit: 'month' })
    expect(lastFileAgo(new Date(2024, 10, 1).getTime(), now)).toEqual({ value: -2, unit: 'year' })
  })
})
