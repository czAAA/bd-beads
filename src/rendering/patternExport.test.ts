import { describe, expect, it } from 'vitest'
import { patternExtentPx, rowPitchPx } from './patternRenderer'
import { PDF_ZOOM, PNG_BEAD_PX, PNG_MAX_PIXELS, PNG_MARGIN_PX, planChart, pngZoom } from './patternExport'
import type { Technique } from '../domain/grid'

const shape = (technique: Technique, columns: number, rows: number, rotated = false) => ({ technique, columns, rows, rotated })

describe('pngZoom (ticket 73)', () => {
  it('draws a bead at the legible size for an ordinary Pattern', () => {
    expect(pngZoom(shape('loom', 30, 30)) * 20).toBe(PNG_BEAD_PX)
  })

  it.each<[Technique, number, number, boolean]>([
    ['loom', 70, 250, false],
    ['peyote', 250, 250, false],
    ['brick', 250, 250, false],
    ['brick', 250, 250, true],
  ])('keeps a %s Pattern of %s × %s (turned: %s) inside the pixel budget', (technique, columns, rows, rotated) => {
    const pattern = shape(technique, columns, rows, rotated)
    const zoom = pngZoom(pattern)
    const { width, height } = patternExtentPx(technique, columns, rows)

    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX * 2)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
    expect(zoom).toBeGreaterThan(0.5)
  })
})

describe('planChart (ticket 74)', () => {
  const page = { width: 1090, height: 1534 }

  it('keeps a Pattern that fits a page on one page', () => {
    const plan = planChart(shape('loom', 20, 30), PDF_ZOOM, page.width, page.height)

    expect(plan.pieces).toHaveLength(1)
    expect(plan.pieces[0]!.region).toEqual({ x: 0, y: 0, width: 20 * 27, height: 30 * 27 })
  })

  it('cuts a large Pattern into pieces that each fit a page and together cover all of it', () => {
    const pattern = shape('peyote', 250, 250)
    const plan = planChart(pattern, PDF_ZOOM, page.width, page.height)
    const { width, height } = patternExtentPx('peyote', 250, 250)

    expect(plan.pieces.length).toBe(plan.acrossTotal * plan.downTotal)
    expect(plan.pieces.length).toBeGreaterThan(20)
    for (const { region } of plan.pieces) {
      expect(region.width).toBeLessThanOrEqual(page.width)
      expect(region.height).toBeLessThanOrEqual(page.height)
    }
    const last = plan.pieces.at(-1)!.region
    // A piece's size is whole px, so the last reaches the Pattern's far edge and no further than the px it rounds up to.
    expect(last.x + last.width).toBeGreaterThanOrEqual(width * PDF_ZOOM)
    expect(last.x + last.width).toBeLessThan(width * PDF_ZOOM + 1)
    expect(last.y + last.height).toBeGreaterThanOrEqual(height * PDF_ZOOM)
    expect(last.y + last.height).toBeLessThan(height * PDF_ZOOM + 1)
  })

  it('cuts between beads, so none is split across two pages', () => {
    const plan = planChart(shape('brick', 100, 100), PDF_ZOOM, page.width, page.height)
    const rowStep = rowPitchPx('brick') * PDF_ZOOM

    for (const { region } of plan.pieces) {
      expect(region.x % (20 * PDF_ZOOM)).toBeCloseTo(0, 6)
      expect(region.y % rowStep).toBeCloseTo(0, 6)
    }
  })

  it("cuts a turned Pattern along its displayed sides: its rows run across the page", () => {
    const upright = planChart(shape('loom', 100, 20), PDF_ZOOM, page.width, page.height)
    const turned = planChart(shape('loom', 100, 20, true), PDF_ZOOM, page.width, page.height)

    expect([upright.acrossTotal, upright.downTotal]).toEqual([3, 1])
    expect([turned.acrossTotal, turned.downTotal]).toEqual([1, 2])
  })
})
