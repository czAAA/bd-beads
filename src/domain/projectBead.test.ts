// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { moveToRow, rowProgressOf } from './rowProgress'
import { normalizeProject } from './storedProject'
import { replaceBead, resolveProjectBead, projectCell } from './projectBead'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import type { Project } from './project'
import { BEAD_CATALOG, beadCopy } from './beads'
import { estimatedSizeMm } from './projectSize'
import { paintAt } from '../testUtils/layers'
import { turnedClockwise } from '../testUtils/rotated'
import { beadsOfLayer, canvasOf, frameOf, orientationOf } from './layerRecord'
import { withLayers } from '../testUtils/layerFields'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('resolveProjectBead', () => {
  it("finds the Project's Bead in the catalog", () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    expect(resolveProjectBead(project)).toEqual(beadCopy(cubeBead))
  })

  it('returns undefined for a Bead the catalog no longer has (a removed custom Bead, or an unrecognized imported one)', () => {
    const project = withLayers(createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }), {
beadId: 'no-such-bead',
      bead: undefined,
})

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
    for (let row = 0; row < frameOf(project)!.rows; row++) {
      for (let column = 0; column < frameOf(project)!.columns; column++) {
        project = paintAt(project, [{ row: row, column: column }], `r${row}c${column}`)
      }
    }
    return project
  }

  it("switches the woven layer's Bead id: the Frame's, the Canvas keeping its own (ticket 0665)", () => {
    const replaced = replaceBead(distinctlyPainted(), cubeBead)

    expect(frameOf(replaced)!.beadId).toBe(cubeBead.id)
    expect(canvasOf(replaced).beadId).toBe(roundBead.id)
  })

  it.each(BEAD_CATALOG.flatMap((from) => BEAD_CATALOG.filter((to) => to !== from).map((to) => [from, to] as const)))(
    'keeps the grid, columns, rows and every painted cell exactly as they were, from %s to %s',
    (from, to) => {
      const before = withLayers(distinctlyPainted(), { beadId: from.id })

      const replaced = replaceBead(before, to)

      expect(beadsOfLayer(replaced, 'frame')).toBe(beadsOfLayer(before, 'frame'))
      expect(beadsOfLayer(replaced, 'canvas')).toBe(beadsOfLayer(before, 'canvas'))
    },
  )

  it('keeps Row progress exactly as it was', () => {
    const before = moveToRow(distinctlyPainted(), 1)

    const replaced = replaceBead(before, cubeBead)

    expect(rowProgressOf(replaced)).toBe(rowProgressOf(before))
  })

  it('keeps name, technique and rotation exactly as they were', () => {
    const before = turnedClockwise(distinctlyPainted())

    const replaced = replaceBead(before, cubeBead)

    expect(canvasOf(replaced).name).toBe(canvasOf(before).name)
    expect(canvasOf(replaced).technique).toBe(canvasOf(before).technique)
    expect(orientationOf(replaced)).toBe(orientationOf(before))
  })

  it('works on a Project that was created in mm too, since nothing of the mm size is kept', () => {
    const before = createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 15, height: 30, unit: 'mm' } })

    const replaced = replaceBead(before, cubeBead)

    expect(frameOf(replaced)!.columns).toBe(frameOf(before)!.columns)
    expect(frameOf(replaced)!.rows).toBe(frameOf(before)!.rows)
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
    expect(canvasOf(made()).bead).toEqual(beadCopy(cubeBead))
    expect(frameOf(replaceBead(made(), retired))!.bead).not.toHaveProperty('retired')
  })

  it('draws and sizes a Bead the catalog has dropped from the Project’s own copy', () => {
    const project = withLayers(made(), { beadId: retired.id, bead: retired })
    const opened = normalizeProject(project)

    expect(resolveProjectBead(opened)).toMatchObject({ id: retired.id, widthMm: 2 })
    expect(projectCell(opened)).toBeDefined()
    expect(estimatedSizeMm(frameOf(opened)!, resolveProjectBead(opened)!, frameOf(opened)!.technique).widthMm).toBe(20)
  })

  it('keeps the Project’s numbers when the catalog’s Bead of that id changes, until it is replaced', () => {
    const older = normalizeProject(withLayers(made(), { bead: { ...cubeBead, widthMm: 2, heightMm: 2 } }))

    expect(estimatedSizeMm(frameOf(older)!, resolveProjectBead(older)!, frameOf(older)!.technique).widthMm).toBe(20)
    expect(estimatedSizeMm(frameOf(replaceBead(older, cubeBead))!, resolveProjectBead(replaceBead(older, cubeBead))!, frameOf(older)!.technique).widthMm).toBe(15)
  })

  it('gives a Project with no copy the catalog’s Bead, read through the alias map, and lets an unknown id stay unknown', () => {
    const without = withLayers(made(), { beadId: 'toho-cube-1.5mm', bead: undefined })
    expect(canvasOf(normalizeProject(without))).toMatchObject({ beadId: 'toho/cube/1.5mm', bead: beadCopy(cubeBead) })

    const unknown = withLayers(made(), { beadId: 'no-such-bead', bead: undefined })
    expect(resolveProjectBead(normalizeProject(unknown))).toBeUndefined()
  })

  it('falls back to the catalog when the stored copy is not a Bead', () => {
    expect(canvasOf(normalizeProject(withLayers(made(), { bead: { id: 3 } as never }))).bead).toEqual(beadCopy(cubeBead))
  })

  it('puts the copy back with Undo of a Replace Bead', () => {
    const before = made()
    const replaced = replaceBead(before, retired)
    expect(frameOf(restoreSnapshot(replaced, snapshotOf(before)))!.bead).toEqual(beadCopy(cubeBead))
  })
})

describe('each layer has its own Bead (ticket 0665, ADR 0079)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const made = () => createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 4, height: 2, unit: 'beads' } })

  it("replaces the Canvas's Bead when asked, leaving the Frame's, the woven one, and the Palette as they were", () => {
    const before = made()
    const replaced = replaceBead(before, delica, undefined, 'canvas')
    expect(canvasOf(replaced).beadId).toBe(delica.id)
    expect(frameOf(replaced)!.beadId).toBe(roundBead.id)
    expect(replaced.palette).toBe(before.palette)
    expect(resolveProjectBead(replaced)).toEqual(beadCopy(roundBead))
  })

  it("replaces the Canvas's Bead on a Project with no Frame, whichever layer is asked, and the Palette follows it", () => {
    const open = withLayers(made(), { frame: undefined })
    const replaced = replaceBead(open, delica, undefined, 'frame')
    expect(canvasOf(replaced).beadId).toBe(delica.id)
    expect(replaced.palette).toContain('beige')
  })

  it("moves the Palette with the Frame's Bead, and one Undo puts both back", () => {
    const before = made()
    const replaced = replaceBead(before, delica)
    expect(replaced.palette).toContain('beige')
    const undone = restoreSnapshot(replaced, snapshotOf(before))
    expect(frameOf(undone)!.beadId).toBe(roundBead.id)
    expect(undone.palette).toEqual(before.palette)
  })

  it('reads the Project\'s Bead and how it is drawn from the woven layer, the Frame', () => {
    const project = replaceBead(made(), delica)
    expect(resolveProjectBead(project)).toEqual(beadCopy(delica))
    expect(projectCell(project)!.aspect).toBeCloseTo(delica.heightMm / delica.widthMm)
  })
})
