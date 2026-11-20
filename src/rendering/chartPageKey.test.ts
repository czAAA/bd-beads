import { describe, expect, it } from 'vitest'
import type { Rotation } from '../domain/grid'
import { colorsOnPage, planWithKey, trimmedArea } from './chartPageKey'
import { customChart } from './customChart'
import { displayedGrid, planPrint } from './printPlan'
import { changeFrame } from '../domain/changeFrame'
import { createProject } from '../domain/createProject'
import { frameOf, withFrameSheet } from '../domain/layerRecord'
import { frameGeometryOf } from '../domain/layers'
import { projectDimensions } from '../domain/projectExtent'
import { paintAt } from '../testUtils/layers'
import { bareProject } from '../testUtils/layerFields'

// A 3-column, 2-row loom: red across the top row, blue below, with one green bead in the top left corner.
const beads = { 0: { 0: '#00ff00', 1: '#ff0000', 2: '#ff0000' }, 1: { 0: '#0000ff', 1: '#0000ff', 2: '#0000ff' } }
const project = (rotation: Rotation = 0) => bareProject({ technique: 'loom' as const, orientation: rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 3, rows: 2, beads } })

describe('colorsOnPage: the color key of a chart page (tickets 579, 0585)', () => {
  it('lists every color of the one part', () => {
    const shape = project()

    expect(colorsOnPage(shape, planPrint(shape).parts).sort()).toEqual(['#0000ff', '#00ff00', '#ff0000'])
  })

  it('takes in the overlap, which is drawn on the page', () => {
    const wideOf = (edge: number) => bareProject({ technique: 'loom' as const, orientation: 0 as Rotation, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns: 100, rows: 1, beads: { 0: Object.fromEntries(Array.from({ length: 100 }, (_, column) => [column, column < edge ? '#ff0000' : '#0000ff'])) } } })
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

describe('planWithKey: the key is as tall as the busiest chart page after page 1 needs (ticket 0585)', () => {
  const palette = (count: number) => Array.from({ length: count }, (_, index) => `#${(index + 1).toString(16).padStart(2, '0')}0000`)
  const shapeOf = (count: number) => {
    const row = Object.fromEntries(palette(count).map((hex, column) => [column, hex]))
    // A bead of the first color in the far corner keeps the chart from being trimmed (ticket 1128).
    return bareProject({ technique: 'loom', orientation: 0, beads: {}, frame: { technique: 'loom', row: 0, column: 0, columns: 250, rows: 100, beads: { 0: row, 99: { 249: palette(1)[0]! } } } })
  }

  it('has no key for a chart whole on page 1, where Beads needed is (ticket 0914)', () => {
    const small = bareProject({ technique: 'loom', orientation: 0, beads: {}, frame: { technique: 'loom', row: 0, column: 0, columns: 20, rows: 10, beads: { 0: Object.fromEntries(palette(13).map((hex, column) => [column, hex])) } } })

    expect(planWithKey(small).keyRows).toBe(1)
  })

  it('gives one row for up to 6 colors, two up to 12 and three up to 18', () => {
    expect([1, 6, 7, 12, 13, 18].map((count) => planWithKey(shapeOf(count)).keyRows)).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('is the same on every page of the PDF, so the pages line up', () => {
    const plan = planWithKey(shapeOf(13))

    expect(plan.keyRows).toBe(3)
    expect(new Set(plan.parts.map((part) => part.region.height)).size).toBe(1)
  })
})

describe('planWithKey: two-letter Swatch letters keep a bigger bead (ticket 0913)', () => {
  const colors = (count: number) => Array.from({ length: count }, (_, index) => `#${(index + 1).toString(16).padStart(2, '0')}00${(index + 1).toString(16).padStart(2, '0')}`)
  const square = (count: number, letters?: Record<string, string>) => ({
    ...bareProject({ technique: 'loom', orientation: 0, beads: {}, frame: { technique: 'loom', row: 0, column: 0, columns: 100, rows: 100, beads: { 0: Object.fromEntries(colors(count).map((hex, column) => [column, hex])), 99: { 99: colors(1)[0]! } } } }),
    ...(letters ? { paletteLetters: letters } : {}),
  })

  it('never plans a bead under 2.2 mm for a Schema of 27 colors or more', () => {
    expect(planWithKey(square(26)).beadMm).toBeCloseTo(1.8, 1)
    expect(planWithKey(square(27)).beadMm).toBeGreaterThanOrEqual(2.2)
    expect(planWithKey(square(40)).beadMm).toBeGreaterThanOrEqual(2.2)
  })

  it('keeps 2.2 mm when a color on the Schema carries a two-letter letter', () => {
    const [first, ...rest] = colors(3)
    expect(planWithKey(square(3, { [first!]: 'AB', ...Object.fromEntries(rest.map((hex, index) => [hex, String.fromCharCode(66 + index)])) })).beadMm).toBeGreaterThanOrEqual(2.2)
  })
})

describe('planWithKey: Large beads raise the floor (ticket 0916)', () => {
  const square = (columns: number, rows: number) => bareProject({ technique: 'loom', orientation: 0, beads: {}, frame: { technique: 'loom', row: 0, column: 0, columns, rows, beads: {} } })

  it('plans no bead under the floor it is given, and keeps the higher of it and the two-letter floor', () => {
    expect(planWithKey(square(100, 100)).beadMm).toBeCloseTo(1.8, 1)
    expect(planWithKey(square(100, 100), { floorMm: 3 }).beadMm).toBeCloseTo(3, 1)
    expect(planWithKey(square(150, 150), { floorMm: 1 }).beadMm).toBeGreaterThanOrEqual(1.8)
  })
})

describe('trimmedArea and the plan: the chart is trimmed to the beads (ticket 1128; PrintChartPage card)', () => {
  const RED = '#ff0000'
  /** A Frame with a bead in each corner of the box `[top, left]`–`[bottom, right]` (none: an empty Frame). */
  const framed = (technique: 'loom' | 'brick' | 'peyote', columns: number, rows: number, box?: [number, number, number, number], rotation: Rotation = 0) => {
    const beads: Record<number, Record<number, string>> = {}
    if (box) {
      const [top, left, bottom, right] = box
      beads[top] = { [left]: RED, [right]: RED }
      beads[bottom] = { [left]: RED, [right]: RED }
    }
    return bareProject({ technique, orientation: rotation, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads } })
  }

  it('holds the rows and columns from the first bead to the last, and the whole Schema when it has no beads', () => {
    expect(trimmedArea(framed('loom', 30, 39, [4, 8, 33, 20]))).toEqual({ firstAcross: 8, lastAcross: 20, firstDown: 4, lastDown: 33 })
    expect(trimmedArea(framed('loom', 30, 39))).toEqual({ firstAcross: 0, lastAcross: 29, firstDown: 0, lastDown: 38 })
  })

  it('turns with the Project: a quarter turn puts its rows across, counted from the far end', () => {
    expect(trimmedArea(framed('loom', 30, 39, [4, 8, 33, 20], 90))).toEqual({ firstAcross: 5, lastAcross: 34, firstDown: 8, lastDown: 20 })
    expect(trimmedArea(framed('loom', 30, 39, [4, 8, 33, 20], 180))).toEqual({ firstAcross: 9, lastAcross: 21, firstDown: 5, lastDown: 34 })
  })

  it.each(['loom', 'brick', 'peyote'] as const)('prints a 13-wide %s piece on a 30 × 39 Frame at the bead a 13 × 30 Schema gets, larger than the whole Frame', (technique) => {
    const piece = planWithKey(framed(technique, 30, 39, [4, 8, 33, 20]))
    const alone = planWithKey(framed(technique, 13, 30, [0, 0, 29, 12]))

    expect(piece.trim).toEqual({ firstAcross: 8, lastAcross: 20, firstDown: 4, lastDown: 33 })
    expect(piece.beadMm).toBeCloseTo(alone.beadMm, 6)
    expect(piece.beadMm).toBeGreaterThan(planWithKey(framed(technique, 30, 39)).beadMm)
    expect(piece.parts.map(({ firstAcross, lastAcross, firstDown, lastDown }) => [firstAcross, lastAcross, firstDown, lastDown])).toEqual([[8, 20, 4, 33]])
    expect([piece.parts[0]!.region.width, piece.parts[0]!.region.height]).toEqual([alone.parts[0]!.region.width, alone.parts[0]!.region.height])
  })

  it('cuts only the trimmed chart into parts, with no overlap on the first part\'s outer edges', () => {
    const plan = planWithKey(framed('loom', 300, 120, [10, 50, 109, 249]))

    expect(plan.parts.length).toBeGreaterThan(1)
    expect(Math.min(...plan.parts.map((part) => part.firstAcross))).toBe(50)
    expect(Math.max(...plan.parts.map((part) => part.lastAcross))).toBe(249)
    expect(Math.min(...plan.parts.map((part) => part.firstDown))).toBe(10)
    expect(Math.max(...plan.parts.map((part) => part.lastDown))).toBe(109)
    const first = plan.parts.find((part) => part.firstAcross === 50 && part.firstDown === 10)!
    expect([first.overlapAcross, first.overlapDown]).toEqual([0, 0])
    expect(plan.parts.find((part) => part.firstAcross > 50)!.overlapAcross).toBe(2)
  })

  it('trims a Custom frame to the rectangle round its colored beads, each bead whole inside it', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape: 'warpedSquare', size: 4, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Warped Square')
    const frame = frameOf(placed.project)!
    const [first] = frameGeometryOf(placed.project).positions()
    const painted = paintAt(placed.project, [{ row: frame.row + first!.row, column: frame.column + first!.column, layer: 'frame' }], RED)
    const whole = trimmedArea(placed.project)
    const trimmed = trimmedArea(painted)

    expect(whole).toEqual({ firstAcross: 0, lastAcross: projectDimensions(placed.project).columns - 1, firstDown: 0, lastDown: projectDimensions(placed.project).rows - 1 })
    expect(trimmed.lastAcross - trimmed.firstAcross).toBeLessThan(whole.lastAcross - whole.firstAcross)
    expect(trimmed.lastDown - trimmed.firstDown).toBeLessThan(whole.lastDown - whole.firstDown)
    const { stepAcross, stepDown } = displayedGrid(painted)
    const bead = customChart(painted, { x: 0, y: 0, width: 0, height: 0 }, 1)!.beads.find((each) => each.color === RED)!
    expect(bead.x - bead.width / 2).toBeGreaterThanOrEqual(trimmed.firstAcross * stepAcross - 1e-6)
    expect(bead.x + bead.width / 2).toBeLessThanOrEqual((trimmed.lastAcross + 1) * stepAcross + 1e-6)
    expect(bead.y - bead.height / 2).toBeGreaterThanOrEqual(trimmed.firstDown * stepDown - 1e-6)
    expect(bead.y + bead.height / 2).toBeLessThanOrEqual((trimmed.lastDown + 1) * stepDown + 1e-6)
  })
})
