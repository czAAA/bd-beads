import { describe, expect, it } from 'vitest'
import {
  createPattern,
  fillArea,
  mirrorPattern,
  mostRecentlyUpdated,
  paintCell,
  restoreGrid,
  summarizePattern,
  type Cell,
  type Pattern,
  type Technique,
} from './pattern'
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

  it.each(['peyote', 'brick'] as const)('builds a %s pattern the same way as a loom one', (technique) => {
    const pattern = createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(pattern.technique).toBe(technique)
    expect(pattern.columns).toBe(10)
    expect(pattern.rows).toBe(20)
    expect(pattern.grid).toHaveLength(20)
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

  it('defaults the name to the bead label when none is given', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(pattern.name).toBe('TOHO Cube 1.5mm')
  })

  it('defaults the name to the bead label when given a blank name', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '   ',
    })

    expect(pattern.name).toBe('TOHO Cube 1.5mm')
  })

  it('uses the given name when one is provided', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '  My Bracelet  ',
    })

    expect(pattern.name).toBe('My Bracelet')
  })
})

describe('summarizePattern', () => {
  it('describes the pattern by its name and grid dimensions', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
      name: 'My Bracelet',
    })

    expect(summarizePattern(pattern)).toBe('My Bracelet · 10×20')
  })

  it('falls back to the bead label when the pattern has no custom name', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(summarizePattern(pattern)).toBe('TOHO Cube 1.5mm · 10×20')
  })
})

describe('paintCell', () => {
  function makePattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  it('sets the color of exactly the targeted cell', () => {
    const pattern = makePattern()

    const painted = paintCell(pattern, 1, 2, '#e63746')

    expect(painted.grid[1]![2]!.color).toBe('#e63746')
    for (let row = 0; row < painted.grid.length; row++) {
      for (let column = 0; column < painted.grid[row]!.length; column++) {
        if (row !== 1 || column !== 2) {
          expect(painted.grid[row]![column]!.color).toBeNull()
        }
      }
    }
  })

  it('does not mutate the original pattern', () => {
    const pattern = makePattern()

    paintCell(pattern, 0, 0, '#e63746')

    expect(pattern.grid[0]![0]!.color).toBeNull()
  })

  it('can clear a cell back to unpainted with a null color', () => {
    const pattern = makePattern()
    const painted = paintCell(pattern, 0, 0, '#e63746')

    const cleared = paintCell(painted, 0, 0, null)

    expect(cleared.grid[0]![0]!.color).toBeNull()
  })

  it('bumps updatedAt', () => {
    const pattern = { ...makePattern(), updatedAt: 0 }

    const painted = paintCell(pattern, 0, 0, '#e63746')

    expect(painted.updatedAt).toBeGreaterThan(0)
  })
})

describe('restoreGrid', () => {
  it('swaps in the given grid and bumps updatedAt, without mutating the original pattern', () => {
    const pattern = { ...createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }), updatedAt: 0 }
    const snapshot = paintCell(pattern, 0, 0, '#e63746').grid

    const restored = restoreGrid(pattern, snapshot)

    expect(restored.grid).toBe(snapshot)
    expect(restored.updatedAt).toBeGreaterThan(0)
    expect(pattern.grid[0]![0]!.color).toBeNull()
  })
})

describe('fillArea', () => {
  function makeGridPattern(technique: Technique, grid: Cell[][]): Pattern {
    const base = createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return { ...base, grid }
  }

  it('repaints every cell of the clicked color reachable through same-colored neighbors', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
    ])

    const filled = fillArea(pattern, 0, 0, 'green')

    expect(filled.grid[0]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(filled.grid[1]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(filled.grid[2]!.map((c) => c.color)).toEqual(['blue', 'blue', 'blue'])
  })

  it('does not spill across a differently-colored boundary', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'blue' }],
    ])

    const filled = fillArea(pattern, 0, 0, 'green')

    expect(filled.grid[0]![1]!.color).toBe('blue')
    expect(filled.grid[1]![1]!.color).toBe('blue')
  })

  it('returns the same pattern instance, unchanged, when the clicked cell already has the fill color', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    expect(fillArea(pattern, 0, 0, 'red')).toBe(pattern)
  })

  it('does not mutate the original pattern', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    fillArea(pattern, 0, 0, 'green')

    expect(pattern.grid[0]![0]!.color).toBe('red')
  })

  it("connects a diagonally-offset same-color cell for Peyote that a straight Loom grid would not", () => {
    const grid: Cell[][] = [
      [{ color: null }, { color: 'red' }],
      [{ color: 'red' }, { color: null }],
    ]

    const loomFilled = fillArea(makeGridPattern('loom', grid), 0, 1, 'green')
    const peyoteFilled = fillArea(makeGridPattern('peyote', grid), 0, 1, 'green')

    // Loom: (0,1)'s only straight neighbor below is (1,1), which is unpainted, so (1,0) stays red.
    expect(loomFilled.grid[1]![0]!.color).toBe('red')
    // Peyote: row 1 is shifted right, so (0,1) overlaps (1,0) and (1,1) below it, reaching the red cell.
    expect(peyoteFilled.grid[1]![0]!.color).toBe('green')
  })
})

