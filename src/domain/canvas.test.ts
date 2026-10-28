import { describe, expect, it } from 'vitest'
import { beadBounds, beadCount, beadsFromColors, beadsInFrame, changedPositions, colorAt, colorsInFrame, forEachBead, hasBeads, withColors } from './canvas'
import { BEAD_CATALOG } from './beads'
import { createProject } from './createProject'
import { paintAt } from '../testUtils/layers'

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

    expect(changedPositions(project.frame!.beads, project.frame!.beads)).toEqual([])
  })

  it('lists exactly the cells whose color differs, and nothing else', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
    const after = paintAt(paintAt(project, [{ row: 0, column: 0 }], '#e63746'), [{ row: 2, column: 1 }], '#2f6fed')

    expect(changedPositions(project.frame!.beads, after.frame!.beads)).toEqual([
      { row: 0, column: 0 },
      { row: 2, column: 1 },
    ])
  })
})
