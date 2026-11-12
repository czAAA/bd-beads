import { findBead } from '../domain/beads'
import { describe, expect, it } from 'vitest'
import { rotationSwapsAxes } from '../domain/grid'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { A4_PORTRAIT, type PrintPart, PRINT_BEAD_TWO_LETTER_MM, PRINT_PART_OVERLAP, chartArea, chartOnPageOne, continuation, mm, partLetter, planPrint } from './printPlan'
import { CELL_SIZE_PX } from './cellSize'
import { bareProject, withLayers } from '../testUtils/layerFields'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => bareProject({ technique, orientation: rotation, beads: {}, frame: { technique: technique, row: 0, column: 0, columns, rows, beads: {} } })
const owned = (part: PrintPart) => [part.lastAcross - part.firstAcross + 1, part.lastDown - part.firstDown + 1]
const sheetsOf = (plan: ReturnType<typeof planPrint>) => new Set(plan.parts.map((part) => part.page)).size

describe('planPrint (ticket 162; printed-output.md, Chart pages)', () => {
  it('prints on A4 at 150 dpi', () => {
    const plan = planPrint(shape('loom', 60, 80))

    expect(plan.page).toEqual({ width: 1240, height: 1754 })
  })

  it.each([[20, 20], [50, 50], [60, 75], [80, 80], [100, 100]])('puts a %s × %s loom Schema whole on page 1, the whole PDF (tickets 0913, 0914)', (columns, rows) => {
    const plan = planPrint(shape('loom', columns, rows))

    expect([plan.partsAcross, plan.partsDown]).toEqual([1, 1])
    expect(plan.parts).toEqual([expect.objectContaining({ firstAcross: 0, lastAcross: columns - 1, firstDown: 0, lastDown: rows - 1, page: 1 })])
    expect(chartOnPageOne(plan)).toBe(true)
    expect(plan.pageCount).toBe(1)
  })

  it('returns the bead it plans: the largest the sheet allows, 9 mm at most, 1.8 mm for a 100 × 100 and 1.6 mm, the stretch, for a 110 × 110', () => {
    expect(planPrint(shape('loom', 20, 20)).beadMm).toBeCloseTo(9, 2)
    expect(planPrint(shape('loom', 50, 50)).beadMm).toBeCloseTo(3.6, 2)
    expect(planPrint(shape('loom', 100, 100)).beadMm).toBeCloseTo(1.8, 2)
    expect(planPrint(shape('loom', 110, 110)).beadMm).toBeCloseTo(1.64, 2)
    expect(planPrint(shape('loom', 110, 110)).parts).toHaveLength(1)
  })

  it('centres a Schema too narrow to fill the width at 9 mm', () => {
    const plan = planPrint(shape('loom', 10, 10))
    const area = chartArea(plan.page)
    const { place } = plan.parts[0]!

    expect(plan.beadMm).toBeCloseTo(9, 2)
    expect(place.x).toBeCloseTo((area.width - place.width) / 2, 5)
    // Parts keep the left margin, so every part page shares it.
    expect(planPrint(shape('loom', 150, 100)).parts.map((part) => part.place.x)).toEqual([0, 0])
  })

  it('cuts a 150 × 100 into two parts of 75 columns at about 2.3 mm, not 100 + 50, and a 150 × 150 into four', () => {
    const wide = planPrint(shape('loom', 150, 100))
    expect(wide.parts.map(owned)).toEqual([[75, 100], [75, 100]])
    expect(wide.beadMm).toBeGreaterThan(2.2)
    expect(wide.beadMm).toBeLessThan(2.4)
    expect(sheetsOf(wide)).toBe(2)
    const square = planPrint(shape('loom', 150, 150))
    expect([square.partsAcross, square.partsDown]).toEqual([2, 2])
    expect(sheetsOf(square)).toBe(4)
  })

  it.each([[150, 150], [200, 200], [300, 200], [240, 60], [250, 250], [120, 120]])('leaves no part of a %s × %s narrower than half its neighbours', (columns, rows) => {
    const plan = planPrint(shape('loom', columns, rows))
    for (const side of [0, 1] as const) {
      const sizes = plan.parts.map((part) => owned(part)[side]!)
      expect(Math.min(...sizes) * 2).toBeGreaterThanOrEqual(Math.max(...sizes))
    }
  })

  it('moves a cut to a multiple of 10 where the parts still fit at the bead: a 200 × 100 is 70 + 60 + 70 across', () => {
    const plan = planPrint(shape('loom', 200, 100))

    expect(plan.parts.map((part) => part.firstAcross)).toEqual([0, 70, 130])
  })

  it('keeps the bead at 1.8 mm or more on several sheets, and at 3 mm at most', () => {
    for (const [columns, rows] of [[120, 120], [150, 100], [300, 200], [400, 30], [60, 400]]) {
      const plan = planPrint(shape('loom', columns!, rows!))
      expect(sheetsOf(plan)).toBeGreaterThan(1)
      expect(plan.beadMm).toBeGreaterThanOrEqual(1.8)
      expect(plan.beadMm).toBeLessThanOrEqual(3)
    }
  })

  it('never plans a bead under the floor it is given, with no stretch below it (two-letter Swatch letters)', () => {
    const plan = planPrint(shape('loom', 100, 100), { floorMm: PRINT_BEAD_TWO_LETTER_MM })

    expect(plan.beadMm).toBeGreaterThanOrEqual(2.2)
    expect(plan.parts.length).toBeGreaterThan(1)
    expect(planPrint(shape('loom', 110, 110), { floorMm: PRINT_BEAD_TWO_LETTER_MM }).beadMm).toBeGreaterThanOrEqual(2.2)
  })

  it('draws every part at one bead size, with Letters or not', () => {
    const plain = planPrint(shape('loom', 150, 220))
    const lettered = planPrint(withLayers(shape('loom', 150, 220), { letters: true }))

    expect(new Set(plain.parts.map((part) => part.region.width)).size).toBeLessThanOrEqual(2)
    expect(lettered.zoom).toBe(plain.zoom)
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
    expect(grid(at(plan.partsAcross - 1, plan.partsDown - 1))).toEqual([2, 2])
    // The board holds the overlap too, so the part's own beads still start at its own number.
    const own = at(1, 1)
    const bead = CELL_SIZE_PX * plan.zoom
    const block = own.lastAcross - own.firstAcross + 1
    expect(own.region.x).toBeCloseTo((own.firstAcross - 2) * bead, 6)
    expect(Math.abs(own.region.width - (block + 2) * bead)).toBeLessThan(1)
  })

  it('numbers the chart pages from 2, after the overview on page 1, with none left empty and the last the last page (ticket 0914)', () => {
    const plan = planPrint(shape('loom', 150, 220))
    const pages = new Set(plan.parts.map((part) => part.page))

    expect(chartOnPageOne(plan)).toBe(false)
    expect(Math.min(...pages)).toBe(2)
    expect([...pages].sort((a, b) => a - b)).toEqual(Array.from({ length: plan.pageCount - 1 }, (_, index) => index + 2))
  })

  it('numbers the chart pages after the list pages that follow page 1 (ticket 0583)', () => {
    const project = shape('loom', 150, 220)
    const without = planPrint(project)
    const withLists = planPrint(project, { listPages: 2 })

    expect(withLists.parts.map((part) => part.page)).toEqual(without.parts.map((part) => part.page + 2))
    expect(withLists.pageCount).toBe(without.pageCount + 2)
  })

  it('counts the list pages after a chart that is whole on page 1 (ticket 0914)', () => {
    const plan = planPrint(shape('loom', 40, 40), { listPages: 2 })

    expect(plan.parts.map((part) => part.page)).toEqual([1])
    expect(plan.pageCount).toBe(3)
  })

  it('plans page 1 in the room it leaves the chart: a Schema whole on a chart page but not under page 1\'s title and Beads needed is cut into parts after it (ticket 0914)', () => {
    const project = shape('loom', 100, 100)
    const pageOne = { width: chartArea(A4_PORTRAIT).width, height: mm(120) }

    expect(chartOnPageOne(planPrint(project))).toBe(true)
    const plan = planPrint(project, { pageOne })
    expect(chartOnPageOne(plan)).toBe(false)
    expect(plan.pageCount).toBe(1 + sheetsOf(plan))
    // A small Schema is still whole on page 1, at the bead that room allows.
    const small = planPrint(shape('loom', 20, 20), { pageOne })
    expect(chartOnPageOne(small)).toBe(true)
    expect(small.parts[0]!.place.height).toBeLessThanOrEqual(mm(120) + 1)
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

describe('planPrint: equal parts fit their sheets (ticket 0913)', () => {
  it.each<[Technique, number, number, Rotation]>([
    ['loom', 250, 250, 0],
    ['peyote', 250, 250, 0],
    ['brick', 130, 200, 0],
    ['loom', 100, 300, 90],
  ])('fits every part of a %s %s×%s Project (rotation %s°) on the area, the first filling a side', (technique, columns, rows, rotation) => {
    const plan = planPrint(shape(technique, columns, rows, rotation))
    const area = chartArea(plan.page)
    const bead = CELL_SIZE_PX * plan.zoom

    for (const part of plan.parts) {
      expect(part.place.width).toBeLessThanOrEqual(area.width + 1)
      expect(part.place.height).toBeLessThanOrEqual(area.height + 1)
    }
    // The bead is the largest the parts allow (3 mm at most): some part fills the width or the height.
    const fills = plan.parts.some((part) => part.place.width + bead > area.width || part.region.height + mm(10) + bead > area.height)
    expect(fills || plan.beadMm > 2.99).toBe(true)
  })

  it('makes the key\'s rows take room from the chart: a taller key, a smaller bead', () => {
    const bead = (keyRows: number) => planPrint(shape('loom', 80, 110), { keyRows }).beadMm

    expect(bead(1)).toBeGreaterThan(bead(3))
  })
})

describe('planPrint: small parts share a sheet (ticket 578; printed-output.md, Chart pages)', () => {
  it('folds a 35 × 120 bracelet into two strips side by side on one sheet at about 2.2 mm', () => {
    const plan = planPrint(shape('loom', 35, 120))

    expect([plan.partsAcross, plan.partsDown]).toEqual([1, 2])
    expect(plan.parts.map((part) => part.letter)).toEqual(['A', 'B'])
    expect(plan.parts.map((part) => part.page)).toEqual([1, 1])
    expect(plan.parts[1]!.place.y).toBe(plan.parts[0]!.place.y)
    expect(plan.parts[1]!.place.x - (plan.parts[0]!.place.x + plan.parts[0]!.place.width)).toBeCloseTo(mm(6), 3)
    expect(plan.beadMm).toBeGreaterThan(2.15)
    expect(plan.beadMm).toBeLessThan(2.4)
    expect(plan.pageCount).toBe(1)
  })

  it('keeps a Schema whole rather than fold it into strips for a bead no bigger, or when it is 3 mm or more whole', () => {
    expect(planPrint(shape('loom', 100, 100)).parts).toHaveLength(1)
    expect(planPrint(shape('loom', 20, 60)).parts).toHaveLength(1)
  })

  it('keeps boxes on a sheet apart and inside its chart area', () => {
    const plan = planPrint(shape('loom', 15, 200))
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

  it('cuts a 240 × 60 into three equal parts 80 across and 60 tall', () => {
    const plan = planPrint(shape('loom', 240, 60))

    expect(plan.partsDown).toBe(1)
    expect(plan.parts.map(owned)).toEqual([[80, 60], [80, 60], [80, 60]])
    expect(plan.beadMm).toBeGreaterThanOrEqual(1.8)
  })

  it('shares sheets between the parts of a long thin bracelet, in reading order', () => {
    const plan = planPrint(shape('loom', 300, 8))
    const pages = plan.parts.map((part) => part.page)

    expect(plan.partsDown).toBe(1)
    expect(sheetsOf(plan)).toBeLessThan(plan.parts.length)
    expect(pages).toEqual([...pages].sort((a, b) => a - b))
    expect(plan.parts.at(-1)!.lastAcross).toBe(299)
  })

  it('needs one part, on one sheet, for a 40 × 40 Schema', () => {
    const plan = planPrint(shape('loom', 40, 40))

    expect(plan.parts).toHaveLength(1)
    expect(plan.parts[0]).toMatchObject({ letter: 'A', page: 1 })
    expect(plan.pageCount).toBe(1)
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

describe('planPrint: real cells (tickets 509, 0724)', () => {
  it('draws a Bead\'s real cells at the same bead size as a bare Technique\'s: the chart is counted, not fitted', () => {
    const real = withLayers(shape('brick', 90, 100), { bead: findBead('miyuki-delica-11-0') })

    expect(planPrint(real).zoom).toBe(planPrint(shape('brick', 90, 100)).zoom)
  })
})
