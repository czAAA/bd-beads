import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { COVER_BEAD_MAX } from './coverLayout'
import { loadPrintFonts, lineBetween, MINI_MAP_GRID_LIMIT, miniMapLayout, partLabel, rulerLevel, rulerSide } from './printPages'
import { en } from '../i18n/en'
import type { Project } from '../domain/project'
import { PRINT_COLORS } from './printColors'
import { mm, planPrint, PRINT_CHART_CELL_MM, PRINT_HEADER, PRINT_MARGIN } from './printPlan'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, rotation, beads: {}, frame: { technique: technique, row: 0, column: 0, columns, rows, beads: {} } })

const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: { light: string } }[] }
  print: { tokens: { name: string; value: string | number }[] }
}
const color = (name: string) => tokens.color.tokens.find((entry) => entry.name === name)!.value.light
const print = (name: string) => tokens.print.tokens.find((entry) => entry.name === name)!.value

describe('the printed pages keep to the tokens (ticket 162)', () => {
  it('uses the light colors and the print board', () => {
    expect(PRINT_COLORS).toMatchObject({ ink: color('ink'), muted: color('muted'), faint: color('faint'), line: color('line'), accent: color('accent'), accentStrong: color('accent-strong'), board: color('print-board') })
  })

  it('uses the print sizes', () => {
    const size = (name: string) => mm(Number.parseFloat(String(print(name))))
    expect(PRINT_MARGIN).toBeCloseTo(size('print-margin'))
    expect(PRINT_HEADER).toBeCloseTo(size('print-header'))
    expect(COVER_BEAD_MAX).toBeCloseTo(size('print-bead-max'))
    expect(PRINT_CHART_CELL_MM).toBe(Number.parseFloat(String(print('print-chart-cell'))))
  })
})

describe('miniMapLayout: the chart-page locator (ticket 187)', () => {
  it('keeps the block grid’s own row/column shape at 16 blocks or fewer', () => {
    const project = shape('loom', 150, 220)
    const plan = planPrint(project)
    const layout = miniMapLayout(plan, plan.parts.find((part) => part.across === 0 && part.down === 1)!)

    expect(plan.partsAcross * plan.partsDown).toBeLessThanOrEqual(MINI_MAP_GRID_LIMIT)
    expect(layout.cells).toHaveLength(plan.partsAcross * plan.partsDown)
    // The highlighted cell keeps its own (across, down), not squashed into a single row.
    expect(new Set(layout.cells.map((cell) => cell.down)).size).toBe(plan.partsDown)
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

  it('marks every part of a shared sheet (ticket 578)', () => {
    // A few rows left over at the bottom: its two short parts share a sheet.
    const plan = planPrint(shape('loom', 100, 70))
    const shared = plan.parts.filter((part) => plan.parts.some((other) => other !== part && other.page === part.page))
    const layout = miniMapLayout(plan, shared[0]!)

    expect(layout.cells.filter((cell) => cell.here)).toHaveLength(shared.filter((part) => part.page === shared[0]!.page).length)
  })
})

describe('partLabel: the label above each board (ticket 578)', () => {
  const label = (columns: number, rows: number, rotation: Rotation, letter: number) => {
    const project = shape('loom', columns, rows, rotation) as unknown as Project
    const part = planPrint(project).parts[letter]!
    return partLabel(project, en.print, part)
  }

  it('names the part and the Schema’s own columns and rows', () => {
    expect(label(100, 40, 0, 1)).toBe('Part B · columns 57–100 · rows 1–40')
  })

  it('counts a turned Schema from its far end, lowest number first, with rows running across', () => {
    // A quarter turn: the 130 rows run across, so part B holds the last rows, counted from the far end, and all 40 columns.
    expect(label(40, 130, 90, 1)).toBe('Part B · columns 1–40 · rows 19–74')
  })
})

describe('chart rulers (ticket 579)', () => {
  it('puts odd numbers on the top and left and even on the bottom and right, so each appears once', () => {
    expect([1, 2, 99, 100, 101, 130].map(rulerSide)).toEqual(['start', 'end', 'start', 'end', 'start', 'end'])
  })

  it('sets every 10th bold, every 5th in ink and the rest muted', () => {
    expect([10, 100, 5, 15, 1, 7, 101].map(rulerLevel)).toEqual(['tenth', 'tenth', 'fifth', 'fifth', 'plain', 'plain', 'plain'])
  })

  it('draws a fine line after every 5th bead and a heavier one after every 10th, counting the Schema’s own numbers either way it runs', () => {
    expect(lineBetween(5, 6)).toBe('fifth')
    expect(lineBetween(10, 11)).toBe('tenth')
    expect(lineBetween(3, 4)).toBeUndefined()
    // A turned Schema counts down: the line sits between 11 and 10, after the 10th bead in the Schema's order.
    expect(lineBetween(11, 10)).toBe('tenth')
    expect(lineBetween(6, 5)).toBe('fifth')
  })
})

describe('loadPrintFonts (ticket 278)', () => {
  it('loads Inter 400, 600 and 700 before anything is drawn', async () => {
    const load = vi.fn().mockResolvedValue([])
    vi.stubGlobal('document', { fonts: { load } })
    try {
      await loadPrintFonts()
    } finally {
      vi.unstubAllGlobals()
    }
    const specs = load.mock.calls.map(([spec]) => String(spec))
    for (const weight of ['400', '600', '700']) expect(specs.some((spec) => spec.startsWith(`${weight} `) && spec.includes('Inter')), weight).toBe(true)
  })
})
