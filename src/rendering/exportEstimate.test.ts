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
  it('scales with the DPI', () => {
    const project = shape('loom', 20, 30)
    expect(estimatePdfBytes(project, 300)).toBeCloseTo(estimatePdfBytes(project, 150) * 2, -3)
  })

  it('counts more pages for a larger Frame', () => {
    expect(estimatePdfBytes(shape('loom', 100, 200), 150)).toBeGreaterThan(estimatePdfBytes(shape('loom', 20, 30), 150))
  })

  it('counts the list pages too', () => {
    const project = shape('loom', 20, 30)
    expect(estimatePdfBytes(project, 150, 2)).toBeGreaterThan(estimatePdfBytes(project, 150))
  })
})
