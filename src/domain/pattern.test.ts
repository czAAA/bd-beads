import { describe, expect, it } from 'vitest'
import { createPattern } from './pattern'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

describe('createPattern', () => {
  it('builds a Loom pattern with an empty grid sized from the physical dimensions', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(pattern.technique).toBe('loom')
    expect(pattern.beadId).toBe(cubeBead.id)
    expect(pattern.columns).toBe(10)
    expect(pattern.rows).toBe(20)
    expect(pattern.grid).toHaveLength(20)
    expect(pattern.grid[0]).toHaveLength(10)
  })

  it('fills every cell with an empty (unpainted) color', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    for (const row of pattern.grid) {
      for (const cell of row) {
        expect(cell.color).toBeNull()
      }
    }
  })

  it('assigns a unique id and a createdAt timestamp', () => {
    const a = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })
    const b = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toBeTypeOf('number')
  })

  it('throws when the bead id is not in the catalog', () => {
    expect(() =>
      createPattern({
        technique: 'loom',
        beadId: 'unknown-bead',
        size: { width: 3, height: 3, unit: 'mm' },
      }),
    ).toThrow()
  })
})
