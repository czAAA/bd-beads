import { describe, expect, it } from 'vitest'
import { patternExtentPx } from './patternRenderer'
import { PNG_BEAD_PX, PNG_MAX_PIXELS, PNG_MARGIN_PX, pngZoom } from './patternExport'
import type { Rotation, Technique } from '../domain/grid'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, columns, rows, rotation })

describe('pngZoom (ticket 73)', () => {
  it('draws a bead at the legible size for an ordinary Pattern', () => {
    expect(pngZoom(shape('loom', 30, 30)) * 20).toBe(PNG_BEAD_PX)
  })

  it.each<[Technique, number, number, Rotation]>([
    ['loom', 70, 250, 0],
    ['peyote', 250, 250, 0],
    ['brick', 250, 250, 0],
    ['brick', 250, 250, 90],
    ['brick', 250, 250, 180],
    ['brick', 250, 250, 270],
  ])('keeps a %s Pattern of %s × %s (rotation: %s°) inside the pixel budget', (technique, columns, rows, rotation) => {
    const pattern = shape(technique, columns, rows, rotation)
    const zoom = pngZoom(pattern)
    const { width, height } = patternExtentPx(technique, columns, rows)

    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX * 2)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
    expect(zoom).toBeGreaterThan(0.5)
  })
})
