// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { takeInOutside, mostRecentlyUpdated, summarizeProject } from './projectLibrary'
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

describe('takeInOutside (tickets 0834, 1019)', () => {
  /** A library entry: an id and the version it is at, so a test can tell two copies of one Project apart. */
  const entry = (id: string, version = 1) => ({ id, version })
  type Entry = ReturnType<typeof entry>
  const known = (...entries: Entry[]) => new Map(entries.map((each) => [each.id, each]))
  const outside = (changed: Entry[] = [], gone: string[] = []) => ({ changed, gone })

  it('takes in a Project another tab made, which this tab has never seen', () => {
    const alpha = entry('alpha')
    const beta = entry('beta')

    expect(takeInOutside([alpha], known(alpha), outside([beta])).library).toEqual([alpha, beta])
  })

  it("keeps this tab's change over the stored copy, and takes the stored copy of the rest", () => {
    const alpha = entry('alpha')
    const beta = entry('beta')
    const changed = entry('alpha', 2)

    const taken = takeInOutside([changed, beta], known(alpha, beta), outside([entry('alpha', 5), entry('beta', 3)]))

    expect(taken.library).toEqual([changed, entry('beta', 3)])
    // The stored copy is what this tab now knows, so the change here still counts as made here.
    expect(taken.known.get('alpha')).toEqual(entry('alpha', 5))
  })

  it('leaves a Project removed here removed, even when another tab changed it', () => {
    const alpha = entry('alpha')
    const beta = entry('beta')

    expect(takeInOutside([beta], known(alpha, beta), outside([entry('alpha', 2)])).library).toEqual([beta])
  })

  it('removes a Project another tab removed, even when this tab changed it after', () => {
    const alpha = entry('alpha')
    const beta = entry('beta')

    const taken = takeInOutside([entry('alpha', 2), beta], known(alpha, beta), outside([], ['alpha']))

    expect(taken.library).toEqual([beta])
    expect([...taken.known.keys()]).toEqual(['beta'])
  })

  it('takes the stored copy of a Project this tab may not change, but still removes it when asked', () => {
    const alpha = entry('alpha')
    const drawnThere = entry('alpha', 3)
    const notHere = (id: string) => id !== 'alpha'

    expect(takeInOutside([entry('alpha', 2)], known(alpha), outside([drawnThere]), notHere).library).toEqual([drawnThere])
    expect(takeInOutside([entry('alpha', 2)], known(alpha), outside([], ['alpha']), notHere).library).toEqual([])
  })

  it('changes nothing when nothing changed', () => {
    const alpha = entry('alpha')

    expect(takeInOutside([alpha], known(alpha), outside()).library).toEqual([alpha])
  })
})
