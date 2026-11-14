import { describe, expect, it } from 'vitest'
import { drawFlatBead, DARK_THEME, LIGHT_THEME, type DrawingContext, type ProjectTheme } from './beadLook'

// The satin light drawn for real (ticket 1003, BeadBoard card, Canvas look): along a row of one color the light sits in
// the middle of each bead and nothing steps beside an edge, so the row draws no second grid.

const BEADS = 10
const SIZE = 20
const SCALE = 4
/** A gradient is dithered: neighbouring pixels may differ by a level of a channel either way. */
const DITHER = 1.01

/** The luma of each device pixel along the line through the beads' middles, a row of ten `color` beads side by side. */
function rowLuma(color: string, theme: ProjectTheme, cornerRadius = 0): number[] {
  const canvas = document.createElement('canvas')
  canvas.width = BEADS * SIZE * SCALE
  canvas.height = SIZE * SCALE
  const context = canvas.getContext('2d')!
  context.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  context.imageSmoothingEnabled = false
  for (let at = 0; at < BEADS; at++) {
    drawFlatBead(context as DrawingContext, { x: at * SIZE, y: 0, size: SIZE, cornerRadius, color, dimmed: false, deviceScale: SCALE, theme })
  }
  // The light's centre is 46% down the body.
  const y = Math.round((0.5 + 19 * 0.46) * SCALE)
  const { data } = context.getImageData(0, y, canvas.width, 1)
  return Array.from({ length: canvas.width }, (_, x) => 0.2126 * data[x * 4]! + 0.7152 * data[x * 4 + 1]! + 0.0722 * data[x * 4 + 2]!)
}

describe('the satin light along a row of one color', () => {
  it.each([
    ['yellow in light', '#f2c94c', LIGHT_THEME, 0],
    ['red on a rounded bead', '#e63746', DARK_THEME, 4.4],
    ['black', '#1a1a1a', DARK_THEME, 0],
  ] as const)('is brightest in the middle of each bead and never steps up beside an edge: %s', (_name, color, theme, cornerRadius) => {
    const line = rowLuma(color, theme, cornerRadius)
    const pitch = SIZE * SCALE
    for (let at = 0; at < BEADS; at++) {
      // The body, from half a pixel in to half a pixel before the next bead.
      const body = line.slice(at * pitch + SCALE / 2, (at + 1) * pitch - SCALE / 2)
      const brightest = body.indexOf(Math.max(...body))
      const across = (brightest + SCALE / 2) / pitch
      expect(across, `bead ${at}`).toBeGreaterThan(0.4)
      expect(across, `bead ${at}`).toBeLessThan(0.6)
      // From each edge to the brightest point it only rises, and past it only falls: no light or dark line by an edge.
      for (let x = 1; x <= brightest; x++) expect(body[x]!, `bead ${at} at ${x}`).toBeGreaterThanOrEqual(body[x - 1]! - DITHER)
      for (let x = brightest + 1; x < body.length; x++) expect(body[x]!, `bead ${at} at ${x}`).toBeLessThanOrEqual(body[x - 1]! + DITHER)
    }
  })

  it('lifts a yellow bead\'s middle by about 4.5% of its own lightness, and the edge of its body not at all', () => {
    const line = rowLuma('#f2c94c', LIGHT_THEME)
    const pitch = SIZE * SCALE
    const body = line.slice(SCALE / 2, pitch - SCALE / 2)
    const edge = body[SCALE]!
    expect((Math.max(...body) - edge) / edge).toBeGreaterThan(0.03)
    expect((Math.max(...body) - edge) / edge).toBeLessThan(0.06)
    // A few px in from the body's edge it is the bead's own color: the light has gone before the edge.
    expect(edge).toBeCloseTo(0.2126 * 0xf2 + 0.7152 * 0xc9 + 0.0722 * 0x4c, 0)
  })

  it('parts two beads of one color by their rim alone: the line between them is the rim, no Canvas', () => {
    const line = rowLuma('#f2c94c', DARK_THEME)
    const seam = line[SIZE * SCALE]!
    // The rim is yellow 18% toward black, far from the dark Canvas's #202020.
    expect(seam).toBeCloseTo(0.2126 * 198 + 0.7152 * 165 + 0.0722 * 62, 0)
  })
})
