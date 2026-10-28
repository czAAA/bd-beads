// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { mostRecentlyUpdated, summarizeProject } from './projectLibrary'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { turnedClockwise } from '../testUtils/rotated'

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
    const { frame: _frame, ...open } = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' }, name: 'Sketch' })
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
