import { describe, expect, it } from 'vitest'
import { miniMapRects } from './chartPage'
import { mm, planPrint } from './printPlan'
import { flatProject } from '../testUtils/flatFields'

const shape = (columns: number, rows: number) => flatProject({ technique: 'loom' as const, rotation: 0 as const, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns, rows, beads: {} } })

describe('miniMapRects: the header’s mini map (ticket 0585)', () => {
  it('shows the parts to scale inside a 9.4 mm square, 0.4 mm apart, the current one marked', () => {
    const project = shape(100, 100)
    const rects = miniMapRects(planPrint(project), project, 3)

    expect(rects).toHaveLength(4)
    expect(rects.map((rect) => rect.here)).toEqual([false, true, false, false])
    expect(Math.max(...rects.map((rect) => rect.x + rect.width))).toBeLessThanOrEqual(mm(9.4))
    // A and B are 60 and 40 beads across: A is 1.5 times as wide as B (their gaps aside), their gap 0.4 mm.
    expect((rects[0]!.width + mm(0.4)) / (rects[1]!.width + mm(0.4))).toBeCloseTo(1.5, 5)
    expect(rects[1]!.x - (rects[0]!.x + rects[0]!.width)).toBeCloseTo(mm(0.4), 5)
  })

  it('marks every part of a shared sheet', () => {
    const project = shape(100, 100)

    expect(miniMapRects(planPrint(project), project, 4).filter((rect) => rect.here)).toHaveLength(2)
  })
})
