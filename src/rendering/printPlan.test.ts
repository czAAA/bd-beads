import { findBead } from '../domain/beads'
import { describe, expect, it } from 'vitest'
import { rotationSwapsAxes } from '../domain/grid'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { A4_PORTRAIT, type PrintPart, PRINT_PART_OVERLAP, chartArea, continuation, mm, partLetter, planPrint, PRINT_CHART_CELL_MM } from './printPlan'
import { CELL_SIZE_PX } from './cellSize'
import { flatProject, withFields } from '../testUtils/flatFields'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => flatProject({ technique, rotation, beads: {}, frame: { technique: technique, row: 0, column: 0, columns, rows, beads: {} } })
const beadMm = (zoom: number) => (CELL_SIZE_PX * zoom) / mm(1)

describe('planPrint (ticket 162; printed-output.md, Chart pages)', () => {
  it('prints on A4 at 150 dpi', () => {
    const plan = planPrint(shape('loom', 60, 80))

    expect(plan.page).toEqual({ width: 1240, height: 1754 })
  })

  it('keeps a Project that fits one chart page on a single part (ticket 0584)', () => {
    const plan = planPrint(shape('loom', 20, 20))

    expect([plan.partsAcross, plan.partsDown]).toEqual([1, 1])
    expect(plan.parts).toEqual([expect.objectContaining({ firstAcross: 0, lastAcross: 19, firstDown: 0, lastDown: 19, page: 2 })])
  })

  it('cuts a 100 × 100 into 2 × 2 parts and a 35 × 120 into 1 × 2 (ticket 0584)', () => {
    expect([planPrint(shape('loom', 100, 100)).partsAcross, planPrint(shape('loom', 100, 100)).partsDown]).toEqual([2, 2])
    const tall = planPrint(shape('loom', 35, 120))
    expect([tall.partsAcross, tall.partsDown]).toEqual([1, 2])
  })

  it('draws every part at one bead size, 3 mm, with Letters or not', () => {
    expect(beadMm(planPrint(shape('loom', 150, 220)).zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
    expect(beadMm(planPrint(shape('loom', 20, 20)).zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
    expect(beadMm(planPrint(withFields(shape('loom', 150, 220), { letters: true })).zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
    expect(PRINT_CHART_CELL_MM).toBe(3)
  })

  it.each<[Technique, number, number, Rotation]>([
    ['peyote', 250, 250, 0],
    ['brick', 120, 120, 0],
    ['loom', 100, 20, 90],
    ['loom', 100, 20, 180],
    ['loom', 100, 20, 270],
  ])('covers every bead of a %s %s×%s Project (rotation: %s°) with parts that each fit a sheet', (technique, columns, rows, rotation) => {
    const plan = planPrint(shape(technique, columns, rows, rotation))
    const area = chartArea(plan.page)
    const [across, down] = rotationSwapsAxes(rotation) ? [rows, columns] : [columns, rows]

    expect(plan.parts).toHaveLength(plan.partsAcross * plan.partsDown)
    expect(plan.parts.at(-1)!.lastAcross).toBe(across - 1)
    expect(plan.parts.at(-1)!.lastDown).toBe(down - 1)
    // A brick or peyote part is half a bead wider than its beads, and a part carries its overlap: both can pass the
    // area by a few millimetres, into the margins.
    for (const part of plan.parts) {
      expect(part.place.width).toBeLessThanOrEqual(area.width + mm(5))
      expect(part.place.height).toBeLessThanOrEqual(area.height + 1)
    }
  })

  it('repeats 2 beads of the part before it at the left and the top, none on the first part\'s outer edges (ticket 579)', () => {
    const plan = planPrint(shape('loom', 250, 250))
    const at = (across: number, down: number) => plan.parts.find((part) => part.across === across && part.down === down)!
    const grid = (part: PrintPart) => [part.overlapAcross, part.overlapDown]

    expect(PRINT_PART_OVERLAP).toBe(2)
    expect(grid(at(0, 0))).toEqual([0, 0])
    expect(grid(at(1, 0))).toEqual([2, 0])
    expect(grid(at(0, 1))).toEqual([0, 2])
    expect(grid(at(2, 2))).toEqual([2, 2])
    // The board holds the overlap too, so the part's own beads still start at its own number.
    const own = at(1, 1)
    const bead = CELL_SIZE_PX * plan.zoom
    const block = own.lastAcross - own.firstAcross + 1
    expect(own.region.x).toBeCloseTo((own.firstAcross - 2) * bead, 6)
    expect(Math.abs(own.region.width - (block + 2) * bead)).toBeLessThan(1)
  })

  it('numbers the chart pages from 2, after page 1, with none left empty', () => {
    const plan = planPrint(shape('loom', 150, 220))
    const pages = new Set(plan.parts.map((part) => part.page))

    expect(Math.min(...pages)).toBe(2)
    expect([...pages].sort((a, b) => a - b)).toEqual(Array.from({ length: plan.specificationPage - 2 }, (_, index) => index + 2))
  })

  it('numbers the chart pages and the Specification after the list pages that follow the Cover page (ticket 0583)', () => {
    const project = shape('loom', 150, 220)
    const without = planPrint(project)
    const withLists = planPrint(project, undefined, 2)

    expect(withLists.parts.map((part) => part.page)).toEqual(without.parts.map((part) => part.page + 2))
    expect(withLists.specificationPage).toBe(without.specificationPage + 2)
    expect(withLists.pageCount).toBe(without.pageCount + 2)
  })

  it('puts the Specification on the page after the last chart page, counted in the total (ticket 0581)', () => {
    const plan = planPrint(shape('loom', 150, 220))

    expect(plan.specificationPage).toBe(Math.max(...plan.parts.map((part) => part.page)) + 1)
    expect(plan.pageCount).toBe(plan.specificationPage)
  })

  it('says where the chart continues from each part', () => {
    const plan = planPrint(shape('loom', 150, 220))
    const at = (across: number, down: number) => plan.parts.find((part) => part.across === across && part.down === down)!
    const [lastAcross, lastDown] = [plan.partsAcross - 1, plan.partsDown - 1]

    expect(continuation(plan, at(0, 0))).toEqual({ right: at(1, 0).page, below: at(0, 1).page })
    expect(continuation(plan, at(lastAcross, 0))).toEqual({ right: undefined, below: at(lastAcross, 1).page })
    expect(continuation(plan, at(lastAcross, lastDown))).toEqual({ right: undefined, below: undefined })
  })
})

describe('planPrint: parts as big as the chart page holds (ticket 0584)', () => {
  it.each<[Technique, number, number, Rotation]>([
    ['loom', 250, 250, 0],
    ['peyote', 250, 250, 0],
    ['brick', 130, 200, 0],
    ['loom', 100, 300, 90],
  ])('fills every part of a %s %s×%s Project (rotation %s°) but the last in each direction, and fits the area', (technique, columns, rows, rotation) => {
    const plan = planPrint(shape(technique, columns, rows, rotation))
    const area = chartArea(plan.page)
    const full = plan.parts[0]!
    const [fullAcross, fullDown] = [full.lastAcross - full.firstAcross + 1, full.lastDown - full.firstDown + 1]
    const bead = CELL_SIZE_PX * plan.zoom

    for (const part of plan.parts) {
      expect(part.place.width).toBeLessThanOrEqual(area.width + 1)
      expect(part.place.height).toBeLessThanOrEqual(area.height + 1)
      // The first part fills the side; each later one owns two beads less, which it repeats from the part before.
      const own = (first: number, last: number) => last - first + 1
      if (part.across < plan.partsAcross - 1) expect(own(part.firstAcross, part.lastAcross)).toBe(part.across === 0 ? fullAcross : fullAcross - PRINT_PART_OVERLAP)
      if (part.down < plan.partsDown - 1) expect(own(part.firstDown, part.lastDown)).toBe(part.down === 0 ? fullDown : fullDown - PRINT_PART_OVERLAP)
      // With its overlap a full part takes the room of the first (a brick or peyote part's half bead aside).
      if (part.across > 0 && part.across < plan.partsAcross - 1) expect(part.place.width + bead / 2).toBeGreaterThan(area.width - bead)
      if (part.down > 0 && part.down < plan.partsDown - 1) expect(part.place.height + bead / 2).toBeGreaterThan(area.height - bead)
    }
  })

  it('fits 60 beads across and 74 to 77 down by the rows of the key: a 100 × 100 is 2 × 2 parts, 60 + 40 and 75 + 25 with a two-row key (PrintChartPage card)', () => {
    const rows = (keyRows: number) => planPrint(shape('loom', 100, 250), undefined, 0, keyRows).parts[0]!.lastDown + 1
    const plan = planPrint(shape('loom', 100, 100), undefined, 0, 2)

    expect(plan.parts.map((part) => [part.lastAcross - part.firstAcross + 1, part.lastDown - part.firstDown + 1])).toEqual([[60, 75], [40, 75], [60, 25], [40, 25]])
    expect([rows(1), rows(2), rows(3)]).toEqual([77, 75, 74])
  })

  it('holds the remainder in the last part of each direction', () => {
    const plan = planPrint(shape('loom', 100, 100))
    const [first, second] = [plan.parts[0]!, plan.parts[1]!]

    expect(second.firstAcross).toBe(first.lastAcross + 1)
    expect(second.lastAcross).toBe(99)
    expect(plan.parts.at(-1)!.lastDown).toBe(99)
  })
})

describe('planPrint: small parts share a sheet (ticket 578; printed-output.md, Chart pages)', () => {
  it('puts the leftover parts of a 100 × 100 Schema on shared sheets in reading order', () => {
    const plan = planPrint(shape('loom', 100, 100))

    expect(plan.parts.map((part) => part.letter)).toEqual(['A', 'B', 'C', 'D'])
    // C and D are short enough to share a sheet, 6 mm apart.
    expect(plan.parts.map((part) => part.page)).toEqual([2, 3, 4, 4])
    expect(plan.pageCount).toBe(5)
    expect(plan.parts[3]!.place.y - (plan.parts[2]!.place.y + plan.parts[2]!.place.height)).toBeCloseTo(mm(6), 3)
  })

  it('keeps boxes on a sheet apart and inside its chart area', () => {
    const plan = planPrint(shape('loom', 100, 100))
    const area = chartArea(plan.page)
    for (const part of plan.parts) {
      expect(part.place.x + part.place.width).toBeLessThanOrEqual(area.width + 1)
      expect(part.place.y + part.place.height).toBeLessThanOrEqual(area.height + 1)
      for (const other of plan.parts) {
        if (other === part || other.page !== part.page) continue
        const apart = part.place.x + part.place.width <= other.place.x || other.place.x + other.place.width <= part.place.x || part.place.y + part.place.height <= other.place.y || other.place.y + other.place.height <= part.place.y
        expect(apart).toBe(true)
      }
    }
  })

  it('cuts a 240 × 60 bracelet into parts 60 tall, as wide as the page holds', () => {
    const plan = planPrint(shape('loom', 240, 60))

    expect(plan.partsDown).toBe(1)
    expect(plan.parts.at(-1)!.lastAcross).toBe(239)
    expect(plan.parts.every((part) => part.lastDown === 59)).toBe(true)
    expect(beadMm(plan.zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
  })

  it('shares sheets between the parts of a long thin bracelet, in reading order', () => {
    const plan = planPrint(shape('loom', 300, 8))
    const pages = plan.parts.map((part) => part.page)

    expect(plan.partsDown).toBe(1)
    expect(plan.specificationPage - 2).toBeLessThan(plan.parts.length)
    expect(pages).toEqual([...pages].sort((a, b) => a - b))
    expect(plan.parts.at(-1)!.lastAcross).toBe(299)
  })

  it('needs one part, on one sheet, for a 40 × 40 Schema', () => {
    const plan = planPrint(shape('loom', 40, 40))

    expect(plan.parts).toHaveLength(1)
    expect(plan.parts[0]).toMatchObject({ letter: 'A', page: 2 })
    expect(plan.pageCount).toBe(3)
  })

  it('stays A4 portrait for a Schema wider than tall', () => {
    expect(planPrint(shape('loom', 220, 24)).page).toEqual(A4_PORTRAIT)
    expect(planPrint(shape('loom', 96, 24)).page).toEqual(A4_PORTRAIT)
    expect(planPrint(shape('loom', 40, 60)).page).toEqual(A4_PORTRAIT)
  })

  it('names parts A to Z, then AA', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(partLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA'])
  })
})

describe('planPrint: Bead shape (ticket 509)', () => {
  it('draws Real cells at the same bead size as Symmetric ones: the chart is counted, not fitted', () => {
    const real = withFields(shape('brick', 90, 100), { bead: findBead('miyuki-delica-11-0'), beadShape: 'real' as const })

    expect(planPrint(real).zoom).toBe(planPrint(shape('brick', 90, 100)).zoom)
  })
})

describe('planPrint with Letters (ticket 0573, 0584)', () => {
  it('cuts the same parts as with Letters off, at the same 3 mm bead', () => {
    const lettered = planPrint(withFields(shape('loom', 130, 130), { letters: true }))
    const plain = planPrint(shape('loom', 130, 130))

    expect(lettered.parts.map((part) => [part.firstAcross, part.lastAcross, part.firstDown, part.lastDown])).toEqual(plain.parts.map((part) => [part.firstAcross, part.lastAcross, part.firstDown, part.lastDown]))
    expect(beadMm(lettered.zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
  })
})
