// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, beadPitchMm, findBead } from './beads'
import { canvasWeave, frameWeave } from './layerWeave'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import { projectCell, withBeadShape } from './projectBead'
import { parseProjectsFile, serializeProject } from './projectFile'
import { beadCell, describeWeave, positionStep, TECHNIQUES } from './weave'

const delica = findBead('miyuki-delica-11-0')!
const round = findBead('toho-round-11-0')!
const cube = findBead('toho-cube-1.5mm')!

describe('the Bead shape geometry (ADR 0068)', () => {
  it('draws nothing of its own in Symmetric, for any Bead', () => {
    for (const bead of BEAD_CATALOG) {
      expect(beadCell(bead, 'symmetric')).toBeUndefined()
    }
  })

  it('gives each catalog Bead its proportions: height over its pitch along the thread', () => {
    expect(beadCell(delica, 'real')!.aspect).toBeCloseTo(1.3 / 1.6)
    expect(beadCell(round, 'real')!.aspect).toBeCloseTo(2.2 / beadPitchMm(round))
    expect(beadCell(cube, 'real')!.aspect).toBe(1)
  })

  it('rounds the outline from the Form factor: a cube square, a cylinder near sharp, a round bead a pill', () => {
    const [squareCorner, sharpCorner, pillCorner] = [cube, delica, round].map((bead) => beadCell(bead, 'real')!.roundness)
    expect(squareCorner).toBe(0)
    expect(sharpCorner).toBeGreaterThan(0)
    expect(pillCorner).toBe(0.5)
    expect(sharpCorner).toBeLessThan(pillCorner)
  })

  it('leaves every Technique as it was when the Bead shape is Symmetric', () => {
    for (const technique of TECHNIQUES) {
      const shaped = describeWeave({ technique, cell: beadCell(delica, 'symmetric') })
      const plain = describeWeave({ technique })
      const { cellAspect, rowPitch, roundness } = plain
      expect({ cellAspect: shaped.cellAspect, rowPitch: shaped.rowPitch, roundness: shaped.roundness }).toEqual({ cellAspect, rowPitch, roundness })
      expect(shaped.box({ row: 3, column: 2 }, 20, 20 * cellAspect)).toEqual(plain.box({ row: 3, column: 2 }, 20, 20 * cellAspect))
    }
  })

  it('steps a row pitch of the Bead height down and a bead across', () => {
    const cell = beadCell(delica, 'real')!
    expect(positionStep({ technique: 'peyote', cell }).down).toBeCloseTo(0.75 * cell.aspect)
    expect(positionStep({ technique: 'loom', cell }).across).toBe(1)
  })
})

describe('the Bead shape in a Project', () => {
  const made = (beadShape?: 'symmetric' | 'real') => createProject({ technique: 'peyote', beadId: delica.id, ...(beadShape ? { beadShape } : {}) })

  it('starts Symmetric and saves nothing for it', () => {
    expect(made().beadShape).toBeUndefined()
    expect(made('symmetric').beadShape).toBeUndefined()
    expect(canvasWeave(made()).cell).toBeUndefined()
  })

  it('applies the Bead to both layers when Real', () => {
    const real = withBeadShape(made(), 'real')
    const withFrame = { ...real, frame: { row: 0, column: 0, rows: 2, columns: 2, beads: {}, technique: 'loom' as const } }
    expect(canvasWeave(withFrame).cell).toEqual(beadCell(delica, 'real'))
    expect(frameWeave(withFrame).cell).toEqual(beadCell(delica, 'real'))
    expect(frameWeave(withFrame).technique).toBe('loom')
  })

  it('draws a Bead this device does not know as Symmetric', () => {
    expect(projectCell({ beadShape: 'real' })).toBeUndefined()
  })

  it('goes back to Symmetric without a leftover field', () => {
    expect('beadShape' in withBeadShape(withBeadShape(made(), 'real'), 'symmetric')).toBe(false)
  })

  it('travels with the Project file, and an older file reads as Symmetric', () => {
    const real = made('real')
    const [read] = parseProjectsFile(serializeProject(real)).projects
    expect(read!.beadShape).toBe('real')
    const { beadShape: _unset, ...older } = real
    expect(normalizeProject(older).beadShape).toBeUndefined()
    expect(normalizeProject({ ...real, beadShape: 'sideways' as never }).beadShape).toBeUndefined()
  })
})
