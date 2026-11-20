import { describe, expect, it } from 'vitest'
import { miniMapRects } from './chartPage'
import { planWithKey } from './chartPageKey'
import { mm, planPrint } from './printPlan'
import { bareProject } from '../testUtils/layerFields'

const shape = (columns: number, rows: number) => bareProject({ technique: 'loom' as const, orientation: 0 as const, beads: {}, frame: { technique: 'loom' as const, row: 0, column: 0, columns, rows, beads: {} } })

describe('miniMapRects: the header’s mini map (ticket 0585)', () => {
  it('shows the parts to scale inside a 9.4 mm square, 0.4 mm apart, the current one marked', () => {
    const project = shape(150, 150)
    const rects = miniMapRects(planPrint(project), 3)

    expect(rects).toHaveLength(4)
    expect(rects.map((rect) => rect.here)).toEqual([false, true, false, false])
    expect(Math.max(...rects.map((rect) => rect.x + rect.width))).toBeLessThanOrEqual(mm(9.4))
    // A and C are 80 and 70 rows down (the cut on a multiple of 10), their gaps aside; A and B are 0.4 mm apart.
    expect((rects[0]!.height + mm(0.4)) / (rects[2]!.height + mm(0.4))).toBeCloseTo(80 / 70, 5)
    expect(rects[1]!.x - (rects[0]!.x + rects[0]!.width)).toBeCloseTo(mm(0.4), 5)
  })

  it('marks every part of a shared sheet', () => {
    // A 35 × 120 bracelet is two strips side by side on one sheet (ticket 0913), a chart page when page 1 has no room.
    const project = shape(35, 120)
    const plan = planPrint(project, { pageOne: { width: mm(190), height: mm(20) } })

    expect(plan.parts.map((part) => part.page)).toEqual([2, 2])
    expect(miniMapRects(plan, 2).filter((rect) => rect.here)).toHaveLength(2)
  })

  it('maps the trimmed chart, its first part in the corner, not the whole Frame (ticket 1128)', () => {
    const beads = { 10: { 50: '#ff0000', 249: '#ff0000' }, 109: { 50: '#ff0000', 249: '#ff0000' } }
    const piece = bareProject({ technique: 'loom', orientation: 0, beads: {}, frame: { technique: 'loom', row: 0, column: 0, columns: 300, rows: 120, beads } })
    const trimmed = miniMapRects(planWithKey(piece), 2)
    const alone = miniMapRects(planPrint(shape(200, 100)), 2)

    expect(trimmed.map(({ x, y, width, height }) => [x, y, width, height])).toEqual(alone.map(({ x, y, width, height }) => [x, y, width, height]))
  })
})
