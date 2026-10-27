import { describe, expect, it } from 'vitest'
import { estimatePdfBytes, estimatePngBytes } from './exportEstimate'
import type { Technique } from '../domain/weave'

const shape = (technique: Technique, columns: number, rows: number) => ({ technique, rotation: 0 as const, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })

describe('estimatePngBytes (QualitySlider card)', () => {
  // Against real files: exportEstimate.browser.test.ts.
  it('scales with the DPI, since the page is the same drawing larger', () => {
    expect(estimatePngBytes(300, 0)).toBeCloseTo(estimatePngBytes(150, 0) * 2, -3)
    expect(estimatePngBytes(450, 0)).toBeGreaterThan(estimatePngBytes(300, 0))
  })

  it('adds a page for every list page Beads needed runs over onto', () => {
    expect(estimatePngBytes(300, 2)).toBeCloseTo(estimatePngBytes(300, 0) * 3, -3)
  })
})

describe('estimatePdfBytes', () => {
  it('adds a chart page as drawing, far smaller than a picture page (ticket 0585)', () => {
    // 100 × 100 takes three sheets where 20 × 20 takes one.
    const added = estimatePdfBytes(shape('loom', 100, 100)) - estimatePdfBytes(shape('loom', 20, 20))

    expect(added).toBe(2 * 150_000)
    expect(added).toBeLessThan(estimatePngBytes(300, 0))
  })

  it('counts more pages for a larger Frame', () => {
    expect(estimatePdfBytes(shape('loom', 100, 200))).toBeGreaterThan(estimatePdfBytes(shape('loom', 20, 30)))
  })

  it('counts the list pages too', () => {
    const project = shape('loom', 20, 30)
    expect(estimatePdfBytes(project, 2)).toBeGreaterThan(estimatePdfBytes(project))
  })
})
