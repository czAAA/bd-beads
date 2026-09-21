import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { createPattern, moveToRow, paintCells, setRowProgressEnabled, toggleRotated, type Pattern, type Technique } from './pattern'
import { resizePattern, resizeRefusal, resizeRowStep } from './resize'

const cube = findBead('toho-cube-1.5mm')!

/** A Pattern of the given size in beads whose cell at (row, column) is painted `r{row}c{column}` — every cell distinct, so where each one lands is checkable. */
function numbered(columns: number, rows: number, technique: Technique = 'loom'): Pattern {
  let pattern = createPattern({ technique, beadId: cube.id, size: { width: columns, height: rows, unit: 'beads' } })
  const positions = pattern.grid.flatMap((cells, row) => cells.map((_cell, column) => ({ row, column })))
  for (const { row, column } of positions) {
    pattern = paintCells(pattern, [{ row, column }], `r${row}c${column}`, { columns: 0, rows: 0 })
  }
  return pattern
}

function colors(pattern: Pattern): (string | null)[][] {
  return pattern.grid.map((cells) => cells.map((cell) => cell.color))
}

describe('resizePattern from the end', () => {
  it('grows by adding empty columns on the right and rows at the bottom, leaving the design where it is', () => {
    const grown = resizePattern(numbered(2, 2), { columns: 3, rows: 3 })

    expect(grown.columns).toBe(3)
    expect(grown.rows).toBe(3)
    expect(colors(grown)).toEqual([
      ['r0c0', 'r0c1', null],
      ['r1c0', 'r1c1', null],
      [null, null, null],
    ])
  })

  it('shrinks by removing the last columns and rows along with their painted cells', () => {
    const shrunk = resizePattern(numbered(3, 3), { columns: 2, rows: 1 })

    expect(shrunk.columns).toBe(2)
    expect(shrunk.rows).toBe(1)
    expect(colors(shrunk)).toEqual([['r0c0', 'r0c1']])
  })

  it('keeps the grid and the dimensions in step', () => {
    const resized = resizePattern(numbered(4, 5), { columns: 6, rows: 2 })

    expect(resized.grid).toHaveLength(resized.rows)
    expect(resized.grid.every((cells) => cells.length === resized.columns)).toBe(true)
  })

  it('changes one direction at a time', () => {
    const resized = resizePattern(numbered(3, 3), { columns: 3, rows: 4 })

    expect(colors(resized).slice(0, 3)).toEqual(colors(numbered(3, 3)))
    expect(resized.grid[3]).toEqual([{ color: null }, { color: null }, { color: null }])
  })

  it.each<Technique>(['peyote', 'brick'])('grows and shrinks %s by any amount from the end', (technique) => {
    const grown = resizePattern(numbered(3, 3, technique), { columns: 4, rows: 4 })
    expect(colors(grown)[0]).toEqual(['r0c0', 'r0c1', 'r0c2', null])
    expect(grown.rows).toBe(4)

    const shrunk = resizePattern(numbered(3, 4, technique), { columns: 3, rows: 3 })
    expect(colors(shrunk)).toEqual(colors(numbered(3, 3, technique)))
  })

  it('keeps the rest of the Pattern as it was, and bumps updatedAt', () => {
    const before = { ...toggleRotated(numbered(3, 3)), imageColors: ['#ff0000'], updatedAt: 0 }

    const resized = resizePattern(before, { columns: 4, rows: 3 })

    expect(resized.id).toBe(before.id)
    expect(resized.name).toBe(before.name)
    expect(resized.technique).toBe(before.technique)
    expect(resized.beadId).toBe(before.beadId)
    expect(resized.rotated).toBe(true)
    expect(resized.imageColors).toEqual(['#ff0000'])
    expect(resized.updatedAt).toBeGreaterThan(0)
  })

  it('hands back the same instance when nothing changes, so it is not an undo step', () => {
    const pattern = numbered(3, 3)

    expect(resizePattern(pattern, { columns: 3, rows: 3 })).toBe(pattern)
    expect(resizePattern(pattern, { columns: 3, rows: 3, columnsFrom: 'start', rowsFrom: 'start' })).toBe(pattern)
  })
})

