import { channelsOf, mix, toHex } from '../domain/color'
import type { DrawingContext } from './beadLook'
import type { Region } from './surfaceView'
import { tileColorOf } from './tonalTiles'

// Grid focus (ticket 1002, BeadBoard card, Canvas look): the gap between tonal tiles keeps its full step near the work
// and is calmer far from it. Only the gap moves: it is a field laid under the tiles, eased by distance, never a blur
// (iPad Safari has no canvas `filter`). The tiles are drawn over it unchanged, so the Canvas keeps one tone.

/** How far toward the tile's color the gap goes far from the work: about 3.8 L* left of the tile's 6.5, 1.11:1. */
const FAR_GAP_TOWARD_TILE = 0.42

/** Within this many grid px of the work the gap is full: the work's box grown by 96px, softened 36px either way. */
const NEAR_PX = 96 - 36
/** From this many grid px out the gap is the far one. */
const FAR_PX = 96 + 36

/** How many samples of the field the easing spans at least, so the field drawn up to the screen stays smooth. */
const SAMPLES_ACROSS_EASING = 6
/** The widest a sample is, in device px: the field is low in detail, so a coarse one costs little to make. */
const MOST_SAMPLE_PX = 16
/** The most samples a field holds, so a zoom far out, where the easing is a few px, still makes it in a few ms. */
const MOST_SAMPLES = 40_000

const farGaps = new Map<string, string>()

/** The gap far from the work on a Background: the Background moved FAR_GAP_TOWARD_TILE of the way to its tile
 * (Night `#202020` gives `#262626`, Studio `#fafafa` gives `#f2f2f2`). Never the tile, so the grid shows everywhere. */
export function farGapOf(background: string): string {
  let gap = farGaps.get(background)
  if (gap === undefined) {
    gap = toHex(mix(channelsOf(background), channelsOf(tileColorOf(background)), FAR_GAP_TOWARD_TILE))
    farGaps.set(background, gap)
  }
  return gap
}

/** How much of the way to the far gap a point `distance` grid px off the work is: 0 within NEAR_PX, 1 from FAR_PX,
 * easing smoothly between.
 * @internal Tests check the easing's reach. */
export function farShareAt(distance: number): number {
  const along = Math.min(1, Math.max(0, (distance - NEAR_PX) / (FAR_PX - NEAR_PX)))
  return along * along * (3 - 2 * along)
}

/** The far share of each sample of a field `columns` by `rows`, one every `step` device px, round boxes in device px
 * (a grid px is `scale` of them): the least any box gives, so each box has its own near area.
 * @internal Tests check the field's easing and the boxes' own near areas. */
export function farShares(boxes: readonly Region[], columns: number, rows: number, step: number, scale: number): Float32Array {
  const shares = new Float32Array(columns * rows).fill(1)
  const [near, far] = [(NEAR_PX * scale) ** 2, (FAR_PX * scale) ** 2]
  const reach = FAR_PX * scale
  for (const box of boxes) {
    const [left, top, right, bottom] = [box.x, box.y, box.x + box.width, box.y + box.height]
    const [first, last] = [Math.max(0, Math.floor((left - reach) / step)), Math.min(columns - 1, Math.ceil((right + reach) / step))]
    const [upper, lower] = [Math.max(0, Math.floor((top - reach) / step)), Math.min(rows - 1, Math.ceil((bottom + reach) / step))]
    for (let row = upper; row <= lower; row += 1) {
      const y = row * step
      const dy = Math.max(top - y, 0, y - bottom)
      for (let column = first; column <= last; column += 1) {
        const x = column * step
        const dx = Math.max(left - x, 0, x - right)
        const [at, distance] = [row * columns + column, dx * dx + dy * dy]
        if (shares[at] === 0 || distance >= far) continue
        const share = distance <= near ? 0 : farShareAt(Math.sqrt(distance) / scale)
        if (share < shares[at]!) shares[at] = share
      }
    }
  }
  return shares
}

/** What the gap's easing is drawn from: the work's boxes in grid px, how grid px map to the surface, and the
 * Background. */
export interface GapEasingInput {
  /** The work's boxes in grid px (workBoxes.ts); none leaves the gap full everywhere. */
  boxes: readonly Region[]
  /** Grid px to the surface's px (`gridToRegion`): a quarter turn, scaled and moved. */
  toRegion: readonly [number, number, number, number, number, number]
  /** Device px per surface px. */
  pixelRatio: number
  /** The surface's size in its px. */
  width: number
  height: number
  background: string
}

/** How many samples a block of the field spans each way: a block all near is left alone and one all far filled flat, so
 * only the blocks the easing crosses are scaled up, which costs what they cover. */
const BLOCK = 8

/** A block's kind: all near, all far, or eased across. */
type BlockKind = 'near' | 'far' | 'eased'

/** A field made for a view: its bitmap, its blocks' kinds row by row, where its first sample lies and how far apart
 * samples are, in device px of the grid unmoved (the view's quarter turn and scale, not its scroll). */
interface Field {
  key: string
  bitmap: HTMLCanvasElement
  blocks: BlockKind[][]
  left: number
  top: number
  step: number
  far: string
}

let kept: Field | undefined

