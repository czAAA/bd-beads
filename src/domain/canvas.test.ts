import { describe, expect, it } from 'vitest'
import { anyChangedPosition, beadBounds, knownBounds, beadCount, beadsFromColors, beadsInFrame, changedPositions, changedRows, colorAt, colorsInFrame, forEachBead, hasBeads, withColors, type BeadMap } from './canvas'
import { BEAD_CATALOG } from './beads'
import { createProject } from './createProject'
import { paintAt } from '../testUtils/layers'
import { countingBeads } from '../testUtils/countingBeads'
import { frameOf } from './layerRecord'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

describe('beads by position', () => {
  it('reads null where nothing is painted, far or negative included', () => {
    const beads = withColors({}, [{ row: -3, column: 1000, color: '#f00' }])
    expect(colorAt(beads, -3, 1000)).toBe('#f00')
    expect(colorAt(beads, 0, 0)).toBeNull()
  })

  it('shares untouched rows and hands back the same map when nothing differs', () => {
    const before = beadsFromColors([['#f00'], ['#0f0']])
    const after = withColors(before, [{ row: 1, column: 0, color: '#00f' }])
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(withColors(after, [{ row: 1, column: 0, color: '#00f' }, { row: 5, column: 5, color: null }])).toBe(after)
  })

  it('drops a row once its last bead is erased, so bounds stay honest', () => {
    const beads = beadsFromColors([['#f00', null], [null, '#0f0']])
    const erased = withColors(beads, [{ row: 0, column: 0, color: null }])
    expect(Object.keys(erased)).toEqual(['1'])
    expect(beadBounds(erased)).toEqual({ row: 1, column: 1, rows: 1, columns: 1 })
    expect(beadBounds({})).toBeUndefined()
  })

  it('grows the bounds of an edited set of beads from the rows it changed, and measures afresh when an edge column empties (ticket 0674)', () => {
    const square = Array.from({ length: 300 * 300 }, (_, i) => ({ row: Math.floor(i / 300), column: i % 300, color: '#f00' }))
    const counting = countingBeads(withColors({}, square))
    expect(beadBounds(counting.beads)).toEqual({ row: 0, column: 0, rows: 300, columns: 300 })
    counting.reset()

    // Growing, recolouring, and erasing a bead of an edge column that still has others: only those rows are read.
    const grown = withColors(counting.beads, [{ row: -2, column: 310, color: '#0f0' }])
    const recoloured = withColors(grown, [{ row: 150, column: 3, color: '#0f0' }])
    const nicked = withColors(recoloured, [{ row: 10, column: 0, color: null }])
    expect([beadBounds(grown), beadBounds(recoloured), beadBounds(nicked)]).toEqual([
      { row: -2, column: 0, rows: 302, columns: 311 },
      { row: -2, column: 0, rows: 302, columns: 311 },
      { row: -2, column: 0, rows: 302, columns: 311 },
    ])
    // Row 0 is where the left column is found to still have a bead: one lookup.
    expect([...counting.reads.rows].sort((a, b) => a - b)).toEqual([0, 10, 150])
    expect(counting.reads.beads).toBeLessThan(2 * 300 * 4)

    // The edge column emptied: the bounds shrink.
    const column0 = Array.from({ length: 300 }, (_, row) => ({ row, column: 0, color: null }))
    expect(beadBounds(withColors(nicked, column0))).toEqual({ row: -2, column: 1, rows: 302, columns: 310 })
  })

  it('grows an edit’s box from a box known on decoding, and from a set measured before another (ticket 0731)', () => {
    const square = Array.from({ length: 300 * 300 }, (_, i) => ({ row: Math.floor(i / 300), column: i % 300, color: '#f00' }))
    const counting = countingBeads(withColors({}, square))
    knownBounds(counting.beads, { row: 0, column: 0, rows: 300, columns: 300 })
    expect(beadBounds(withColors(counting.beads, [{ row: 150, column: 310, color: '#0f0' }]))).toEqual({ row: 0, column: 0, rows: 300, columns: 311 })
    expect(counting.reads.beads).toBeLessThan(2 * 300 * 4)

    expect(beadBounds(beadsFromColors([['#f00']]))).toEqual({ row: 0, column: 0, rows: 1, columns: 1 })
    expect(beadBounds(counting.beads)).toEqual({ row: 0, column: 0, rows: 300, columns: 300 })
    counting.reset()
    expect(beadBounds(withColors(counting.beads, [{ row: -1, column: 5, color: '#0f0' }]))).toEqual({ row: -1, column: 0, rows: 301, columns: 300 })
    expect(counting.reads.beads).toBeLessThan(2 * 300 * 4)
  })

  it('visits beads in reading order and counts them', () => {
    const beads = withColors({}, [
      { row: 2, column: 1, color: 'c' },
      { row: -1, column: 4, color: 'a' },
      { row: 2, column: -2, color: 'b' },
    ])
    const seen: string[] = []
    forEachBead(beads, (_row, _column, color) => seen.push(color))
    expect(seen).toEqual(['a', 'b', 'c'])
    expect(beadCount(beads)).toBe(3)
  })

  it('turns a Frame into dense colors and back, leaving outside beads out', () => {
    const beads = withColors(beadsFromColors([['#f00', null], [null, '#0f0']]), [{ row: 9, column: 9, color: '#00f' }])
    const frame = { row: 0, column: 0, rows: 2, columns: 2 }
    expect(colorsInFrame(beads, frame)).toEqual([['#f00', null], [null, '#0f0']])
    expect(beadsInFrame(beads, frame)).toEqual(beadsFromColors([['#f00', null], [null, '#0f0']]))
  })
})

