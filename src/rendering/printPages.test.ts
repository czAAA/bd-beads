import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRINT_COLORS, PRINT_OPACITY } from './printPages'
import { mm, PRINT_BEAD_BASE_MM, PRINT_BEAD_MAX_MM, PRINT_HEADER, PRINT_LEGEND_WIDTH, PRINT_MARGIN, PRINT_NAME_BAND } from './printPlan'

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
