import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { COVER_BEAD_MAX } from './coverLayout'
import { loadPrintFonts, lineBetween, partLabel, rulerLevel } from './printPages'
import { en } from '../i18n/en'
import { PRINT_COLORS } from './printColors'
import { mm, planPrint, PRINT_CHART_CELL_MM, PRINT_HEADER, PRINT_MARGIN } from './printPlan'
import { bareProject } from '../testUtils/layerFields'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => bareProject({ technique, orientation: rotation, beads: {}, frame: { technique: technique, row: 0, column: 0, columns, rows, beads: {} } })

const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: { light: string } }[] }
  print: { tokens: { name: string; value: string | number }[] }
}
const color = (name: string) => tokens.color.tokens.find((entry) => entry.name === name)!.value.light
const print = (name: string) => tokens.print.tokens.find((entry) => entry.name === name)!.value

describe('the printed pages keep to the tokens (ticket 162)', () => {
  it('uses the light colors and the print board', () => {
    expect(PRINT_COLORS).toMatchObject({ ink: color('ink'), muted: color('muted'), faint: color('faint'), line: color('line'), lineSoft: color('line-soft'), lineStrong: color('line-strong'), fieldLine: color('field-line'), accent: color('accent'), accentStrong: color('accent-strong'), board: color('print-board') })
  })

  it('uses the print sizes', () => {
    const size = (name: string) => mm(Number.parseFloat(String(print(name))))
    expect(PRINT_MARGIN).toBeCloseTo(size('print-margin'))
    expect(PRINT_HEADER).toBeCloseTo(size('print-header'))
    expect(COVER_BEAD_MAX).toBeCloseTo(size('print-bead-max'))
    expect(PRINT_CHART_CELL_MM).toBe(Number.parseFloat(String(print('print-chart-cell'))))
  })
})

describe('partLabel: the label above each pad (ticket 578)', () => {
  const label = (columns: number, rows: number, rotation: Rotation, letter: number) => {
    const project = shape('loom', columns, rows, rotation)
    const part = planPrint(project).parts[letter]!
    return partLabel(project, en.print, part)
  }

  it('names the part and the Schema’s own columns and rows', () => {
    expect(label(100, 40, 0, 1)).toBe('Part B · columns 61–100 · rows 1–40')
  })

  it('counts a turned Schema from its far end, lowest number first, with rows running across', () => {
    // A quarter turn: the 130 rows run across, so part B holds the last rows, counted from the far end, and all 40 columns.
    expect(label(40, 130, 90, 1)).toBe('Part B · columns 1–40 · rows 13–70')
  })
})

describe('chart rulers (tickets 579, 0585)', () => {
  it('numbers every 5th, the tens bold and the rest not at all', () => {
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
