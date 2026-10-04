import { isOffsetTechnique, type Technique } from '../domain/grid'
import type { ProjectTheme } from './beadLook'

/**
 * A coarse look for a block of beads that is being moved (ticket 122, ADR 0018): one flat pixel of color per bead,
 * stretched over the surface in a single blit, in place of drawing every bead. Drawing a rounded bead is a blit of its
 * own, thousands of them on every move of the Convert image framing drag, which is what keeps that drag under the
 * floor of 30 fps in peyote and at 250 × 250. This costs the same however many beads there are.
 *
 * It keeps where the beads are (the half-bead shift of peyote and brick stitch rows included) and what color each is;
 * it gives up the rim, the rounding and brick stitch's seam. It is only ever the look while the picture is moving:
 * at rest the beads are drawn by the Project renderer, so the Project the frame holds is seen exactly as created.
 */

/** How many beads are worth drawing for real on every move: a square bead is one unit of cost, a rounded one three (measured, ticket 122). */
const DRAWING_BUDGET = 15_000
const COST_PER_BEAD: Record<Technique, number> = { loom: 1, brick: 1, peyote: 3 }

/** Whether a block of this many beads is too many to draw as beads on every move of a drag. */
export function usesDraftLook(technique: Technique, beadCount: number): boolean {
  return beadCount * COST_PER_BEAD[technique] > DRAWING_BUDGET
}

export interface DraftImage {
  width: number
  height: number
  /** RGBA, row by row. */
  data: Uint8ClampedArray<ArrayBuffer>
}

const rgbOf = new Map<string, readonly [number, number, number]>()

/** A `#rrggbb` (or `#rgb`) as its channels, remembered: a picture has few colors and a drag asks for every bead's on every move. */
function channels(color: string): readonly [number, number, number] {
  let known = rgbOf.get(color)
  if (!known) {
    const digits = color.length === 4 ? [...color.slice(1)].map((digit) => digit + digit).join('') : color.slice(1)
    known = [0, 2, 4].map((start) => Number.parseInt(digits.slice(start, start + 2), 16)) as [number, number, number]
    rgbOf.set(color, known)
  }
  return known
}

/**
 * The beads as an image: a pixel per bead, or in peyote and brick stitch two pixels per bead with every other row
 * starting a pixel in, which puts those rows half a bead to the side of the ones above and below. `colors` is one entry
 * per bead, row by row; undefined is an empty bead.
 */
export function draftImage(technique: Technique, columns: number, rows: number, colors: readonly (string | undefined)[], theme: ProjectTheme): DraftImage {
  const offset = isOffsetTechnique(technique)
  const wide = offset ? 2 : 1
  const width = columns * wide + (offset ? 1 : 0)
  const data = new Uint8ClampedArray(width * rows * 4)
  const [backgroundR, backgroundG, backgroundB] = channels(theme.background)
  for (let at = 0; at < data.length; at += 4) {
    data[at] = backgroundR
    data[at + 1] = backgroundG
    data[at + 2] = backgroundB
    data[at + 3] = 255
  }

  for (let row = 0; row < rows; row += 1) {
    const start = offset && row % 2 === 1 ? 1 : 0
    for (let column = 0; column < columns; column += 1) {
      const [r, g, b] = channels(colors[row * columns + column] ?? theme.emptyBead)
      for (let across = 0; across < wide; across += 1) {
        const at = (row * width + start + column * wide + across) * 4
        data[at] = r
        data[at + 1] = g
        data[at + 2] = b
      }
    }
  }
  return { width, height: rows, data }
}

let scratch: HTMLCanvasElement | undefined

/**
 * Draws the beads in the draft look over the whole of `context`'s canvas, which is sized to the block's extent (in
 * device px, `bitmapWidth` by `bitmapHeight`).
 */
export function renderDraft(
  context: CanvasRenderingContext2D,
  input: {
    technique: Technique
    columns: number
    rows: number
    colors: readonly (string | undefined)[]
    theme: ProjectTheme
    bitmapWidth: number
    bitmapHeight: number
  },
): void {
  const { technique, columns, rows, colors, theme, bitmapWidth, bitmapHeight } = input
  const image = draftImage(technique, columns, rows, colors, theme)

  scratch ??= document.createElement('canvas')
  scratch.width = image.width
  scratch.height = image.height
  const scratchContext = scratch.getContext('2d')
  if (!scratchContext) {
    return
  }
  scratchContext.putImageData(new ImageData(image.data, image.width, image.height), 0, 0)

  context.setTransform(1, 0, 0, 1, 0, 0)
  // Every pixel is a bead's worth of color, stretched as it is: smoothing would blur one bead into the next.
  context.imageSmoothingEnabled = false
  context.drawImage(scratch, 0, 0, image.width, image.height, 0, 0, bitmapWidth, bitmapHeight)
}