describe('mirrorPattern', () => {
  function makeGridPattern(grid: Cell[][]): Pattern {
    const base = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return { ...base, grid }
  }

  function colors(pattern: Pattern): (string | null)[][] {
    return pattern.grid.map((row) => row.map((cell) => cell.color))
  }

  it('reflects the left half onto the right half for an even-width grid', () => {
    const pattern = makeGridPattern([[{ color: 'red' }, { color: 'blue' }, { color: null }, { color: null }]])

    const mirrored = mirrorPattern(pattern, { horizontal: true, vertical: false })

    expect(colors(mirrored)).toEqual([['red', 'blue', 'blue', 'red']])
  })

  it('leaves the center column as its own mirror for an odd-width grid', () => {
    const pattern = makeGridPattern([
      [{ color: 'red' }, { color: 'blue' }, { color: 'green' }, { color: null }, { color: null }],
    ])

    const mirrored = mirrorPattern(pattern, { horizontal: true, vertical: false })

    expect(colors(mirrored)).toEqual([['red', 'blue', 'green', 'blue', 'red']])
  })

  it('reflects the top half onto the bottom half for a vertical mirror', () => {
    const pattern = makeGridPattern([
      [{ color: 'red' }],
      [{ color: 'blue' }],
      [{ color: null }],
      [{ color: null }],
    ])

    const mirrored = mirrorPattern(pattern, { horizontal: false, vertical: true })

    expect(colors(mirrored)).toEqual([['red'], ['blue'], ['blue'], ['red']])
  })

  it('mirrors the top-left quadrant into all four quadrants when both axes are selected', () => {
    const pattern = makeGridPattern([
      [{ color: 'A' }, { color: 'B' }, { color: null }, { color: null }],
      [{ color: 'C' }, { color: 'D' }, { color: null }, { color: null }],
      [{ color: null }, { color: null }, { color: null }, { color: null }],
      [{ color: null }, { color: null }, { color: null }, { color: null }],
    ])

    const mirrored = mirrorPattern(pattern, { horizontal: true, vertical: true })

    expect(colors(mirrored)).toEqual([
      ['A', 'B', 'B', 'A'],
      ['C', 'D', 'D', 'C'],
      ['C', 'D', 'D', 'C'],
      ['A', 'B', 'B', 'A'],
    ])
  })

  it('overwrites existing content on the reflected side', () => {
    const pattern = makeGridPattern([[{ color: 'red' }, { color: 'purple' }]])

    const mirrored = mirrorPattern(pattern, { horizontal: true, vertical: false })

    expect(colors(mirrored)).toEqual([['red', 'red']])
  })

  it('returns the same pattern instance, unchanged, when neither axis is selected', () => {
    const pattern = makeGridPattern([[{ color: 'red' }, { color: null }]])

    expect(mirrorPattern(pattern, { horizontal: false, vertical: false })).toBe(pattern)
  })

  it('does not mutate the original pattern', () => {
    const pattern = makeGridPattern([[{ color: 'red' }, { color: null }]])

    mirrorPattern(pattern, { horizontal: true, vertical: false })

    expect(pattern.grid[0]![1]!.color).toBeNull()
  })
})

describe('mostRecentlyUpdated', () => {
  it('returns undefined for an empty list', () => {
    expect(mostRecentlyUpdated([])).toBeUndefined()
  })

  it('returns the pattern with the greatest updatedAt', () => {
    const older = { ...createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 100 }
    const newer = { ...createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 200 }

    expect(mostRecentlyUpdated([older, newer])).toBe(newer)
    expect(mostRecentlyUpdated([newer, older])).toBe(newer)
  })
})
