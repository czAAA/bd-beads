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
    expect(beadCell(delica, 'loom')!.aspect).toBeCloseTo(1.6 / 1.3)
    expect(beadCell(round, 'loom')!.aspect).toBeCloseTo(2.2 / beadPitchMm(round))
    expect(beadCell(cube, 'loom')!.aspect).toBe(1)
  })

  it('lays loom and peyote beads alike, their thread running left to right (ticket 0734)', () => {
    for (const bead of [delica, round, cube]) {
      expect(beadCell(bead, 'peyote')).toEqual(beadCell(bead, 'loom'))
    }
  })

  it('turns every bead on brick stitch, its thread running top to bottom: a wide cell for a tall one, a Cube unchanged (ticket 0734)', () => {
    expect(beadCell(delica, 'brick')!.aspect).toBeCloseTo(1.3 / 1.6)
    expect(beadCell(round, 'brick')!.aspect).toBeCloseTo(beadPitchMm(round) / 2.2)
    expect(beadCell(round, 'brick')!.aspect).toBeLessThan(1)
    expect(beadCell(cube, 'brick')!.aspect).toBe(1)
  })

  it('reads the Form factor\'s hole direction: a hole running across turns the bead the other way (ticket 0734)', () => {
    const sideways = { ...delica, formFactor: { ...delica.formFactor, holes: { count: 1, direction: 'across' as const } } }
    expect(beadCell(sideways, 'loom')!.aspect).toBeCloseTo(1.3 / 1.6)
    expect(beadCell(sideways, 'brick')!.aspect).toBeCloseTo(1.6 / 1.3)
  })

  it('rounds the outline from the Form factor: a cube square, a cylinder near sharp, a round bead a pill', () => {
    const [squareCorner, sharpCorner, pillCorner] = [cube, delica, round].map((bead) => beadCell(bead, 'loom')!.roundness)
    expect(squareCorner).toBe(0)
    expect(sharpCorner).toBeGreaterThan(0)
    expect(pillCorner).toBe(0.5)
    expect(sharpCorner).toBeLessThan(pillCorner)
  })

  it('leaves every Technique its own cell without a Bead', () => {
    for (const technique of TECHNIQUES) {
      const shaped = describeWeave({ technique, cell: beadCell(undefined, technique) })
      const plain = describeWeave({ technique })
      const { cellAspect, roundness } = plain
      expect({ cellAspect: shaped.cellAspect, roundness: shaped.roundness }).toEqual({ cellAspect, roundness })
      expect(shaped.box({ row: 3, column: 2 }, 20, 20 * cellAspect)).toEqual(plain.box({ row: 3, column: 2 }, 20, 20 * cellAspect))
    }
  })

  it('steps the Bead\'s height down and a bead across', () => {
    const cell = beadCell(delica, 'peyote')!
    expect(positionStep({ technique: 'peyote', cell }).down).toBeCloseTo(cell.aspect)
    expect(positionStep({ technique: 'loom', cell }).across).toBe(1)
  })
})

describe('a Bead\'s cell in a Project', () => {
  it('turns a brick stitch layer\'s cell, and only that layer\'s (ticket 0734)', () => {
    const framed = withLayers(createProject({ technique: 'peyote', beadId: delica.id }), { frame: { row: 0, column: 0, rows: 2, columns: 2, beads: {}, technique: 'brick' as const } })
    expect(canvasWeave(framed).cell).toEqual(beadCell(delica, 'peyote'))
    expect(frameWeave(framed).cell).toEqual(beadCell(delica, 'brick'))
    expect(projectCell(framed)).toEqual(beadCell(delica, 'brick'))
  })

  const made = () => createProject({ technique: 'peyote', beadId: delica.id })

  it('draws every layer in its own Bead\'s real cell from the start, saving no Bead shape', () => {
    const framed = withLayers(made(), { frame: { row: 0, column: 0, rows: 2, columns: 2, beads: {}, technique: 'loom' as const } })
    const cubed = withLayer(framed, 'frame', { bead: cube })
    expect(canvasWeave(cubed).cell).toEqual(beadCell(delica, 'peyote'))
    expect(frameWeave(cubed).cell).toEqual(beadCell(cube, 'loom'))
    expect(frameWeave(cubed).technique).toBe('loom')
    expect(cubed.layers.some((layer) => 'beadShape' in layer)).toBe(false)
  })

  it('draws a Bead this device does not know in the Technique\'s own cell', () => {
    expect(beadCell(undefined, 'peyote')).toBeUndefined()
    expect(projectCell(bareProject({}))).toBeUndefined()
  })

  it('reads a saved Bead shape of either value, or none, as the real cell, and writes none (ticket 0724)', () => {
    const project = made()
    for (const beadShape of ['symmetric', 'real', 'sideways', undefined]) {
      const stored = { ...project, layers: project.layers.map((layer) => ({ ...layer, ...(beadShape ? { beadShape } : {}) })) }
      const read = normalizeProject(stored as never)
      expect(canvasWeave(read).cell).toEqual(beadCell(delica, 'peyote'))
      expect('beadShape' in canvasOf(read)).toBe(false)
      const [saved] = parseProjectsFile(serializeProject(read)).projects
      expect(JSON.stringify(saved)).not.toContain('beadShape')
    }
  })
})
