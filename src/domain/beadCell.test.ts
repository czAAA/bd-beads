// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadPitchMm, findBead } from './beads'
import { canvasWeave, frameWeave } from './layerWeave'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import { projectCell } from './projectBead'
import { parseProjectsFile, serializeProject } from './projectFile'
import { beadCell, describeWeave, positionStep, TECHNIQUES } from './weave'
import { canvasOf, withLayer } from './layerRecord'
import { bareProject, withLayers } from '../testUtils/layerFields'

const delica = findBead('miyuki-delica-11-0')!
const round = findBead('toho-round-11-0')!
const cube = findBead('toho-cube-1.5mm')!

describe('a Bead\'s cell (ADR 0068, ticket 0724)', () => {
  it('gives each catalog Bead its proportions: height over its pitch along the thread', () => {
    expect(beadCell(delica)!.aspect).toBeCloseTo(1.3 / 1.6)
    expect(beadCell(round)!.aspect).toBeCloseTo(2.2 / beadPitchMm(round))
    expect(beadCell(cube)!.aspect).toBe(1)
  })

  it('rounds the outline from the Form factor: a cube square, a cylinder near sharp, a round bead a pill', () => {
    const [squareCorner, sharpCorner, pillCorner] = [cube, delica, round].map((bead) => beadCell(bead)!.roundness)
    expect(squareCorner).toBe(0)
    expect(sharpCorner).toBeGreaterThan(0)
    expect(pillCorner).toBe(0.5)
    expect(sharpCorner).toBeLessThan(pillCorner)
  })

  it('leaves every Technique its own cell without a Bead', () => {
    for (const technique of TECHNIQUES) {
      const shaped = describeWeave({ technique, cell: beadCell(undefined) })
      const plain = describeWeave({ technique })
      const { cellAspect, rowPitch, roundness } = plain
      expect({ cellAspect: shaped.cellAspect, rowPitch: shaped.rowPitch, roundness: shaped.roundness }).toEqual({ cellAspect, rowPitch, roundness })
      expect(shaped.box({ row: 3, column: 2 }, 20, 20 * cellAspect)).toEqual(plain.box({ row: 3, column: 2 }, 20, 20 * cellAspect))
    }
  })

  it('steps a row pitch of the Bead height down and a bead across', () => {
    const cell = beadCell(delica)!
    expect(positionStep({ technique: 'peyote', cell }).down).toBeCloseTo(0.75 * cell.aspect)
    expect(positionStep({ technique: 'loom', cell }).across).toBe(1)
  })
})

describe('a Bead\'s cell in a Project', () => {
  const made = () => createProject({ technique: 'peyote', beadId: delica.id })

  it('draws every layer in its own Bead\'s real cell from the start, saving no Bead shape', () => {
    const framed = withLayers(made(), { frame: { row: 0, column: 0, rows: 2, columns: 2, beads: {}, technique: 'loom' as const } })
    const cubed = withLayer(framed, 'frame', { bead: cube })
    expect(canvasWeave(cubed).cell).toEqual(beadCell(delica))
    expect(frameWeave(cubed).cell).toEqual(beadCell(cube))
    expect(frameWeave(cubed).technique).toBe('loom')
    expect(cubed.layers.some((layer) => 'beadShape' in layer)).toBe(false)
  })

  it('draws a Bead this device does not know in the Technique\'s own cell', () => {
    expect(beadCell(undefined)).toBeUndefined()
    expect(projectCell(bareProject({}))).toBeUndefined()
  })

  it('reads a saved Bead shape of either value, or none, as the real cell, and writes none (ticket 0724)', () => {
    const project = made()
    for (const beadShape of ['symmetric', 'real', 'sideways', undefined]) {
      const stored = { ...project, layers: project.layers.map((layer) => ({ ...layer, ...(beadShape ? { beadShape } : {}) })) }
      const read = normalizeProject(stored as never)
      expect(canvasWeave(read).cell).toEqual(beadCell(delica))
      expect('beadShape' in canvasOf(read)).toBe(false)
      const [saved] = parseProjectsFile(serializeProject(read)).projects
      expect(JSON.stringify(saved)).not.toContain('beadShape')
    }
  })
})
