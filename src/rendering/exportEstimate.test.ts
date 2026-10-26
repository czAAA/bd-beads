import { describe, expect, it } from 'vitest'
import { estimatePdfBytes, estimatePngBytes, pngBeadPx } from './exportEstimate'
import type { Technique } from '../domain/weave'

const shape = (technique: Technique, columns: number, rows: number) => ({ technique, rotation: 0 as const, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })

describe('estimatePngBytes (QualitySlider card)', () => {
  // Against real files: exportEstimate.browser.test.ts.
  it('grows with the quality until the ceilings, then stops', () => {
    const small = shape('loom', 20, 30)
    expect(estimatePngBytes(small, 45)).toBeLessThan(estimatePngBytes(small, 60))
    expect(estimatePngBytes(small, 60)).toBeLessThan(estimatePngBytes(small, 90))
    const big = shape('loom', 250, 250)
    expect(estimatePngBytes(big, 60)).toBeLessThan(estimatePngBytes(big, 90))
    expect(estimatePngBytes(big, 90)).toBe(estimatePngBytes(big, 120))
  })
})

describe('pngBeadPx', () => {
  it('keeps the wanted size for a small Frame and reduces it for a large one', () => {
    expect(pngBeadPx(shape('loom', 20, 30), 60)).toBe(60)
    expect(pngBeadPx(shape('loom', 200, 200), 90)).toBeLessThan(90)
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
})
