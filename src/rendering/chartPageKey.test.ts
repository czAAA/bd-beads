import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import { colorsOnParts } from './chartPageKey'
import { planPrint } from './printPlan'

// A 3-column, 2-row loom: red across the top row, blue below, with one green bead in the top left corner.
const beads = { 0: { 0: '#00ff00', 1: '#ff0000', 2: '#ff0000' }, 1: { 0: '#0000ff', 1: '#0000ff', 2: '#0000ff' } }
const project = (rotation: Rotation = 0) => ({ technique: 'loom' as const, rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 3, rows: 2, beads } })

describe('colorsOnParts: the color key of a chart page (ticket 579)', () => {
  it('counts every bead of the one part, most first', () => {
    const shape = project()
    const plan = planPrint(shape)

    expect(colorsOnParts(shape, plan.parts)).toEqual([
      { hex: '#0000ff', count: 3 },
      { hex: '#ff0000', count: 2 },
      { hex: '#00ff00', count: 1 },
    ])
  })

  it('counts only the beads a part owns, not the overlap it repeats', () => {
    const wideOf = (edge: number) => ({ technique: 'loom' as const, rotation: 0 as Rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 100, rows: 1, beads: { 0: Object.fromEntries(Array.from({ length: 100 }, (_, column) => [column, column < edge ? '#ff0000' : '#0000ff'])) } } })
    const edge = planPrint(wideOf(0)).parts[1]!.firstAcross
    const wide = wideOf(edge)
    const [, second] = planPrint(wide).parts

    expect(second!.overlapAcross).toBe(2)
    expect(colorsOnParts(wide, [second!])).toEqual([{ hex: '#0000ff', count: 100 - edge }])
  })

  it('follows a turned Project: a quarter turn puts the rows across', () => {
    const shape = project(90)
    const plan = planPrint(shape)
    // At 90° the 2 rows run across: the part's own beads are all there is, whatever the turn.
    expect(colorsOnParts(shape, plan.parts).reduce((sum, { count }) => sum + count, 0)).toBe(6)
  })
})
