import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import { colorsOnPage, planWithKey } from './chartPageKey'
import { planPrint } from './printPlan'

// A 3-column, 2-row loom: red across the top row, blue below, with one green bead in the top left corner.
const beads = { 0: { 0: '#00ff00', 1: '#ff0000', 2: '#ff0000' }, 1: { 0: '#0000ff', 1: '#0000ff', 2: '#0000ff' } }
const project = (rotation: Rotation = 0) => ({ technique: 'loom' as const, rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 3, rows: 2, beads } })

describe('colorsOnPage: the color key of a chart page (tickets 579, 0585)', () => {
  it('lists every color of the one part', () => {
    const shape = project()

    expect(colorsOnPage(shape, planPrint(shape).parts).sort()).toEqual(['#0000ff', '#00ff00', '#ff0000'])
  })

  it('takes in the overlap, which is drawn on the page', () => {
    const wideOf = (edge: number) => ({ technique: 'loom' as const, rotation: 0 as Rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 100, rows: 1, beads: { 0: Object.fromEntries(Array.from({ length: 100 }, (_, column) => [column, column < edge ? '#ff0000' : '#0000ff'])) } } })
    const edge = planPrint(wideOf(0)).parts[1]!.firstAcross
    const wide = wideOf(edge)
    const [, second] = planPrint(wide).parts

    expect(second!.overlapAcross).toBe(2)
    expect(colorsOnPage(wide, [second!]).sort()).toEqual(['#0000ff', '#ff0000'])
  })

  it('follows a turned Project: a quarter turn puts the rows across', () => {
    const shape = project(90)

    expect(colorsOnPage(shape, planPrint(shape).parts)).toHaveLength(3)
  })
})

describe('planWithKey: the key is as tall as the busiest chart page needs (ticket 0585)', () => {
  const palette = (count: number) => Array.from({ length: count }, (_, index) => `#${(index + 1).toString(16).padStart(2, '0')}0000`)
  const shapeOf = (count: number) => {
    const row = Object.fromEntries(palette(count).map((hex, column) => [column, hex]))
    return { technique: 'loom' as const, rotation: 0 as Rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 20, rows: 10, beads: { 0: row } } }
  }

  it('gives one row for up to 6 colors, two up to 12 and three up to 18', () => {
    expect([1, 6, 7, 12, 13, 18].map((count) => planWithKey(shapeOf(count)).keyRows)).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('is the same on every page of the PDF, so the pages line up', () => {
    const plan = planWithKey(shapeOf(13))

    expect(plan.keyRows).toBe(3)
    expect(new Set(plan.parts.map((part) => part.region.height)).size).toBe(1)
  })
})
