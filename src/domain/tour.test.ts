import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TOUR_COLUMNS,
  TOUR_ROWS,
  TOUR_STEPS,
  afterStep,
  evaluateStep,
  gridsEqual,
  tourTargets,
  type TourSnapshot,
} from './tour'
import type { Grid } from './pattern'

function count(grid: Grid, color: string | null) {
  return grid.flat().filter((cell) => cell.color === color).length
}

const YELLOW = '#f2c94c'
const BLACK = '#1a1a1a'

function snapshot(overrides: Partial<TourSnapshot> = {}): TourSnapshot {
  return {
    patternId: 'p',
    columns: TOUR_COLUMNS,
    rows: TOUR_ROWS,
    grid: afterStep(1),
    tool: 'paint',
    colorId: 'black',
    selection: undefined,
    pasteArmed: false,
    rowProgress: { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 },
    ...overrides,
  }
}

describe('the Tour Pattern', () => {
  it('is the design system\'s artwork, copied', () => {
    const design = readFileSync(resolve(__dirname, '../../docs/design/system/components/TourPattern/tour-pattern.json'), 'utf8')
    expect(JSON.parse(readFileSync(resolve(__dirname, 'tourPatternData.json'), 'utf8'))).toEqual(JSON.parse(design))
  })

  it('has eleven steps', () => {
    expect(TOUR_STEPS).toHaveLength(11)
  })

  it('ends with the artwork: 294 yellow, 452 black and four empty beads', () => {
    const grid = afterStep(8)
    expect(grid).toHaveLength(75)
    expect(grid[0]).toHaveLength(10)
    expect(count(grid, YELLOW)).toBe(294)
    expect(count(grid, BLACK)).toBe(452)
    expect(count(grid, null)).toBe(4)
  })

  it('starts empty and fills black in step 2', () => {
    expect(count(afterStep(1), null)).toBe(750)
    expect(count(afterStep(2), BLACK)).toBe(750)
  })

  it('has the 22-bead outline after step 3 and the eye black after step 5', () => {
    expect(count(afterStep(3), YELLOW)).toBe(22)
    expect(count(afterStep(4), YELLOW)).toBe(count(afterStep(5), YELLOW) + 16)
  })

  it('has all five rhombuses after step 6 and the Tour finishing 28 beads in step 7, leaving one stray bead', () => {
    expect(count(afterStep(6), YELLOW)).toBe(5 * (count(afterStep(5), YELLOW)))
    const after7 = afterStep(7)
    expect(after7[0]![0]!.color).toBe(YELLOW)
    expect(afterStep(8)[0]![0]!.color).toBeNull()
  })
})

describe('evaluateStep', () => {
  it('step 1 is done once a Pattern is open', () => {
    expect(evaluateStep('create', snapshot({ patternId: undefined }), {}).done).toBe(false)
    expect(evaluateStep('create', snapshot(), {}).done).toBe(true)
    expect(evaluateStep('create', snapshot({ columns: 5, rows: 5, grid: afterStep(1).slice(0, 5).map((row) => row.slice(0, 5)) }), {}).done).toBe(false)
  })

  it('a grid step is done when the grid is exactly what the step draws', () => {
    expect(evaluateStep('fill', snapshot(), {}).done).toBe(false)
    expect(evaluateStep('fill', snapshot({ grid: afterStep(2) }), {}).done).toBe(true)
  })

  it('the Tour finishing step is never done on its own', () => {
    expect(evaluateStep('finish', snapshot({ grid: afterStep(7) }), {}).done).toBe(false)
  })

  it('remove line is done only after the size left and came back', () => {
    const full = afterStep(8)
    let result = evaluateStep('remove-line', snapshot({ grid: full }), {})
    expect(result.done).toBe(false)
    result = evaluateStep('remove-line', snapshot({ grid: full.slice(1), rows: 74 }), result.memo)
    expect(result.done).toBe(false)
    expect(result.memo.sizeLeft).toBe(true)
    result = evaluateStep('remove-line', snapshot({ grid: full }), result.memo)
    expect(result.done).toBe(true)
  })

  it('row progress is done when rows 1 to 3 were marked and row 3 opened again', () => {
    const full = afterStep(8)
    const progress = (currentRow: number, enabled = true) => ({ enabled, direction: 'rows' as const, currentRow, currentColumn: 0 })
    let result = evaluateStep('rows', snapshot({ grid: full, rowProgress: progress(2) }), {})
    expect(result.done).toBe(false)
    result = evaluateStep('rows', snapshot({ grid: full, rowProgress: progress(3) }), result.memo)
    expect(result.done).toBe(false)
    result = evaluateStep('rows', snapshot({ grid: full, rowProgress: progress(2) }), result.memo)
    expect(result.done).toBe(true)
  })
})

