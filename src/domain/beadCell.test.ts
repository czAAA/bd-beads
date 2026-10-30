// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadPitchMm, findBead } from './beads'
import { canvasWeave } from './layerWeave'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import { projectCell } from './projectBead'
import { parseProjectsFile, serializeProject } from './projectFile'
import { beadCell, positionStep } from './weave'
import { canvasOf } from './layerRecord'
import { bareProject } from '../testUtils/layerFields'

const delica = findBead('miyuki-delica-11-0')!
const round = findBead('toho-round-11-0')!
const cube = findBead('toho-cube-1.5mm')!

describe('the Bead cell geometry (ticket 0724)', () => {
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

  it('steps a row pitch of the Bead height down and a bead across', () => {
    const cell = beadCell(delica)!
    expect(positionStep({ technique: 'peyote', cell }).down).toBeCloseTo(0.75 * cell.aspect)
    expect(positionStep({ technique: 'loom', cell }).across).toBe(1)
  })

  it('leaves the Technique\'s own cell for a Bead nobody knows', () => {
    expect(beadCell(undefined)).toBeUndefined()
    expect(projectCell(bareProject({}))).toBeUndefined()
  })
})

describe('the Bead cell in a Project', () => {
  const made = () => createProject({ technique: 'peyote', beadId: delica.id })

  it('draws a new Project in its Bead\'s cell', () => {
    expect(canvasWeave(made()).cell).toEqual(beadCell(delica))
  })

  it('reads an older file that still carries a Bead shape as the Bead\'s cell, saving it without the key', () => {
    const project = made()
    const older = { ...project, layers: project.layers.map((layer) => ({ ...layer, beadShape: 'symmetric' })) }
    const read = normalizeProject(older as never)
    expect('beadShape' in canvasOf(read)).toBe(false)
    expect(canvasWeave(read).cell).toEqual(beadCell(delica))
    const [saved] = parseProjectsFile(serializeProject(read)).projects
    expect(JSON.stringify(saved)).not.toContain('beadShape')
  })
})
