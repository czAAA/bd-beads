import { describe, expect, it } from 'vitest'
import { patternExtentPx } from './patternRenderer'
import { PNG_BEAD_PX, PNG_MAX_PIXELS, PNG_MARGIN_PX, pngZoom } from './patternExport'
import type { Technique } from '../domain/grid'

const shape = (technique: Technique, columns: number, rows: number, rotated = false) => ({ technique, columns, rows, rotated })

describe('pngZoom (ticket 73)', () => {
  it('draws a bead at the legible size for an ordinary Pattern', () => {
    expect(pngZoom(shape('loom', 30, 30)) * 20).toBe(PNG_BEAD_PX)
  })

  it.each<[Technique, number, number, boolean]>([
    ['loom', 70, 250, false],
    ['peyote', 250, 250, false],
    ['brick', 250, 250, false],
    ['brick', 250, 250, true],
  ])('keeps a %s Pattern of %s × %s (turned: %s) inside the pixel budget', (technique, columns, rows, rotated) => {
    const pattern = shape(technique, columns, rows, rotated)
    const zoom = pngZoom(pattern)
    const { width, height } = patternExtentPx(technique, columns, rows)

    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX * 2)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
    expect(zoom).toBeGreaterThan(0.5)
  })
})