describe('resizePattern from the start', () => {
  it('grows by adding empty columns on the left and rows on top, sliding the design right and down with them', () => {
    const grown = resizePattern(numbered(2, 2), { columns: 3, rows: 3, columnsFrom: 'start', rowsFrom: 'start' })

    expect(colors(grown)).toEqual([
      [null, null, null],
      [null, 'r0c0', 'r0c1'],
      [null, 'r1c0', 'r1c1'],
    ])
  })

  it('shrinks by removing the leftmost columns and topmost rows with their cells, and shifts the rest back', () => {
    const shrunk = resizePattern(numbered(3, 3), { columns: 2, rows: 2, columnsFrom: 'start', rowsFrom: 'start' })

    expect(colors(shrunk)).toEqual([
      ['r1c1', 'r1c2'],
      ['r2c1', 'r2c2'],
    ])
  })

  it('takes each direction from its own end', () => {
    const resized = resizePattern(numbered(2, 2), { columns: 3, rows: 3, columnsFrom: 'start', rowsFrom: 'end' })

    expect(colors(resized)).toEqual([
      [null, 'r0c0', 'r0c1'],
      [null, 'r1c0', 'r1c1'],
      [null, null, null],
    ])
  })

  it('moves loom rows by any amount', () => {
    const resized = resizePattern(numbered(2, 3), { columns: 2, rows: 4, columnsFrom: 'end', rowsFrom: 'start' })

    expect(colors(resized)[1]).toEqual(['r0c0', 'r0c1'])
  })

  it.each<Technique>(['peyote', 'brick'])(
    'moves %s columns by any amount, since a column shift keeps every row where it was in the stagger',
    (technique) => {
      const resized = resizePattern(numbered(2, 2, technique), { columns: 3, rows: 2, columnsFrom: 'start' })

      expect(colors(resized)).toEqual([
        [null, 'r0c0', 'r0c1'],
        [null, 'r1c0', 'r1c1'],
      ])
    },
  )

  it.each<Technique>(['peyote', 'brick'])(
    '%s rows move in pairs, and the design lands two rows down with the same rows stepped as before',
    (technique) => {
      const before = numbered(2, 4, technique)

      const grown = resizePattern(before, { columns: 2, rows: 6, rowsFrom: 'start' })

      expect(grown.rows).toBe(6)
      expect(colors(grown).slice(2)).toEqual(colors(before))
      expect(colors(grown).slice(0, 2)).toEqual([
        [null, null],
        [null, null],
      ])

      const shrunk = resizePattern(before, { columns: 2, rows: 2, rowsFrom: 'start' })
      expect(colors(shrunk)).toEqual(colors(before).slice(2))
    },
  )

  it.each<Technique>(['peyote', 'brick'])('%s refuses an odd change of rows from the start', (technique) => {
    const pattern = numbered(2, 4, technique)

    expect(resizeRefusal(pattern, { columns: 2, rows: 5, rowsFrom: 'start' })).toBe('odd-start-rows')
    expect(resizeRefusal(pattern, { columns: 2, rows: 3, rowsFrom: 'start' })).toBe('odd-start-rows')
    expect(resizePattern(pattern, { columns: 2, rows: 5, rowsFrom: 'start' })).toBe(pattern)
  })

  it('does not restrict odd changes anywhere else: loom rows, or peyote rows from the end', () => {
    expect(resizeRefusal(numbered(2, 4, 'loom'), { columns: 2, rows: 5, rowsFrom: 'start' })).toBeUndefined()
    expect(resizeRefusal(numbered(2, 4, 'peyote'), { columns: 2, rows: 5, rowsFrom: 'end' })).toBeUndefined()
    expect(resizeRefusal(numbered(2, 4, 'peyote'), { columns: 3, rows: 4, columnsFrom: 'start' })).toBeUndefined()
  })
})

