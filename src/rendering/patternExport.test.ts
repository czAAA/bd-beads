import { describe, expect, it } from 'vitest'
import { patternExtentPx } from './patternRenderer'
import { PNG_BEAD_PX, PNG_BOTTOM_MARGIN_PX, PNG_MAX_PIXELS, PNG_MARGIN_PX, pngBoardRect, pngZoom } from './patternExport'
import { PRINT_BOARD_PAD } from './printPlan'
import type { Rotation, Technique } from '../domain/grid'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, rotation, beads: {}, frame: { row: 0, column: 0, columns, rows } })

describe('pngZoom (ticket 73)', () => {
  it('draws a bead at the legible size for an ordinary Pattern', () => {
    expect(pngZoom(shape('loom', 30, 30)) * 20).toBe(PNG_BEAD_PX)
  })

  it.each<[Technique, number, number, Rotation]>([
    ['loom', 70, 250, 0],
    ['peyote', 250, 250, 0],
    ['brick', 250, 250, 0],
    ['brick', 250, 250, 90],
    ['brick', 250, 250, 180],
    ['brick', 250, 250, 270],
  ])('keeps a %s Pattern of %s × %s (rotation: %s°) inside the pixel budget', (technique, columns, rows, rotation) => {
    const pattern = shape(technique, columns, rows, rotation)
    const zoom = pngZoom(pattern)
    const { width, height } = patternExtentPx(technique, columns, rows)

    // The bottom margin is taller than the other three (PNG_BOTTOM_MARGIN_PX, ticket 183), so its border differs from the rest.
    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX + PNG_BOTTOM_MARGIN_PX)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
    expect(zoom).toBeGreaterThan(0.5)
  })
})

describe('pngBoardRect (ticket 183)', () => {
  it('sits inside the margin, not the full margin-inclusive chart', () => {
    const chart = { width: 500, height: 300 }
    const board = pngBoardRect(chart)

    // The margin band is blank border around the board, so the board can never reach the chart's own edges.
    expect(board.x).toBe(PNG_MARGIN_PX)
    expect(board.right).toBeLessThan(chart.width)
    expect(board.bottom).toBeLessThan(chart.height)
  })

  it('pads its right the same small amount the PDF page-1 board does, so the accent line tucks behind it the same way', () => {
    const chart = { width: 500, height: 300 }
    const board = pngBoardRect(chart)

    expect(board.top).toBe(PNG_MARGIN_PX - PRINT_BOARD_PAD)
    expect(board.right).toBe(chart.width - PNG_MARGIN_PX + PRINT_BOARD_PAD)
  })

  it("insets its bottom by the taller bottom margin (ticket 183), leaving room for the background name's own descender", () => {
    const chart = { width: 500, height: 300 }
    const board = pngBoardRect(chart)

    expect(board.bottom).toBe(chart.height - PNG_BOTTOM_MARGIN_PX + PRINT_BOARD_PAD)
    expect(chart.height - board.bottom).toBeGreaterThan(PNG_MARGIN_PX)
  })
})
