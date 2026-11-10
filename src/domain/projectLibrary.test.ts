// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { mergeLibrary, mostRecentlyUpdated, summarizeProject } from './projectLibrary'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { turnedClockwise } from '../testUtils/rotated'
import { withFrameSheet } from './layerRecord'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

describe('summarizeProject', () => {
  it('describes the project by its name and grid dimensions', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
      name: 'My Bracelet',
    })

    expect(summarizeProject(project)).toBe('My Bracelet · 10×20')
  })

  it('states no size for a canvas with no Frame: just the name', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' }, name: 'Sketch' }), undefined)
    expect(summarizeProject(open as Project)).toBe('Sketch')
  })

  it('falls back to the bead label when the project has no custom name', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(summarizeProject(project)).toBe('TOHO Cube 1.5mm · 10×20')
  })

  it('swaps the dimensions when the rotated view flag is on, describing how the Project currently looks', () => {
    const project = turnedClockwise(
      createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 30, unit: 'mm' },
        name: 'My Bracelet',
      }),
    )

    expect(summarizeProject(project)).toBe('My Bracelet · 20×10')
  })
})

describe('mostRecentlyUpdated', () => {
  it('returns undefined for an empty list', () => {
    expect(mostRecentlyUpdated([])).toBeUndefined()
  })

  it('returns the project with the greatest updatedAt', () => {
    const older = { ...createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 100 }
    const newer = { ...createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 200 }

    expect(mostRecentlyUpdated([older, newer])).toBe(newer)
    expect(mostRecentlyUpdated([newer, older])).toBe(newer)
  })
})

describe('mergeLibrary (ticket 0834)', () => {
  /** A library entry: an id and the version it is at, so a test can tell two copies of one Project apart. */
  const entry = (id: string, version = 1) => ({ id, version })
  type Entry = ReturnType<typeof entry>
  const known = (...entries: Entry[]) => new Map(entries.map((each) => [each.id, each]))

  it('keeps a Project another tab stored that this tab has never seen', () => {
    const alpha = entry('alpha')
    const beta = entry('beta')

    expect(mergeLibrary([alpha], known(alpha), [alpha, beta])).toEqual([alpha, beta])
  })

  it("writes this tab's change over the stored copy, and only that Project", () => {
    const alpha = entry('alpha')
    const beta = entry('beta')
    const changed = entry('alpha', 2)

    expect(mergeLibrary([changed, beta], known(alpha, beta), [alpha, entry('beta', 3)])).toEqual([changed, entry('beta', 3)])
  })

  it('adds a Project made here', () => {
    const alpha = entry('alpha')
    const made = entry('gamma')

    expect(mergeLibrary([made, alpha], known(alpha), [alpha])).toEqual([alpha, made])
  })

  it('leaves out a Project removed here, and keeps out one another tab removed', () => {
    const alpha = entry('alpha')
    const beta = entry('beta')

    expect(mergeLibrary([beta], known(alpha, beta), [alpha, beta])).toEqual([beta])
    expect(mergeLibrary([alpha, beta], known(alpha, beta), [beta])).toEqual([beta])
  })

  it('keeps a Project removed even when this tab changed it after', () => {
    const alpha = entry('alpha')

    expect(mergeLibrary([entry('alpha', 2)], known(alpha), [])).toEqual([])
  })

  it('takes the stored copy of a Project this tab may not change, but still removes it when asked', () => {
    const alpha = entry('alpha')
    const drawnThere = entry('alpha', 3)
    const notHere = (id: string) => id !== 'alpha'

    expect(mergeLibrary([entry('alpha', 2)], known(alpha), [drawnThere], notHere)).toEqual([drawnThere])
    expect(mergeLibrary([], known(alpha), [drawnThere], notHere)).toEqual([])
  })
})
