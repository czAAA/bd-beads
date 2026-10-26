import { describe, expect, it } from 'vitest'
import { PNG_BEAD_PX, PNG_MAX_PIXELS, PNG_MAX_WIDTH, PNG_MARGIN_PX, pngZoom } from './projectExport'
import type { Rotation } from '../domain/grid'
import type { Technique } from '../domain/weave'
import { frameWeave } from '../domain/project'
import { displayedExtentPx, projectExtentPx } from './surfaceView'

const shape = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, rotation, beads: {}, frame: { technique: technique, row: 0, column: 0, columns, rows, beads: {} } })

describe('pngZoom (ticket 73)', () => {
  it('draws a bead at the legible size for an ordinary Project', () => {
    expect(pngZoom(shape('loom', 30, 30)) * 20).toBe(PNG_BEAD_PX)
  })

  it.each<[Technique, number, number, Rotation]>([
    ['loom', 70, 250, 0],
    ['peyote', 250, 250, 0],
    ['brick', 250, 250, 0],
    ['brick', 250, 250, 90],
    ['brick', 250, 250, 180],
    ['brick', 250, 250, 270],
  ])('keeps a %s Project of %s × %s (rotation: %s°) inside the pixel budget', (technique, columns, rows, rotation) => {
    const project = shape(technique, columns, rows, rotation)
    const zoom = pngZoom(project)
    const { width, height } = projectExtentPx(technique, columns, rows)

    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX * 2)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
    expect(zoom).toBeGreaterThan(0.5)
  })
})

describe('pngZoom: the ceilings (ticket 571)', () => {
  it('draws a 90 px bead for a Frame a phone could not have held before', () => {
    expect(pngZoom(shape('loom', 100, 100), 90) * 20).toBe(90)
  })

  it('draws a 200 × 200 Frame at 90 px no wider than a browser canvas allows', () => {
    const project = shape('loom', 200, 200)
    const zoom = pngZoom(project, 90)
    const { width, height } = projectExtentPx('loom', 200, 200)

    expect(zoom * 20).toBeLessThan(90)
    expect(Math.ceil(width * zoom) + PNG_MARGIN_PX * 2).toBeLessThanOrEqual(PNG_MAX_WIDTH)
    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX * 2)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
  })
})

describe('pngZoom: Bead shape (ticket 509)', () => {
  const real = { ...shape('peyote', 250, 250), beadId: 'miyuki-delica-11-0', beadShape: 'real' as const }

  it('keeps a Real Project inside the pixel budget, measured on its own cells', () => {
    const zoom = pngZoom(real)
    const { width, height } = displayedExtentPx(real.technique, 250, 250, 1, 0, frameWeave(real).cell)

    expect((Math.ceil(width * zoom) + PNG_MARGIN_PX * 2) * (Math.ceil(height * zoom) + PNG_MARGIN_PX * 2)).toBeLessThanOrEqual(PNG_MAX_PIXELS)
  })

  it('is the same zoom as Symmetric when the Project is Symmetric', () => {
    expect(pngZoom({ ...real, beadShape: undefined })).toBe(pngZoom(shape('peyote', 250, 250)))
  })
})
