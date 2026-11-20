import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { loadPrintFonts, partLabel, RULER_FIT } from './printPages'
import { en } from '../i18n/en'
import { PRINT_COLORS } from './printColors'
import { COVER_BOARD, COVER_PAD } from './coverPageLayout'
import { mm, planPrint, PRINT_BEAD_LARGE_MM, PRINT_BEAD_MAX_MM, PRINT_BEAD_MIN_MM, PRINT_BEAD_STRETCH_MM, PRINT_HEADER, PRINT_MARGIN } from './printPlan'
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
    expect(COVER_BOARD).toBeCloseTo(size('print-cover-board'))
    expect(COVER_PAD).toBeCloseTo(size('print-cover-pad'))
    const bead = (name: string) => Number.parseFloat(String(print(name)))
    expect([PRINT_BEAD_MIN_MM, PRINT_BEAD_STRETCH_MM, PRINT_BEAD_LARGE_MM, PRINT_BEAD_MAX_MM]).toEqual(
      [bead('print-bead-min'), bead('print-bead-stretch'), bead('print-bead-large'), bead('print-bead-max')],
    )
  })
})

describe('partLabel: the label above each pad (ticket 578)', () => {
  const label = (columns: number, rows: number, rotation: Rotation, letter: number) => {
    const project = shape('loom', columns, rows, rotation)
    const plan = planPrint(project)
    return partLabel(plan.trim, en.print, plan.parts[letter]!)
  }

  it('names the part and its columns and rows as the rulers number them', () => {
    expect(label(150, 40, 0, 1)).toBe('Part B · columns 76–150 · rows 1–40')
  })

  it('counts a turned Schema from 1 at its left and top, its columns across and its rows down (ticket 1129)', () => {
    // A quarter turn: the 130 rows run across, so the chart is 130 columns by 40 rows, and part B holds columns 66 to 130.
    expect(label(40, 130, 90, 1)).toBe('Part B · columns 66–130 · rows 1–40')
  })

  it('counts a trimmed chart from its first column and row (ticket 1129)', () => {
    const project = shape('loom', 150, 40)
    const plan = planPrint(project, { trim: { firstAcross: 0, lastAcross: 149, firstDown: 0, lastDown: 39 } })
    const trimmed = planPrint(project, { trim: { firstAcross: 20, lastAcross: 149, firstDown: 5, lastDown: 34 } })
    expect(partLabel(plan.trim, en.print, plan.parts[0]!)).toBe('Part A · columns 1–75 · rows 1–40')
    expect(partLabel(trimmed.trim, en.print, trimmed.parts[1]!)).toMatch(/^Part B · columns \d+–130 · rows 1–30$/)
  })
})

describe('chart rulers (tickets 579, 0585)', () => {
  it('takes the token for how much of its room a ruler number may take', () => {
    expect(RULER_FIT * 100).toBe(Number.parseFloat(String(print('print-ruler-fit'))))
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
