import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Rotation, Technique } from '../domain/grid'
import { MINI_MAP_GRID_LIMIT, miniMapLayout, pageOneLayout, PRINT_COLORS, PRINT_OPACITY } from './printPages'
import { mm, orientedPage, planPrint, PRINT_BEAD_BASE_MM, PRINT_BEAD_MAX_MM, PRINT_HEADER, PRINT_LEGEND_WIDTH, PRINT_MARGIN, PRINT_NAME_BAND } from './printPlan'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, columns, rows, rotation })

const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: { light: string } }[] }
  print: { tokens: { name: string; value: string | number }[] }
}
const color = (name: string) => tokens.color.tokens.find((entry) => entry.name === name)!.value.light
const print = (name: string) => tokens.print.tokens.find((entry) => entry.name === name)!.value

describe('the printed pages keep to the tokens (ticket 162)', () => {
  it('uses the light colors and the print board', () => {
    expect(PRINT_COLORS).toMatchObject({ ink: color('ink'), muted: color('muted'), line: color('line'), accent: color('accent'), board: color('print-board') })
  })

  it('uses the print sizes and opacities', () => {
    const size = (name: string) => mm(Number.parseFloat(String(print(name))))
    expect(PRINT_MARGIN).toBeCloseTo(size('print-margin'))
    expect(PRINT_HEADER).toBeCloseTo(size('print-header'))
    expect(PRINT_NAME_BAND).toBeCloseTo(size('print-name-band'))
    expect(PRINT_LEGEND_WIDTH).toBeCloseTo(size('print-legend-width'))
    expect(PRINT_BEAD_BASE_MM).toBe(Number.parseFloat(String(print('print-bead-base'))))
    expect(PRINT_BEAD_MAX_MM).toBe(Number.parseFloat(String(print('print-bead-max'))))
    expect(PRINT_OPACITY).toEqual({ line: Number(print('print-line-opacity')), mark: Number(print('print-mark-opacity')), name: Number(print('print-name-opacity')) })
  })
})

describe('pageOneLayout: fills the sheet even for a huge Pattern (ticket 184)', () => {
  it.each<[Technique, number, number]>([
    ['peyote', 250, 250],
    ['brick', 250, 250],
    ['loom', 250, 250],
    ['loom', 60, 80],
    ['loom', 20, 20],
  ])('draws a %s %s×%s Pattern as large as the better of the two legend placements allows', (technique, columns, rows) => {
    const pattern = shape(technique, columns, rows)
    const page = orientedPage(pattern)
    const layout = pageOneLayout(pattern, page)

    // Whichever side the legend sits on, the Pattern reaches that layout's own room on at least one axis: nothing
    // is left small in a box it doesn't fill.
    expect(Math.max(layout.extent.width / layout.room.width, layout.extent.height / layout.room.height)).toBeGreaterThan(0.99)
  })

  it('picks the side legend over the previously-forced below-legend band for a peyote 250×250 Pattern', () => {
    // Peyote's rows sit closer than its columns (rowPitchPx), so a square 250×250 bead count is technically wider
    // than tall and used to be forced into the below-legend layout, whose fixed mm(78) band fit it at zoom ≈ 0.08
    // versus ≈ 0.20 beside the legend — a small, centered chart on an otherwise empty page.
    const pattern = shape('peyote', 250, 250)
    const layout = pageOneLayout(pattern, orientedPage(pattern))

    expect(layout.columnBelow).toBe(false)
    expect(layout.zoom).toBeGreaterThan(0.15)
  })

  it('still uses the below-legend layout for a Pattern that is genuinely much wider than tall', () => {
    const pattern = shape('loom', 300, 24)
    const layout = pageOneLayout(pattern, orientedPage(pattern))

    expect(layout.columnBelow).toBe(true)
  })
})

describe('miniMapLayout: the chart-page locator (ticket 187)', () => {
  it('keeps the block grid’s own row/column shape at 16 blocks or fewer', () => {
    const pattern = shape('loom', 150, 220) // 2 × 3 = 6 blocks
    const plan = planPrint(pattern)
    const layout = miniMapLayout(plan, plan.parts[2]!) // across 0, down 1

    expect(plan.partsAcross * plan.partsDown).toBeLessThanOrEqual(MINI_MAP_GRID_LIMIT)
    expect(layout.cells).toHaveLength(6)
    // Two rows of three: the highlighted cell keeps its own (across, down), not squashed into a single row.
    expect(new Set(layout.cells.map((cell) => cell.down))).toEqual(new Set([0, 1, 2]))
    expect(layout.cells.filter((cell) => cell.here)).toEqual([{ across: 0, down: 1, here: true }])
  })

  it('switches to a horizontal strip past 16 blocks, so the locator never grows taller than one row (ticket 187)', () => {
    const plan = planPrint(shape('loom', 500, 500)) // 5 × 5 = 25 blocks
    const part = plan.parts[Math.floor(plan.parts.length / 2)]!
    const layout = miniMapLayout(plan, part)

    expect(plan.partsAcross * plan.partsDown).toBeGreaterThan(MINI_MAP_GRID_LIMIT)
    expect(layout.cells).toHaveLength(plan.partsAcross * plan.partsDown)
    // Every cell sits in a single row: the locator adds no height under the header.
    expect(layout.cells.every((cell) => cell.down === 0)).toBe(true)
    expect(layout.cells.filter((cell) => cell.here)).toHaveLength(1)
  })
})
