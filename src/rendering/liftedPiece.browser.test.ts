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

// What the shadows cost (ticket 1006): a layer laid over the screen costs the screen, so the shadows are blurred on a
// sheet smaller than it, kept from draw to draw.
describe('the shadows\' sheet', () => {
  /** The sheets laid on a surface by `drawLift` on `cells` at `scale`: each the source's size and where it lands. */
  function laid(cells: Parameters<typeof drawLift>[1], scale: number): { source: HTMLCanvasElement; canvasWidth: number; sourceWidth: number; sourceHeight: number; width: number }[] {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 2000
    const context = canvas.getContext('2d')!
    context.setTransform(scale, 0, 0, scale, 0, 0)
    const sheets: ReturnType<typeof laid> = []
    const watched = new Proxy(context, {
      get: (target, key) => {
        if (key === 'drawImage') return (source: HTMLCanvasElement, _x: number, _y: number, sw: number, sh: number, _dx: number, _dy: number, dw: number) => (sheets.push({ source, canvasWidth: source.width, sourceWidth: sw, sourceHeight: sh, width: dw }), target.drawImage(source, 0, 0, sw, sh, 0, 0, dw, sh))
        const value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
      set: (target, key, value) => Reflect.set(target, key, value),
    })
    drawLift(watched as unknown as DrawingContext, cells, DARK_THEME.canvas, scale)
    return sheets
  }
  const row = (columns: number) => [{ x: 40, y: 40, width: columns * CELL_SIZE_PX, height: CELL_SIZE_PX }]

  it('blurs the soft shadow on a sheet smaller than the screen at 40% on pixel ratio 2, the close one apart on the screen', () => {
    const [soft, ...others] = laid(row(20), 0.8)
    expect(others).toEqual([])
    expect(soft!.sourceWidth * 2).toBeLessThan(soft!.width)
  })

  it('lays one sheet for both shadows where the close one is blurred on a smaller sheet too', () => {
    expect(laid(row(20), 2)).toHaveLength(1)
  })

  it('keeps the sheet when the next draw needs the same or a smaller one, and grows it when it needs more', () => {
    const [large] = laid(row(20), 2)
    const [same] = laid(row(20), 2)
    const [smaller] = laid(row(4), 2)
    expect(same!.source).toBe(large!.source)
    expect(smaller!.canvasWidth).toBe(large!.canvasWidth)
    expect(smaller!.sourceWidth).toBeLessThan(large!.sourceWidth)
    const [larger] = laid(row(60), 2)
    expect(larger!.canvasWidth).toBeGreaterThan(large!.canvasWidth)
  })
})