describe('hasBeads', () => {
  it('is false for no beads or only empty rows, true once one is painted', () => {
    expect(hasBeads({})).toBe(false)
    expect(hasBeads({ 0: {} })).toBe(false)
    expect(hasBeads({ 2: { 3: '#fff' } })).toBe(true)
  })
})

describe('changedPositions', () => {
  it('is empty for two identical grids', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })

    expect(changedPositions(frameOf(project)!.beads, frameOf(project)!.beads)).toEqual([])
  })

  it('lists exactly the cells whose color differs, and nothing else', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
    const after = paintAt(paintAt(project, [{ row: 0, column: 0 }], '#e63746'), [{ row: 2, column: 1 }], '#2f6fed')

    expect(changedPositions(frameOf(project)!.beads, frameOf(after)!.beads)).toEqual([
      { row: 0, column: 0 },
      { row: 2, column: 1 },
    ])
  })
})

describe('anyChangedPosition', () => {
  it('is false for maps that hold the same beads in other row objects, and true for a bead gone or added', () => {
    const before: BeadMap = { 0: { 0: '#e63746' }, 2: { 1: '#2f6fed' } }
    expect(anyChangedPosition(before, { 0: { ...before[0] }, 2: { ...before[2] } })).toBe(false)
    expect(anyChangedPosition(before, { 0: before[0]! })).toBe(true)
    expect(anyChangedPosition(before, { ...before, 2: { 1: '#2f6fed', 2: '#2f6fed' } })).toBe(true)
  })
})

describe('changedRows', () => {
  it('names the rows an edit replaced, those it emptied included, without listing their beads', () => {
    const before: BeadMap = { 0: { 0: '#e63746' }, 2: { 1: '#2f6fed' }, 5: { 3: '#2f6fed' } }
    const after: BeadMap = { 0: before[0]!, 2: { 1: '#e63746', 2: '#e63746' }, 7: { 0: '#2f6fed' } }

    expect(changedRows(before, after).sort((x, y) => x - y)).toEqual([2, 5, 7])
    expect(changedRows(before, before)).toEqual([])
  })
})
