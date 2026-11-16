import { describe, expect, it } from 'vitest'
import { DARK_THEME, drawFlatBead, LIGHT_THEME, type DrawingContext, type ProjectTheme } from './beadLook'
import { CELL_SIZE_PX } from './cellSize'
import { drawLift, joinedUpright, liftLookOf, type LiftCell } from './liftedPiece'

// The Lifted piece drawn for real (ticket 1004, BeadBoard card, Lifted piece): the ground round the beads, the contour
// past it, and the shadow under it, made without the canvas filter.

const SCALE = 4
const SIDE = 140

/** A 3-bead row and a bead below its middle, lifted on `theme`'s Background at `scale`, read back as pixels. */
function lifted(theme: ProjectTheme, scale = SCALE): (x: number, y: number) => [number, number, number] {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.ceil(SIDE * scale)
  const context = canvas.getContext('2d')!
  context.fillStyle = theme.canvas
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.setTransform(scale, 0, 0, scale, 0, 0)
  const at = (column: number, row: number) => ({ x: 40 + column * CELL_SIZE_PX, y: 40 + row * CELL_SIZE_PX, width: CELL_SIZE_PX, height: CELL_SIZE_PX })
  drawLift(context as DrawingContext, [{ ...at(0, 0), width: 3 * CELL_SIZE_PX }, at(1, 1)], theme.canvas, scale)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return (x, y) => {
    const index = (Math.round(y * scale) * canvas.width + Math.round(x * scale)) * 4
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

  it('casts the same shadow at low zoom, with no sheet, as on a sheet and at full size, scaled down (ticket 1033)', () => {
    const lum = ([r, g, b]: [number, number, number]) => r + g + b
    // Below the row's first bead, past its contour, the soft shadow's fall and fade.
    const profile = (scale: number) => {
      const at = lifted(theme, scale)
      return [66, 70, 74, 78].map((y) => lum(at(50, y)))
    }
    const full = profile(SCALE)
    // A step of 4 in each channel at most: the smaller pictures round the shape's edge to fewer pixels.
    const SAME = 12
    for (const scale of [0.8, 1.6]) profile(scale).forEach((value, index) => expect(Math.abs(value - full[index]!)).toBeLessThanOrEqual(SAME))
    expect(full[0]).toBeLessThan(full[3]!)
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

  it('blurs the soft shadow on a sheet smaller than the screen at 80% on pixel ratio 2, the close one apart on the screen', () => {
    const [soft, ...others] = laid(row(20), 1.6)
    expect(others).toEqual([])
    expect(soft!.sourceWidth * 2).toBeLessThan(soft!.width)
  })

  it('lays one sheet for both shadows where the close one is blurred on a smaller sheet too', () => {
    expect(laid(row(20), 4)).toHaveLength(1)
  })

  it('lays no sheet at low zoom, where the soft shadow\'s blur is too small to draw smaller', () => {
    expect(laid(row(20), 0.8)).toEqual([])
  })

  it('keeps the sheet when the next draw needs the same or a smaller one, and grows it when it needs more', () => {
    const [large] = laid(row(20), 4)
    const [same] = laid(row(20), 4)
    const [smaller] = laid(row(4), 4)
    expect(same!.source).toBe(large!.source)
    expect(smaller!.canvasWidth).toBe(large!.canvasWidth)
    expect(smaller!.sourceWidth).toBeLessThan(large!.sourceWidth)
    const [larger] = laid(row(60), 4)
    expect(larger!.canvasWidth).toBeGreaterThan(large!.canvasWidth)
  })
})

// A piece in a round bead, drawn for real (ticket 1010, BeadBoard card, Lifted piece): TOHO Round 11/0's cell is a pill
// 20 wide and 28 tall here. Beads are laid over the piece, so what shows between them is what the piece leaves.
describe.each([
  ['dark', DARK_THEME],
  ['light', LIGHT_THEME],
] as const)('a Lifted piece of round beads in %s', (_name, theme) => {
  const [WIDTH, HEIGHT] = [CELL_SIZE_PX, CELL_SIZE_PX * 1.4]
  const look = liftLookOf(theme.canvas)

  /** The beads at `[row, column, columns]` runs (touching beads as one cell, as the Canvas takes them), lifted and drawn. */
  function roundPiece(runs: [number, number, number][]): (x: number, y: number) => string {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIDE * SCALE
    const context = canvas.getContext('2d')!
    context.fillStyle = theme.canvas
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    const cells: LiftCell[] = runs.map(([row, column, columns]) => ({ x: 40 + column * WIDTH, y: 40 + row * HEIGHT, width: columns * WIDTH, height: HEIGHT, bead: WIDTH }))
    drawLift(context as DrawingContext, joinedUpright(cells, true), theme.canvas, SCALE)
    for (const [row, column, columns] of runs) {
      for (let each = column; each < column + columns; each += 1) {
        drawFlatBead(context as DrawingContext, { x: 40 + each * WIDTH, y: 40 + row * HEIGHT, size: WIDTH, width: WIDTH, height: HEIGHT, cornerRadius: WIDTH / 2, color: '#e63746', dimmed: false, deviceScale: SCALE, theme })
      }
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return (x, y) => {
      const index = (Math.round(y * SCALE) * canvas.width + Math.round(x * SCALE)) * 4
      return hex([data[index]!, data[index + 1]!, data[index + 2]!])
    }
  }

  it('makes a single bead a pill: its contour has no square corner, and the ground is round it', () => {
    const pixel = roundPiece([[0, 0, 1]])
    // The pill's top end is a half circle: past it, at the corner of the box it stands in, only the Canvas shows.
    // The shadow reaches a little round it, so what shows is not the piece's, whichever shade it is.
    for (const [x, y] of [[37, 37], [63, 37], [37, 71], [63, 71]] as const) expect([look.ground, look.contour]).not.toContain(pixel(x, y))
    // Beside the middle of its side, the ground, and the line past it.
    expect(pixel(38, 54)).toBe(look.ground)
    expect(pixel(36.9, 54)).toBe(look.contour)
  })

  it('shows the ground, and nothing else, in the star between four round beads, in every row of a small piece', () => {
    const pixel = roundPiece([[0, 0, 3], [1, 0, 3], [2, 0, 3]])
    for (const [column, row] of [[1, 1], [2, 1], [1, 2], [2, 2]]) expect(pixel(40 + column * WIDTH, 40 + row * HEIGHT)).toBe(look.ground)
    // Between two beads of a row, mid-height, the gap is the same: no cell of its own color, no Canvas, no tile.
    expect(pixel(40 + WIDTH, 40 + HEIGHT / 2)).toBe(look.ground)
    expect(pixel(40 + 2 * WIDTH, 40 + 1.5 * HEIGHT)).toBe(look.ground)
  })

  it('keeps a hole of one bead with its own line', () => {
    const pixel = roundPiece([[0, 0, 3], [1, 0, 1], [1, 2, 1], [2, 0, 3]])
    const [left, middle] = [40 + WIDTH, 40 + 1.5 * HEIGHT]
    // Inside the hole: past the ground, the contour's line runs 2.25 to 3.5 px in from the neighbours' cells.
    expect(pixel(left + 2.9, middle)).toBe(look.contour)
    expect([look.ground, look.contour]).not.toContain(pixel(left + WIDTH / 2, middle))
  })

  it('rounds the inner corner where a row reaches past the row under it, with nothing left square', () => {
    const pixel = roundPiece([[0, 0, 4], [1, 1, 2]])
    // The contour's corner is at the short row's left edge less 3.5, under the long row less 3.5 again; one px into the
    // empty quarter, the fillet's corner square is filled, where a square corner would leave the Canvas.
    const [cornerX, cornerY] = [40 + WIDTH - 3.5, 40 + HEIGHT + 3.5]
    expect(pixel(cornerX - 0.8, cornerY + 0.8)).toBe(look.contour)
    // And further in, past the fillet, there is none of the piece: only the shadow.
    expect([look.ground, look.contour]).not.toContain(pixel(cornerX - 5, cornerY + 5))
  })
})
