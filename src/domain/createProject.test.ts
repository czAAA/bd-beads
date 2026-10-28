// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject, createProjectFromImage } from './createProject'
import { BEAD_CATALOG } from './beads'
import { frameGrid } from '../testUtils/frameGrid'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('createProject Brick block (ticket 477)', () => {
  const input = { technique: 'brick' as const, beadId: 'toho-cube-1.5mm' }

  it('stores a Brick block above 1, clamped to 20, and nothing for 1', () => {
    expect(createProject({ ...input, brickBlock: 3 }).brickBlock).toBe(3)
    expect(createProject({ ...input, brickBlock: 99 }).brickBlock).toBe(20)
    expect(createProject({ ...input, brickBlock: 1 })).not.toHaveProperty('brickBlock')
    expect(createProject(input)).not.toHaveProperty('brickBlock')
  })
})

describe('createProject', () => {
  it('builds a Loom project with an empty grid sized from the physical dimensions', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(project.technique).toBe('loom')
    expect(project.beadId).toBe(cubeBead.id)
    expect(project.frame!.columns).toBe(10)
    expect(project.frame!.rows).toBe(20)
    expect(frameGrid(project)).toHaveLength(20)
    expect(frameGrid(project)[0]).toHaveLength(10)
  })

  it('takes a size in beads as the columns and rows directly', () => {
    const project = createProject({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 12, height: 7, unit: 'beads' },
    })

    expect(project.frame!.columns).toBe(12)
    expect(project.frame!.rows).toBe(7)
    expect(frameGrid(project)).toHaveLength(7)
    expect(frameGrid(project)[0]).toHaveLength(12)
  })

  it('derives the grid once from an mm or cm size and keeps no real-world size', () => {
    const fromMm = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    const fromCm = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 1.5, height: 3, unit: 'cm' } })

    expect(fromCm.frame!.columns).toBe(fromMm.frame!.columns)
    expect(fromCm.frame!.rows).toBe(fromMm.frame!.rows)
    expect(fromMm).not.toHaveProperty('widthMm')
    expect(fromMm).not.toHaveProperty('heightMm')
  })

  it('fills every cell with an empty (unpainted) color', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    for (const row of frameGrid(project)) {
      for (const cell of row) {
        expect(cell.color).toBeNull()
      }
    }
  })

  it('assigns a unique id and a createdAt timestamp', () => {
    const a = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })
    const b = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toBeTypeOf('number')
  })

  it.each(['peyote', 'brick'] as const)('builds a %s project the same way as a loom one', (technique) => {
    const project = createProject({
      technique,
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(project.technique).toBe(technique)
    expect(project.frame!.columns).toBe(10)
    expect(project.frame!.rows).toBe(20)
    expect(frameGrid(project)).toHaveLength(20)
  })

  it('throws when the bead id is not in the catalog', () => {
    expect(() =>
      createProject({
        technique: 'loom',
        beadId: 'unknown-bead',
        size: { width: 3, height: 3, unit: 'mm' },
      }),
    ).toThrow()
  })

  it('defaults the name to the bead label when none is given', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(project.name).toBe('TOHO Cube 1.5mm')
  })

  it('defaults the name to the bead label when given a blank name', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '   ',
    })

    expect(project.name).toBe('TOHO Cube 1.5mm')
  })

  it('uses the given name when one is provided', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '  My Bracelet  ',
    })

    expect(project.name).toBe('My Bracelet')
  })

  it('has no maker name override when none is given (ticket 182)', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(project.makerName).toBeUndefined()
  })

  it('trims and keeps a given maker name override (ticket 182)', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      makerName: '  Bead Master  ',
    })

    expect(project.makerName).toBe('Bead Master')
  })

  it('has no maker name override when given a blank one (ticket 182)', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      makerName: '   ',
    })

    expect(project.makerName).toBeUndefined()
  })
})

describe('createProjectFromImage', () => {
  const converted = {
    grid: [
      [{ color: '#ff0000' }, { color: null }],
      [{ color: '#00ff00' }, { color: '#0000ff' }],
    ],
  }

  function fromImage(overrides: Partial<typeof converted> = {}) {
    return createProjectFromImage({
      name: 'Fox',
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' }, // 2 columns x 2 rows in 1.5mm cubes
      ...converted,
      ...overrides,
    })
  }

  it('creates an ordinary Project that arrives already painted', () => {
    const project = fromImage()

    expect(project.frame!.columns).toBe(2)
    expect(project.frame!.rows).toBe(2)
    expect(frameGrid(project).map((row) => row.map((cell) => cell.color))).toEqual([
      ['#ff0000', null],
      ['#00ff00', '#0000ff'],
    ])
    expect(project.name).toBe('Fox')
    expect(project.rowProgress).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('fits a grid that does not match the stated size rather than contradicting its own dimensions', () => {
    const project = fromImage({ grid: [[{ color: '#ff0000' }, { color: '#ff0000' }, { color: '#ff0000' }]] })

    expect(frameGrid(project)).toEqual([
      [{ color: '#ff0000' }, { color: '#ff0000' }],
      [{ color: null }, { color: null }],
    ])
  })
})
