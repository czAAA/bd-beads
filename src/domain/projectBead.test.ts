// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { moveToRow } from './rowProgress'
import { normalizeProject } from './storedProject'
import { replaceBead, resolveProjectBead, projectCell } from './projectBead'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { estimatedSizeMm } from './projectSize'
import { paintAt } from '../testUtils/layers'
import { turnedClockwise } from '../testUtils/rotated'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('resolveProjectBead', () => {
  it("finds the Project's Bead in the catalog", () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    expect(resolveProjectBead(project)).toEqual(cubeBead)
  })

  it('returns undefined for a Bead the catalog no longer has (a removed custom Bead, or an unrecognized imported one)', () => {
    const project = {
      ...createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
      beadId: 'no-such-bead',
      bead: undefined,
    }

    expect(resolveProjectBead(project)).toBeUndefined()
  })
})

describe('replaceBead', () => {
  /** 4 columns x 2 rows of TOHO Round, each cell painted with a distinct color so a change to the grid is checkable. */
  function distinctlyPainted(): Project {
    let project = createProject({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 4, height: 2, unit: 'beads' },
    })
    for (let row = 0; row < project.frame!.rows; row++) {
      for (let column = 0; column < project.frame!.columns; column++) {
        project = paintAt(project, [{ row: row, column: column }], `r${row}c${column}`)
      }
    }
    return project
  }

  it('switches the Bead id', () => {
    const replaced = replaceBead(distinctlyPainted(), cubeBead)

    expect(replaced.beadId).toBe(cubeBead.id)
  })

  it.each(BEAD_CATALOG.flatMap((from) => BEAD_CATALOG.filter((to) => to !== from).map((to) => [from, to] as const)))(
    'keeps the grid, columns, rows and every painted cell exactly as they were, from %s to %s',
    (from, to) => {
      const before = { ...distinctlyPainted(), beadId: from.id }

      const replaced = replaceBead(before, to)

      expect(replaced.frame).toBe(before.frame)
      expect(replaced.beads).toBe(before.beads)
    },
  )

  it('keeps Row progress exactly as it was', () => {
    const before = moveToRow(distinctlyPainted(), 1)

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.rowProgress).toBe(before.rowProgress)
  })

  it('keeps name, technique and rotation exactly as they were', () => {
    const before = turnedClockwise(distinctlyPainted())

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.name).toBe(before.name)
    expect(replaced.technique).toBe(before.technique)
    expect(replaced.rotation).toBe(before.rotation)
  })

  it('works on a Project that was created in mm too, since nothing of the mm size is kept', () => {
    const before = createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 15, height: 30, unit: 'mm' } })

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.frame!.columns).toBe(before.frame!.columns)
    expect(replaced.frame!.rows).toBe(before.frame!.rows)
  })

  it('bumps updatedAt', () => {
    const before = { ...distinctlyPainted(), updatedAt: 0 }

    expect(replaceBead(before, cubeBead).updatedAt).toBeGreaterThan(0)
  })
})

describe('a Project carries a copy of its Bead (ticket 534, ADR 0072)', () => {
  const made = () => createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 10, height: 10, unit: 'beads' } })
  const retired = { ...cubeBead, id: 'old-maker/cube/2mm', widthMm: 2, heightMm: 2, retired: true }

  it('saves the copy without the retired flag', () => {
    expect(made().bead).toEqual(cubeBead)
    expect(replaceBead(made(), retired).bead).not.toHaveProperty('retired')
  })

  it('draws and sizes a Bead the catalog has dropped from the Project’s own copy', () => {
    const project = { ...made(), beadId: retired.id, bead: retired, beadShape: 'real' as const }
    const opened = normalizeProject(project)

    expect(resolveProjectBead(opened)).toMatchObject({ id: retired.id, widthMm: 2 })
    expect(projectCell(opened)).toBeDefined()
    expect(estimatedSizeMm(opened.frame!, resolveProjectBead(opened)!).widthMm).toBe(20)
  })

  it('keeps the Project’s numbers when the catalog’s Bead of that id changes, until it is replaced', () => {
    const older = normalizeProject({ ...made(), bead: { ...cubeBead, widthMm: 2, heightMm: 2 } })

    expect(estimatedSizeMm(older.frame!, resolveProjectBead(older)!).widthMm).toBe(20)
    expect(estimatedSizeMm(replaceBead(older, cubeBead).frame!, resolveProjectBead(replaceBead(older, cubeBead))!).widthMm).toBe(15)
  })

  it('gives a Project with no copy the catalog’s Bead, read through the alias map, and lets an unknown id stay unknown', () => {
    const { bead: _copy, ...without } = { ...made(), beadId: 'toho-cube-1.5mm' }
    expect(normalizeProject(without)).toMatchObject({ beadId: 'toho/cube/1.5mm', bead: cubeBead })

    const { bead: _gone, ...unknown } = { ...made(), beadId: 'no-such-bead' }
    expect(resolveProjectBead(normalizeProject(unknown))).toBeUndefined()
  })

  it('falls back to the catalog when the stored copy is not a Bead', () => {
    expect(normalizeProject({ ...made(), bead: { id: 3 } as never }).bead).toEqual(cubeBead)
  })

  it('puts the copy back with Undo of a Replace Bead', () => {
    const before = made()
    const replaced = replaceBead(before, retired)
    expect(restoreSnapshot(replaced, snapshotOf(before)).bead).toEqual(cubeBead)
  })
})