describe('tourTargets', () => {
  it('points at the tool, then the color, then the canvas', () => {
    expect(tourTargets('fill', snapshot({ tool: 'paint' }), {}).control).toBe('tool-fill')
    expect(tourTargets('fill', snapshot({ tool: 'fill', colorId: 'yellow' }), {}).control).toBe('color-black')
    expect(tourTargets('fill', snapshot({ tool: 'fill', colorId: 'black' }), {}).control).toBe('board')
  })

  it('marks the outline beads still to paint', () => {
    const targets = tourTargets('outline', snapshot({ tool: 'paint', colorId: 'yellow', grid: afterStep(2) }), {})
    expect(targets.control).toBe('board')
    expect(targets.cells).toHaveLength(22)
  })

  it('walks Copy and paste through select, the frame, Copy and the four spots', () => {
    const base = { grid: afterStep(5) }
    expect(tourTargets('copy', snapshot({ ...base, tool: 'paint' }), {}).control).toBe('tool-select')
    const selecting = tourTargets('copy', snapshot({ ...base, tool: 'select' }), {})
    expect(selecting.control).toBe('board')
    expect(selecting.box).toEqual({ top: 2, left: 0, rows: 11, columns: 10 })
    const selection = { top: 2, left: 0, rows: 11, columns: 10 }
    expect(tourTargets('copy', snapshot({ ...base, tool: 'select', selection }), {}).control).toBe('copy')
    const pasting = tourTargets('copy', snapshot({ ...base, tool: 'select', pasteArmed: true }), {})
    expect(pasting.pasteBoxes).toHaveLength(4)
    expect(gridsEqual(afterStep(6), afterStep(5))).toBe(false)
    const half = tourTargets('copy', snapshot({ grid: afterStep(6), tool: 'select', pasteArmed: true }), {})
    expect(half.pasteBoxes).toHaveLength(0)
  })

  it('walks Remove line through the rulers, Remove line and Undo', () => {
    const full = afterStep(8)
    expect(tourTargets('remove-line', snapshot({ grid: full }), {}).control).toBe('ruler')
    const selection = { top: 4, left: 0, rows: 1, columns: 10 }
    expect(tourTargets('remove-line', snapshot({ grid: full, selection }), {}).control).toBe('remove-line')
    expect(tourTargets('remove-line', snapshot({ grid: full.slice(1), rows: 74 }), { sizeLeft: true }).control).toBe('undo')
  })

  it('walks Row progress through the switch, Row done and Row not done', () => {
    const full = afterStep(8)
    const progress = (currentRow: number, enabled: boolean) => ({ enabled, direction: 'rows' as const, currentRow, currentColumn: 0 })
    expect(tourTargets('rows', snapshot({ grid: full }), {}).control).toBe('progress-switch')
    expect(tourTargets('rows', snapshot({ grid: full, rowProgress: progress(1, true) }), {}).control).toBe('progress-next')
    expect(tourTargets('rows', snapshot({ grid: full, rowProgress: progress(3, true) }), { reachedRow3: true }).control).toBe('progress-previous')
  })
})
