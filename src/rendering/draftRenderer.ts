import { channelsOf } from '../domain/color'
import { describeWeave, draftCost, type Technique, type TechniqueSettings } from '../domain/weave'
import type { WeaveGeometry } from '../domain/weaveGeometry'
import type { ProjectTheme } from './beadLook'

// A coarse look for a block of beads being moved (ticket 122, ADR 0018): one flat pixel per bead stretched in a single
// blit, instead of a blit per rounded bead, which kept the Convert image framing drag under 30 fps (peyote, 250 x 250).
// Keeps positions and colors, drops rim and rounding; only while moving, at rest the Project renderer draws.

/** How many square beads are worth drawing for real on every move; a Technique's entry says what its bead costs. */
const DRAWING_BUDGET = 15_000

/** Whether a block of this many beads is too many to draw as beads on every move of a drag. */
export function usesDraftLook(technique: Technique, beadCount: number): boolean {
  return beadCount * draftCost(technique) > DRAWING_BUDGET
}

interface DraftImage {
  width: number
  height: number
  /** RGBA, row by row. */
  data: Uint8ClampedArray<ArrayBuffer>
}

const rgbOf = new Map<string, readonly [number, number, number]>()

/** A `#rrggbb` (or `#rgb`) as its channels, remembered: a picture has few colors and a drag asks for every bead's on
 * every move. */
function channels(color: string): readonly [number, number, number] {
  let known = rgbOf.get(color)
  if (!known) {
    const { r, g, b } = channelsOf(color)
    known = [r, g, b]
    rgbOf.set(color, known)
  }
  return known
}

/** The most pixels a bead takes across in the draft: a row shift finer than this many parts of a bead is drawn to the
 * nearest of them. */
const MAX_PIXELS_PER_BEAD = 8

/** How close to a whole number of pixels a shift must come to count as one: a third times three is not exactly 1. */
const WHOLE_PIXEL_TOLERANCE = 1e-9

/** How many pixels a bead takes across so its row shift is a whole number of them: 1 where rows don't shift, 2 for half
 * a bead, 3 for a third. */
function pixelsPerBead(shift: number): number {
  for (let wide = 1; wide < MAX_PIXELS_PER_BEAD; wide += 1) {
    if (Math.abs(shift * wide - Math.round(shift * wide)) < WHOLE_PIXEL_TOLERANCE) {
      return wide
    }
  }
  return MAX_PIXELS_PER_BEAD
}

/** The beads as an image at the description's own row shift: as many pixels a bead as put a shifted row a whole number
 * of them in (one for loom, two for peyote). `colors` is one entry per bead, row by row; undefined is empty.
 * @internal Its test reads the pixels on their own. */
export function draftImage(geometry: Pick<WeaveGeometry, 'shift' | 'rowOffset'>, columns: number, rows: number, colors: readonly (string | undefined)[], theme: ProjectTheme): DraftImage {
  const wide = pixelsPerBead(geometry.shift)
  const width = columns * wide + Math.round(geometry.shift * wide)
  const data = new Uint8ClampedArray(width * rows * 4)
  const [backgroundR, backgroundG, backgroundB] = channels(theme.background)
  for (let at = 0; at < data.length; at += 4) {
    data[at] = backgroundR
    data[at + 1] = backgroundG
    data[at + 2] = backgroundB
    data[at + 3] = 255
  }

  for (let row = 0; row < rows; row += 1) {
    const start = Math.round(geometry.rowOffset(row, wide))
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

/** Draws the beads in the draft look over all of `context`'s canvas, sized to the block's extent (`bitmapWidth` ×
 * `bitmapHeight` device px). */
export function renderDraft(
  context: CanvasRenderingContext2D,
  input: {
    technique: Technique
    techniqueSettings?: TechniqueSettings
    columns: number
    rows: number
    colors: readonly (string | undefined)[]
    theme: ProjectTheme
    bitmapWidth: number
    bitmapHeight: number
  },
): void {
  const { technique, techniqueSettings, columns, rows, colors, theme, bitmapWidth, bitmapHeight } = input
  const image = draftImage(describeWeave({ technique, techniqueSettings }), columns, rows, colors, theme)

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

