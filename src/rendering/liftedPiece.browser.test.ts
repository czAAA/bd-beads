import { describe, expect, it } from 'vitest'
import { DARK_THEME, LIGHT_THEME, type DrawingContext, type ProjectTheme } from './beadLook'
import { CELL_SIZE_PX } from './cellSize'
import { drawLift, liftLookOf } from './liftedPiece'

// The Lifted piece drawn for real (ticket 1004, BeadBoard card, Lifted piece): the ground round the beads, the contour
// past it, and the shadow under it, made without the canvas filter.

const SCALE = 4
const SIDE = 140

/** A 3-bead row and a bead below its middle, lifted on `theme`'s Background, read back as pixels. */
function lifted(theme: ProjectTheme): (x: number, y: number) => [number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE * SCALE
  const context = canvas.getContext('2d')!
  context.fillStyle = theme.canvas
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.setTransform(SCALE, 0, 0, SCALE, 0, 0)
  const at = (column: number, row: number) => ({ x: 40 + column * CELL_SIZE_PX, y: 40 + row * CELL_SIZE_PX, width: CELL_SIZE_PX, height: CELL_SIZE_PX })
  drawLift(context as DrawingContext, [{ ...at(0, 0), width: 3 * CELL_SIZE_PX }, at(1, 1)], theme.canvas, SCALE)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return (x, y) => {
    const index = (Math.round(y * SCALE) * canvas.width + Math.round(x * SCALE)) * 4
    return [data[index]!, data[index + 1]!, data[index + 2]!]
  }
}

const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`

describe.each([
  ['dark', DARK_THEME],
  ['light', LIGHT_THEME],
] as const)('a Lifted piece in %s', (_name, theme) => {
  const look = liftLookOf(theme.canvas)
  const pixel = lifted(theme)

  it('fills the band next to the beads in its ground, then runs its contour, 4px outside the bead\'s body', () => {
    // Above the row's middle bead: the cell's edge is at y 40, the body half a px in.
    expect(hex(pixel(70, 39))).toBe(look.ground)
    expect(hex(pixel(70, 37.1))).toBe(look.contour)
    expect(hex(pixel(70, 35.5))).not.toBe(look.contour)
  })

  it('closes the corner between the row and the bead under it into one shape', () => {
    // Under the row, where its own line runs, just right of the lower bead: inside that bead's ground, so no line.
    expect(hex(pixel(81.5, 62.9))).toBe(look.ground)
  })

  it('lays a shadow below the piece and none above it', () => {
    const lum = ([r, g, b]: [number, number, number]) => r + g + b
    const far = lum(pixel(5, 5))
    expect(lum(pixel(70, 12))).toBe(far)
    expect(lum(pixel(70, 88))).toBeLessThan(far)
  })
})
