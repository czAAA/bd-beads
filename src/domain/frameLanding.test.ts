import { describe, expect, it } from 'vitest'
import { landedClear } from './frameLanding'
import { frameMet } from './frameSpacing'
import { createProject } from './createProject'
import { frameById } from './layerRecord'
import { MARGIN } from './margin'
import { twoFrames, SECOND, firstOf } from '../testUtils/twoFrames'
import { frameIdIn } from '../testUtils/frameId'
import { placeOf } from '../testUtils/placeOf'
import type { Project } from '../domain/project'

/** The Project of `twoFrames` with its second Frame put at `at`, as a new Frame lies before it is nudged. */
const second = (at: { row: number; column: number }): Project => twoFrames(at)

describe('landedClear (spec 1214, ticket 1222)', () => {
  it('leaves a Frame that meets no other where it is', () => {
    const project = second({ row: 20, column: 20 })
    expect(landedClear(project, SECOND)).toBe(project)
  })

  it('moves a Frame that lies in another to the nearest place clear of its margin, whole cycles away', () => {
    const project = second({ row: 1, column: 1 })
    expect(frameMet(project, SECOND)).toBe(firstOf(project))
    const landed = landedClear(project, SECOND)
    expect(frameMet(landed, SECOND)).toBeUndefined()
    const [first, moved] = [placeOf(landed, firstOf(landed)), placeOf(landed, SECOND)]
    // The nearest clear places lie a Frame and two margins away, along a side: nothing nearer was free.
    const gap = Math.max(moved.row - (first.row + first.rows), first.row - (moved.row + moved.rows), moved.column - (first.column + first.columns), first.column - (moved.column + moved.columns))
    expect(gap).toBe(2 * MARGIN)
    expect(frameById(landed, SECOND)).toMatchObject({ rows: 6, columns: 4 })
  })

  it('stands on its own: a Project with one Frame has nothing to meet', () => {
    const solo = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    expect(landedClear(solo, frameIdIn(solo))).toBe(solo)
  })
})