describe('resizeRowStep', () => {
  it('is 2 for rows from the start on peyote and brick stitch, and 1 everywhere else', () => {
    expect(resizeRowStep('peyote', 'start')).toBe(2)
    expect(resizeRowStep('brick', 'start')).toBe(2)
    expect(resizeRowStep('peyote', 'end')).toBe(1)
    expect(resizeRowStep('brick', 'end')).toBe(1)
    expect(resizeRowStep('loom', 'start')).toBe(1)
    expect(resizeRowStep('loom', 'end')).toBe(1)
  })
})

describe('the cell cap', () => {
  const blank = (columns: number, rows: number, technique: Technique = 'loom') =>
    createPattern({ technique, beadId: cube.id, size: { width: columns, height: rows, unit: 'beads' } })

  it('lets a Pattern grow to exactly 10,000 cells and refuses one more', () => {
    const pattern = blank(100, 99)

    expect(resizeRefusal(pattern, { columns: 100, rows: 100 })).toBeUndefined()
    expect(resizeRefusal(pattern, { columns: 101, rows: 100 })).toBe('over-cap')
    expect(resizePattern(pattern, { columns: 101, rows: 100 })).toBe(pattern)
  })

  it('limits the product, not either side', () => {
    expect(resizeRefusal(blank(10, 10), { columns: 500, rows: 20 })).toBeUndefined()
    expect(resizeRefusal(blank(10, 10), { columns: 200, rows: 200 })).toBe('over-cap')
  })

  it('refuses growth from the start as well', () => {
    expect(resizeRefusal(blank(100, 100), { columns: 101, rows: 100, columnsFrom: 'start' })).toBe('over-cap')
  })

  it('always lets a Pattern already over the cap shrink, or change without getting larger', () => {
    const over = blank(200, 200)

    expect(resizeRefusal(over, { columns: 200, rows: 199 })).toBeUndefined()
    expect(resizeRefusal(over, { columns: 150, rows: 250 })).toBeUndefined() // 37,500 < 40,000: one grows, the total does not
    expect(resizeRefusal(over, { columns: 200, rows: 200 })).toBeUndefined()
    expect(resizeRefusal(over, { columns: 200, rows: 201 })).toBe('over-cap')
  })
})

describe('Row progress', () => {
  it('locks the size while it is on', () => {
    const woven = setRowProgressEnabled(numbered(3, 3), true)

    expect(resizeRefusal(woven, { columns: 4, rows: 3 })).toBe('locked')
    expect(resizePattern(woven, { columns: 2, rows: 3 })).toBe(woven)
  })

  it('unlocks it again when turned off', () => {
    const off = setRowProgressEnabled(setRowProgressEnabled(numbered(3, 3), true), false)

    expect(resizeRefusal(off, { columns: 4, rows: 3 })).toBeUndefined()
  })

  it('keeps its pointers on a row that still exists when the Pattern shrinks', () => {
    const pointed = moveToRow(numbered(3, 5), 4)

    const shrunk = resizePattern(pointed, { columns: 3, rows: 2 })

    expect(shrunk.rowProgress.currentRow).toBe(1)
  })

  it('leaves the pointers alone when they still fit', () => {
    const pointed = moveToRow(numbered(3, 5), 1)

    expect(resizePattern(pointed, { columns: 3, rows: 4 }).rowProgress).toBe(pointed.rowProgress)
  })
})

describe('invalid sizes', () => {
  it.each([0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %s columns or rows', (bad) => {
    const pattern = numbered(3, 3)

    expect(resizeRefusal(pattern, { columns: bad, rows: 3 })).toBe('invalid')
    expect(resizeRefusal(pattern, { columns: 3, rows: bad })).toBe('invalid')
    expect(resizePattern(pattern, { columns: bad, rows: 3 })).toBe(pattern)
  })
})
