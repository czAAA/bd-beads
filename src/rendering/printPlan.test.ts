import { describe, expect, it } from 'vitest'
import { CELL_SIZE_PX, rotationSwapsAxes } from '../domain/grid'
import type { Rotation, Technique } from '../domain/grid'
import { A4_LANDSCAPE, A4_PORTRAIT, chartArea, continuation, mm, planPrint, PRINT_BEAD_BASE_MM, PRINT_BEAD_MAX_MM, PRINT_BLOCK_BEADS } from './printPlan'
import { displayedExtentPx } from './patternRenderer'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, columns, rows, rotation })
const beadMm = (zoom: number) => (CELL_SIZE_PX * zoom) / mm(1)

describe('planPrint (ticket 162; printed-output.md, Chart pages)', () => {
  it('prints on A4 at 150 dpi', () => {
    const plan = planPrint(shape('loom', 60, 80))

    expect(plan.page).toEqual({ width: 1240, height: 1754 })
  })

  it('keeps a Pattern that fits one 100 × 100-bead block on a single chart page (ticket 185)', () => {
    const plan = planPrint(shape('loom', 60, 80))

    expect([plan.partsAcross, plan.partsDown]).toEqual([1, 1])
    expect(plan.parts).toEqual([expect.objectContaining({ firstAcross: 0, lastAcross: 59, firstDown: 0, lastDown: 79, page: 2 })])
  })

  it('splits a Pattern bigger than one block into fixed 100 × 100-bead blocks, the edge blocks sized to whatever remains (ticket 185)', () => {
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

  it('grows the bead until a block fills the page, the same on every page and never above 7 mm', () => {
    const plan = planPrint(shape('loom', 150, 220))
    const area = chartArea(plan.page)

    expect(beadMm(plan.zoom)).toBeLessThanOrEqual(PRINT_BEAD_MAX_MM)
    const block = displayedExtentPx('loom', PRINT_BLOCK_BEADS, PRINT_BLOCK_BEADS, plan.zoom, 0)
    expect(block.width).toBeLessThanOrEqual(area.width + 1e-6)
    expect(block.height).toBeLessThanOrEqual(area.height + 1e-6)
    // It fills the page one way or the other.
    expect(Math.max(block.width / area.width, block.height / area.height)).toBeGreaterThan(0.99)
  })

  it('keeps a small Pattern on one chart page at the largest bead', () => {
    const plan = planPrint(shape('loom', 20, 20))

    expect(plan.parts).toHaveLength(1)
    expect(beadMm(plan.zoom)).toBeCloseTo(PRINT_BEAD_MAX_MM, 6)
  })

  it.each<[Technique, number, number, Rotation]>([
    ['peyote', 250, 250, 0],
    ['brick', 120, 120, 0],
    ['loom', 100, 20, 90],
    ['loom', 100, 20, 180],
    ['loom', 100, 20, 270],
  ])('covers every bead of a %s %s×%s Pattern (rotation: %s°) with parts that each fit a page', (technique, columns, rows, rotation) => {
    const plan = planPrint(shape(technique, columns, rows, rotation))
    const area = chartArea(plan.page)
    const [across, down] = rotationSwapsAxes(rotation) ? [rows, columns] : [columns, rows]

    expect(plan.parts).toHaveLength(plan.partsAcross * plan.partsDown)
    expect(plan.parts.at(-1)!.lastAcross).toBe(across - 1)
    expect(plan.parts.at(-1)!.lastDown).toBe(down - 1)
    for (const part of plan.parts) {
      expect(part.region.width).toBeLessThanOrEqual(area.width + 1)
      expect(part.region.height).toBeLessThanOrEqual(area.height + 1)
    }
  })

  it('numbers the chart pages from 2, after page 1', () => {
    const plan = planPrint(shape('loom', 150, 220))

    expect(plan.parts.map((part) => part.page)).toEqual([2, 3, 4, 5, 6, 7])
    expect(plan.pageCount).toBe(7)
  })

  it('says where the chart continues from each part', () => {
    const plan = planPrint(shape('loom', 150, 220))

    expect(continuation(plan, plan.parts[0]!)).toEqual({ right: 3, below: 4 })
    expect(continuation(plan, plan.parts[1]!)).toEqual({ right: undefined, below: 5 })
    expect(continuation(plan, plan.parts[5]!)).toEqual({ right: undefined, below: undefined })
  })
})

describe('planPrint: fixed 100 × 100-bead blocks (ticket 185)', () => {
  it('splits a very large Pattern into a predictable grid of blocks, each its own page', () => {
    const plan = planPrint(shape('peyote', 250, 250))

    expect([plan.partsAcross, plan.partsDown]).toEqual([3, 3])
    expect(plan.parts).toHaveLength(9)
    expect(plan.pageCount).toBe(10)
    // Every block but the edge ones is a full 100 × 100 beads; the edge ones simply run out of Pattern.
    for (const part of plan.parts) {
      expect(part.lastAcross - part.firstAcross + 1).toBeLessThanOrEqual(PRINT_BLOCK_BEADS)
      expect(part.lastDown - part.firstDown + 1).toBeLessThanOrEqual(PRINT_BLOCK_BEADS)
    }
    expect(plan.parts.filter((part) => part.lastAcross - part.firstAcross + 1 === PRINT_BLOCK_BEADS)).toHaveLength(6)
  })
})

describe('planPrint: wide and long Patterns (ticket 163; printed-output.md, PrintWide and PrintStrips)', () => {
  it('prints a wide Pattern on landscape A4, one block per page, each filling its sheet', () => {
    const plan = planPrint(shape('loom', 220, 24))

    expect(plan.page).toEqual(A4_LANDSCAPE)
    expect(plan.strip).toBe(false)
    expect(plan.partsAcross).toBe(3)
    expect(plan.partsDown).toBe(1)
    expect(plan.parts.map((part) => part.page)).toEqual([2, 3, 4])
    const area = chartArea(plan.page)
    // The two full 100-bead blocks fill their sheet; the 20-bead edge block simply draws smaller, at the same zoom.
    for (const part of plan.parts.slice(0, 2)) {
      expect(Math.max(part.region.width / area.width, part.region.height / area.height)).toBeGreaterThan(0.99)
    }
    expect(plan.parts.at(-1)!.lastAcross - plan.parts.at(-1)!.firstAcross + 1).toBe(20)
  })

  it('keeps a wide Pattern that fits one block on a single chart page', () => {
    const plan = planPrint(shape('loom', 96, 24))

    expect(plan.page).toEqual(A4_LANDSCAPE)
    expect(plan.partsAcross).toBe(1)
    expect(plan.partsDown).toBe(1)
  })

  it('prints a taller-or-square Pattern portrait', () => {
    expect(planPrint(shape('loom', 50, 50)).page).toEqual(A4_PORTRAIT)
    expect(planPrint(shape('loom', 40, 60)).page).toEqual(A4_PORTRAIT)
  })

  it('stacks a bracelet-length Pattern several parts to a sheet, at the base bead size', () => {
    const plan = planPrint(shape('loom', 300, 8))

    expect(plan.page).toEqual(A4_LANDSCAPE)
    expect(plan.strip).toBe(true)
    expect(plan.zoom).toBeCloseTo(mm(PRINT_BEAD_BASE_MM) / CELL_SIZE_PX)
    expect(plan.partsAcross).toBeGreaterThan(1)
    expect(plan.partsDown).toBe(1)
    // Several parts land on the same page, each covering the whole 8-row height and its own slice across.
    const pages = new Map<number, number>()
    for (const part of plan.parts) pages.set(part.page, (pages.get(part.page) ?? 0) + 1)
    expect(Math.max(...pages.values())).toBeGreaterThan(1)
    expect(plan.parts.at(-1)!.lastAcross).toBe(299)
    expect(plan.parts.every((part) => part.firstDown === 0 && part.lastDown === 7)).toBe(true)
    // Pages read in order, left across then the next sheet.
    expect([...pages.keys()]).toEqual([...pages.keys()].sort((a, b) => a - b))
  })

  it('does not stack when a part already fills half its page or more', () => {
    // Square-ish and thoroughly two-way-split Patterns keep one part per page.
    expect(planPrint(shape('loom', 50, 50)).strip).toBe(false)
    expect(planPrint(shape('loom', 60, 80)).strip).toBe(false)
  })
})
