import { findBead } from '../domain/beads'
import { describe, expect, it } from 'vitest'
import { rotationSwapsAxes } from '../domain/grid'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { A4_PORTRAIT, type PrintPart, chartArea, continuation, mm, partLetter, planPrint, PRINT_BLOCK_BEADS, PRINT_BLOCK_BEADS_LETTERS, PRINT_CHART_CELL_LETTERS_MM, PRINT_CHART_CELL_MM } from './printPlan'
import { CELL_SIZE_PX } from './surfaceView'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, rotation, beads: {}, frame: { technique: technique, row: 0, column: 0, columns, rows, beads: {} } })
const beadMm = (zoom: number) => (CELL_SIZE_PX * zoom) / mm(1)

describe('planPrint (ticket 162; printed-output.md, Chart pages)', () => {
  it('prints on A4 at 150 dpi', () => {
    const plan = planPrint(shape('loom', 60, 80))

    expect(plan.page).toEqual({ width: 1240, height: 1754 })
  })

  it('keeps a Project that fits one 100 × 100-bead block on a single chart page (ticket 185)', () => {
    const plan = planPrint(shape('loom', 60, 80))

    expect([plan.partsAcross, plan.partsDown]).toEqual([1, 1])
    expect(plan.parts).toEqual([expect.objectContaining({ firstAcross: 0, lastAcross: 59, firstDown: 0, lastDown: 79, page: 2 })])
  })

  it('splits a Project bigger than one block into fixed 100 × 100-bead blocks, the edge blocks sized to whatever remains (ticket 185)', () => {
    const plan = planPrint(shape('loom', 150, 220))

    expect([plan.partsAcross, plan.partsDown]).toEqual([2, 3])
    expect(plan.parts.map((part) => [part.firstAcross, part.lastAcross, part.firstDown, part.lastDown])).toEqual([
      [0, 99, 0, 99],
      [100, 149, 0, 99],
      [0, 99, 100, 199],
      [100, 149, 100, 199],
      [0, 99, 200, 219],
      [100, 149, 200, 219],
    ])
  })

  it('draws every part at one bead size, 1.75 mm, whatever the page it lands on', () => {
    expect(beadMm(planPrint(shape('loom', 150, 220)).zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
    expect(beadMm(planPrint(shape('loom', 20, 20)).zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
    expect(PRINT_CHART_CELL_MM).toBe(1.75)
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
    // A brick or peyote part is half a bead wider than its beads, which can pass the area by under a millimetre.
    for (const part of plan.parts) {
      expect(part.place.width).toBeLessThanOrEqual(area.width + mm(1))
      expect(part.place.height).toBeLessThanOrEqual(area.height + 1)
    }
  })

  it('numbers the chart pages from 2, after page 1, with none left empty', () => {
    const plan = planPrint(shape('loom', 150, 220))
    const pages = new Set(plan.parts.map((part) => part.page))

    expect(Math.min(...pages)).toBe(2)
    expect([...pages].sort((a, b) => a - b)).toEqual(Array.from({ length: plan.pageCount - 1 }, (_, index) => index + 2))
  })

  it('says where the chart continues from each part', () => {
    const plan = planPrint(shape('loom', 150, 220))

    const [a, b, , , , f] = plan.parts as [PrintPart, PrintPart, PrintPart, PrintPart, PrintPart, PrintPart]
    expect(continuation(plan, a)).toEqual({ right: b.page, below: plan.parts[2]!.page })
    expect(continuation(plan, b)).toEqual({ right: undefined, below: plan.parts[3]!.page })
    expect(continuation(plan, f)).toEqual({ right: undefined, below: undefined })
  })
})

describe('planPrint: fixed 100 × 100-bead blocks (ticket 185)', () => {
  it('splits a very large Project into a predictable grid of blocks, a full one to a sheet', () => {
    const plan = planPrint(shape('peyote', 250, 250))

    expect([plan.partsAcross, plan.partsDown]).toEqual([3, 3])
    expect(plan.parts).toHaveLength(9)
    expect(plan.pageCount).toBeLessThan(10)
    // Every block but the edge ones is a full 100 × 100 beads; the edge ones simply run out of Project.
    for (const part of plan.parts) {
      expect(part.lastAcross - part.firstAcross + 1).toBeLessThanOrEqual(PRINT_BLOCK_BEADS)
      expect(part.lastDown - part.firstDown + 1).toBeLessThanOrEqual(PRINT_BLOCK_BEADS)
    }
    const full = plan.parts.filter((part) => part.lastAcross - part.firstAcross + 1 === PRINT_BLOCK_BEADS && part.lastDown - part.firstDown + 1 === PRINT_BLOCK_BEADS)
    expect(full).toHaveLength(4)
    expect(new Set(full.map((part) => part.page)).size).toBe(4)
  })
})

describe('planPrint: small parts share a sheet (ticket 578; printed-output.md, Chart pages)', () => {
  it('puts a 130 × 130 Schema as part A, then B and D together, then C', () => {
    const plan = planPrint(shape('loom', 130, 130))
    const page = (letter: string) => plan.parts.find((part) => part.letter === letter)!.page

    expect(plan.parts.map((part) => [part.letter, part.firstAcross, part.lastAcross, part.firstDown, part.lastDown])).toEqual([
      ['A', 0, 99, 0, 99],
      ['B', 100, 129, 0, 99],
      ['C', 0, 99, 100, 129],
      ['D', 100, 129, 100, 129],
    ])
    expect([page('A'), page('B'), page('C'), page('D')]).toEqual([2, 3, 4, 3])
    expect(plan.pageCount).toBe(4)
    // B and D side by side on their sheet, each in its own box.
    const [b, d] = [plan.parts[1]!, plan.parts[3]!]
    expect(d.place.x).toBeGreaterThan(b.place.x + b.place.width - 1)
    expect(d.place.y).toBe(b.place.y)
  })

  it('keeps boxes on a sheet apart and inside its chart area', () => {
    const plan = planPrint(shape('loom', 130, 130))
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

  it('cuts a 240 × 60 bracelet into 100, 100 and 40 beads, each part 60 tall, two to a sheet', () => {
    const plan = planPrint(shape('loom', 240, 60))

    expect(plan.parts.map((part) => [part.firstAcross, part.lastAcross, part.lastDown])).toEqual([[0, 99, 59], [100, 199, 59], [200, 239, 59]])
    expect(beadMm(plan.zoom)).toBeCloseTo(PRINT_CHART_CELL_MM, 6)
    expect(plan.parts.map((part) => part.page)).toEqual([2, 2, 3])
  })

  it('shares sheets between the parts of a long thin bracelet, in reading order', () => {
    const plan = planPrint(shape('loom', 300, 8))
    const pages = plan.parts.map((part) => part.page)

    expect(plan.partsDown).toBe(1)
    expect(plan.pageCount - 1).toBeLessThan(plan.parts.length)
    expect(pages).toEqual([...pages].sort((a, b) => a - b))
    expect(plan.parts.at(-1)!.lastAcross).toBe(299)
  })

  it('needs one part, on one sheet, for a 60 × 60 Schema', () => {
    const plan = planPrint(shape('loom', 60, 60))

    expect(plan.parts).toHaveLength(1)
    expect(plan.parts[0]).toMatchObject({ letter: 'A', page: 2 })
    expect(plan.pageCount).toBe(2)
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
    const real = { ...shape('brick', 90, 100), bead: findBead('miyuki-delica-11-0'), beadShape: 'real' as const }

    expect(planPrint(real).zoom).toBe(planPrint(shape('brick', 90, 100)).zoom)
  })
})

describe('planPrint with Letters (ticket 0573, 578)', () => {
  it('cuts parts of at most 75 beads a side, so 130 beads are 75 and 55, and 100 beads when Letters is off', () => {
    const lettered = planPrint({ ...shape('loom', 130, 60), letters: true })
    expect(PRINT_BLOCK_BEADS_LETTERS).toBe(75)
    expect(lettered.parts.map((part) => [part.firstAcross, part.lastAcross])).toEqual([[0, 74], [75, 129]])
    expect(planPrint(shape('loom', 130, 60)).parts.map((part) => [part.firstAcross, part.lastAcross])).toEqual([[0, 99], [100, 129]])
  })

  it('draws a bead at 2.3 mm, and a full 75-bead part still fits the sheet', () => {
    const plan = planPrint({ ...shape('loom', 130, 130), letters: true })

    expect(beadMm(plan.zoom)).toBeCloseTo(PRINT_CHART_CELL_LETTERS_MM, 6)
    expect(PRINT_CHART_CELL_LETTERS_MM).toBe(2.3)
    expect(plan.parts[0]!.place.width).toBeLessThanOrEqual(chartArea(plan.page).width)
  })
})