/** The kind of every block, from its first sample to the next block's first, so blocks meet on a sample. */
function blockKinds(shares: Float32Array, columns: number, rows: number): BlockKind[][] {
  const kinds: BlockKind[][] = []
  for (let upper = 0; upper < rows - 1; upper += BLOCK) {
    const row: BlockKind[] = []
    for (let first = 0; first < columns - 1; first += BLOCK) {
      let [near, far] = [true, true]
      for (let y = upper; y <= Math.min(rows - 1, upper + BLOCK); y += 1) {
        for (let x = first; x <= Math.min(columns - 1, first + BLOCK); x += 1) {
          const share = shares[y * columns + x]!
          near &&= share === 0
          far &&= share === 1
        }
      }
      row.push(near ? 'near' : far ? 'far' : 'eased')
    }
    kinds.push(row)
  }
  return kinds
}

/** The field round a view: a bitmap of the far gap at each sample's share, and its blocks. It reaches half a view past
 * it on every side and lies on the grid, not the screen, so a pan or a band redrawn after an edit reuses it until the
 * view leaves it. Undefined without a canvas to make it on. */
function fieldOf({ boxes, toRegion, pixelRatio, width: across, height: down, background }: GapEasingInput): Field | undefined {
  const [a, b, c, d, e, f] = toRegion.map((value) => value * pixelRatio) as [number, number, number, number, number, number]
  const [width, height] = [across * pixelRatio, down * pixelRatio]
  const key = [width, height, background, a, b, c, d, ...boxes.flatMap(({ x, y, width: w, height: h }) => [x, y, w, h])].join('|')
  const covers = (field: Field) => field.left <= -e - field.step && field.top <= -f - field.step
    && field.left + (field.bitmap.width - BLOCK - 2) * field.step >= width - e && field.top + (field.bitmap.height - BLOCK - 2) * field.step >= height - f
  if (kept?.key === key && covers(kept)) return kept
  if (typeof document === 'undefined') return undefined
  const scale = Math.hypot(a, b)
  const fine = Math.min(MOST_SAMPLE_PX, Math.max(1, Math.floor(((FAR_PX - NEAR_PX) * scale) / SAMPLES_ACROSS_EASING)))
  const step = Math.max(fine, Math.ceil(Math.sqrt((4 * width * height) / MOST_SAMPLES)))
  // On a block's corner, so the blocks under the view are whole ones.
  const [left, top] = [Math.floor((-e - width / 2) / (step * BLOCK)) * step * BLOCK, Math.floor((-f - height / 2) / (step * BLOCK)) * step * BLOCK]
  const [columns, rows] = [Math.ceil((2 * width) / step) + 2 * BLOCK + 3, Math.ceil((2 * height) / step) + 2 * BLOCK + 3]
  // A quarter turn keeps a box upright, so its two corners give its box, here from the field's first sample.
  const inField = boxes.map(({ x, y, width: w, height: h }) => {
    const [x0, y0, x1, y1] = [a * x + c * y, b * x + d * y, a * (x + w) + c * (y + h), b * (x + w) + d * (y + h)]
    return { x: Math.min(x0, x1) - left, y: Math.min(y0, y1) - top, width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }
  })
  const shares = farShares(inField, columns, rows, step, scale)
  const bitmap = document.createElement('canvas')
  bitmap.width = columns
  bitmap.height = rows
  const own = bitmap.getContext('2d')
  if (!own) return undefined
  const image = own.createImageData(columns, rows)
  const far = farGapOf(background)
  const { r, g, b: blue } = channelsOf(far)
  const { data } = image
  for (let at = 0; at < shares.length; at += 1) {
    data[at * 4] = r
    data[at * 4 + 1] = g
    data[at * 4 + 2] = blue
    data[at * 4 + 3] = Math.round(shares[at]! * 255)
  }
  own.putImageData(image, 0, 0)
  kept = { key, bitmap, blocks: blockKinds(shares, columns, rows), left, top, step, far }
  return kept
}

/** Lays the gap's easing over the surface's Background, under the tiles (Grid focus on): the far gap away from the
 * work, eased to the Background near it. Drawn in device px from a whole pixel, so blocks meet with no seam; a run of
 * far blocks is one fill, and an eased block its samples scaled up smoothly, each on its point. */
export function drawGapEasing(context: DrawingContext, input: GapEasingInput): void {
  if (!input.boxes.length) return
  const field = fieldOf(input)
  if (!field) return
  const { bitmap, blocks, step, far } = field
  const size = BLOCK * step
  const [x0, y0] = [Math.round(input.toRegion[4] * input.pixelRatio) + field.left, Math.round(input.toRegion[5] * input.pixelRatio) + field.top]
  const [width, height] = [input.width * input.pixelRatio, input.height * input.pixelRatio]
  const [first, last] = [Math.max(0, Math.floor(-x0 / size)), Math.min(blocks[0]!.length - 1, Math.floor((width - x0) / size))]
  const [upper, lower] = [Math.max(0, Math.floor(-y0 / size)), Math.min(blocks.length - 1, Math.floor((height - y0) / size))]
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.imageSmoothingEnabled = true
  context.fillStyle = far
  for (let row = upper; row <= lower; row += 1) {
    let run: number | undefined
    const y = y0 + row * size
    for (let column = first; column <= last + 1; column += 1) {
      const kind = column <= last ? blocks[row]![column] : undefined
      if (kind === 'far') {
        run ??= column
        continue
      }
      if (run !== undefined) context.fillRect(x0 + run * size, y, (column - run) * size, size)
      run = undefined
      if (kind === 'eased') context.drawImage(bitmap, column * BLOCK + 0.5, row * BLOCK + 0.5, BLOCK, BLOCK, x0 + column * size, y, size, size)
    }
  }
  context.restore()
}
