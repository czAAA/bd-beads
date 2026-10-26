import { describe, expect, it } from 'vitest'
import { estimatePdfBytes, estimatePngBytes, pngBeadPx } from './exportEstimate'
import type { Technique } from '../domain/weave'

const shape = (technique: Technique, columns: number, rows: number) => ({ technique, rotation: 0 as const, beads: {}, frame: { technique, row: 0, column: 0, columns, rows, beads: {} } })

describe('estimatePngBytes (QualitySlider card)', () => {
  it('matches the pixels a real 20 × 30 export measured, within a tenth', () => {
    // Measured in Chromium: 2 042 790 px at 45 px a bead, 3 241 740 at 60, 6 449 640 at 90 (0.07 B/px assumed).
    for (const [beadPx, pixels] of [[45, 2_042_790], [60, 3_241_740], [90, 6_449_640]]) {
      expect(estimatePngBytes(shape('loom', 20, 30), beadPx) / 0.07).toBeGreaterThan(pixels * 0.9)
      expect(estimatePngBytes(shape('loom', 20, 30), beadPx) / 0.07).toBeLessThan(pixels * 1.1)
    }
  })

  it('grows with the quality until the pixel ceiling, then stops', () => {
    const small = shape('loom', 20, 30)
    expect(estimatePngBytes(small, 45)).toBeLessThan(estimatePngBytes(small, 60))
    expect(estimatePngBytes(small, 60)).toBeLessThan(estimatePngBytes(small, 90))
    const big = shape('loom', 100, 200)
    expect(estimatePngBytes(big, 60)).toBe(estimatePngBytes(big, 90))
  })
})

describe('pngBeadPx', () => {
  it('keeps the wanted size for a small Frame and reduces it for a large one', () => {
    expect(pngBeadPx(shape('loom', 20, 30), 60)).toBe(60)
    expect(pngBeadPx(shape('loom', 60, 100), 90)).toBeLessThan(90)
  })
})

describe('estimatePdfBytes', () => {
  it('scales with the square of the DPI', () => {
    const project = shape('loom', 20, 30)
    expect(estimatePdfBytes(project, 300)).toBeCloseTo(estimatePdfBytes(project, 150) * 4, -3)
  })

  it('counts more pages for a larger Frame', () => {
    expect(estimatePdfBytes(shape('loom', 100, 200), 150)).toBeGreaterThan(estimatePdfBytes(shape('loom', 20, 30), 150))
  })
})
