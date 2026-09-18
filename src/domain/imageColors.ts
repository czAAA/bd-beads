import { PALETTE } from './palette'

/**
 * The colors a Convert image (ticket 58) takes out of a picture: how they are reduced to a count a weaver can
 * actually buy, and the one case where an extracted color is replaced by a Palette color instead of kept exactly.
 *
 * Deliberately no dithering (ticket 58 decision) and deliberately no wholesale snapping to the Palette (ADR 0011):
 * the Palette is a painting convenience, not a procurement list, so a picture's own colors are what the Pattern gets.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

function channelHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0')
}

/** The `#rrggbb` a grid cell stores, lowercase — the same shape PALETTE's own hexes are written in. */
export function toHex({ r, g, b }: Rgb): string {
  return `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`
}

export function fromHex(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16)
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}

/**
 * Straight-line distance between two colors in RGB. Not a perceptual color space — this app's own pragmatism (a
 * Pattern cell is a plain hex, and every other color decision here is made on hexes) — which is good enough for the
 * one judgement it is used for: "are these two the same color as far as an eye can tell".
 */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

/**
 * How close an extracted color has to be to a Palette color to become it (ADR 0011's near-exact snapping). 10 in
 * RGB is under 6 units per channel if the difference is spread evenly — two flat patches that far apart are
 * indistinguishable side by side, and a picture's "pure" red landing a unit or two off the Palette's red would
 * otherwise behave as a stranger everywhere in the app (its own Bead quantities row, its own swatch).
 *
 * The distance alone is not what keeps snapping from merging two colors a picture kept apart, though: two extracted
 * colors can both sit inside one Palette color's radius (say #ffffff and #fbfbfb, 7 apart, both within 10 of the
 * Palette's white). Collapsing those would be exactly the wholesale quantization ADR 0011 rejects, so
 * resolveImageColors refuses to snap either of them — see snapCompetition below.
 */
export const PALETTE_SNAP_DISTANCE = 10

/** The closest of `colors` to `hex`, or undefined when there are none to choose from. */
export function nearestColor(colors: readonly string[], hex: string): string | undefined {
  const target = fromHex(hex)
  let best: string | undefined
  let bestDistance = Infinity

  for (const candidate of colors) {
    const distance = colorDistance(target, fromHex(candidate))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }

  return best
}

/**
 * The Palette color `hex` is imperceptibly close to (see PALETTE_SNAP_DISTANCE), or undefined when it is near none.
 * The *nearest* one, not merely the first in range, so the answer doesn't depend on the Palette's own order.
 */
export function nearPaletteColor(hex: string): string | undefined {
  const nearest = nearestColor(
    PALETTE.map((color) => color.hex),
    hex,
  )
  return nearest && colorDistance(fromHex(hex), fromHex(nearest)) <= PALETTE_SNAP_DISTANCE
    ? nearest
    : undefined
}

/** A Palette color when `hex` is imperceptibly close to one, otherwise `hex` untouched. */
export function snapToPalette(hex: string): string {
  return nearPaletteColor(hex) ?? hex
}

/** One color of a picture and how many cells sampled it, the unit median cut works in. */
interface WeightedColor {
  hex: string
  rgb: Rgb
  count: number
}

type Channel = keyof Rgb

const CHANNELS: readonly Channel[] = ['r', 'g', 'b']

/** How far a box's colors spread along one channel. */
function channelRange(box: readonly WeightedColor[], channel: Channel): number {
  let min = Infinity
  let max = -Infinity
  for (const color of box) {
    min = Math.min(min, color.rgb[channel])
    max = Math.max(max, color.rgb[channel])
  }
  return max - min
}

/** The channel a box spreads widest along — the one median cut splits it on. */
function widestChannel(box: readonly WeightedColor[]): Channel {
  return CHANNELS.reduce((widest, channel) =>
    channelRange(box, channel) > channelRange(box, widest) ? channel : widest,
  )
}

/**
 * Splits a box in two at the point half its cells fall either side of, along the channel it spreads widest on — the
 * "median" in median cut, weighted by cell count so a color covering most of the picture pulls the split towards
 * itself rather than counting the same as a stray single bead.
 */
function splitBox(box: readonly WeightedColor[]): [WeightedColor[], WeightedColor[]] {
  const channel = widestChannel(box)
  const sorted = [...box].sort((a, b) => a.rgb[channel] - b.rgb[channel])
  const total = sorted.reduce((sum, color) => sum + color.count, 0)

  let taken = 0
  let at = 0
  while (at < sorted.length - 1 && taken + sorted[at]!.count <= total / 2) {
    taken += sorted[at]!.count
    at += 1
  }
  // Both halves have to hold something, or the split hasn't reduced anything.
  const cut = Math.min(Math.max(at, 1), sorted.length - 1)

  return [sorted.slice(0, cut), sorted.slice(cut)]
}

/** The one color that stands in for a box: its cell-weighted average, so it lands where most of the picture is. */
function representative(box: readonly WeightedColor[]): Rgb {
  const total = box.reduce((sum, color) => sum + color.count, 0)
  const sum = box.reduce(
    (totals, color) => ({
      r: totals.r + color.rgb.r * color.count,
      g: totals.g + color.rgb.g * color.count,
      b: totals.b + color.rgb.b * color.count,
    }),
    { r: 0, g: 0, b: 0 },
  )

  return { r: sum.r / total, g: sum.g / total, b: sum.b / total }
}

/**
 * Median cut down to at most `maxColors` boxes: repeatedly split whichever box still spreads widest, until the count
 * is reached or nothing is left to split (every remaining box holds one color). Chosen over k-means because it
 * terminates in a fixed number of steps with no starting guess to get unlucky with, and over a fixed octree because
 * it adapts to where a picture's colors actually sit — which matters most on the flat artwork this feature targets,
 * where a handful of colors may be crowded into one corner of the cube.
 */
function medianCut(colors: WeightedColor[], maxColors: number): WeightedColor[][] {
  let boxes: WeightedColor[][] = [colors]

  while (boxes.length < maxColors) {
    const splittable = boxes.filter((box) => box.length > 1)
    if (splittable.length === 0) {
      return boxes
    }

    const widest = splittable.reduce((best, box) =>
      channelRange(box, widestChannel(box)) > channelRange(best, widestChannel(best)) ? box : best,
    )
    boxes = boxes.flatMap((box) => (box === widest ? splitBox(box) : [box]))
  }

  return boxes
}

export interface ResolvedImageColors {
  /** Every sampled hex mapped to the Image color it became — the same hex when nothing was reduced or snapped. */
  mapping: Map<string, string>
  /** The distinct Image colors, most of the picture first. */
  colors: string[]
}

/** The color a box of the reduction stands for, before the Palette is offered a chance to claim it. */
function boxColor(box: readonly WeightedColor[]): string {
  // A box of one is that color itself, untouched — this is what makes an already-small picture lossless.
  return box.length === 1 ? box[0]!.hex : toHex(representative(box))
}

/**
 * Which Palette colors more than one of these colors would snap to. Those snaps are refused: snapping both would
 * merge two colors the picture kept apart, which is the wholesale quantization ADR 0011 rejects, and snapping one of
 * them would be a coin toss between two equally near-exact matches. Both keep their own exact color instead.
 */
function snapCompetition(colors: readonly string[]): Set<string> {
  const claimants = new Map<string, number>()
  for (const hex of colors) {
    const near = nearPaletteColor(hex)
    if (near !== undefined) {
      claimants.set(near, (claimants.get(near) ?? 0) + 1)
    }
  }

  return new Set([...claimants].filter(([, count]) => count > 1).map(([hex]) => hex))
}

/**
 * The Image colors (CONTEXT.md, ADR 0011) for a picture's sampled cell colors, and what each sampled color became.
 *
 * A picture already holding at most `maxColors` distinct colors is used exactly: no quantization at all, which is the
 * near-lossless case the flat artwork this feature targets falls into. A busier one is reduced by median cut. Either
 * way each resulting color is then offered to the Palette for near-exact snapping, except where two of them are near
 * the same Palette color (see snapCompetition) — snapping can never be what merges two colors.
 *
 * Ordered by how much of the picture each color covers, so the Colors group leads with the ones worth reaching for.
 */
export function resolveImageColors(
  counts: ReadonlyMap<string, number>,
  maxColors: number,
): ResolvedImageColors {
  const sampled: WeightedColor[] = [...counts].map(([hex, count]) => ({ hex, rgb: fromHex(hex), count }))
  if (sampled.length === 0) {
    return { mapping: new Map(), colors: [] }
  }

  const boxes =
    sampled.length <= maxColors ? sampled.map((color) => [color]) : medianCut(sampled, maxColors)

  const contested = snapCompetition(boxes.map(boxColor))
  const mapping = new Map<string, string>()
  const coverage = new Map<string, number>()

  for (const box of boxes) {
    const own = boxColor(box)
    const near = nearPaletteColor(own)
    const resolved = near !== undefined && !contested.has(near) ? near : own
    for (const color of box) {
      mapping.set(color.hex, resolved)
      coverage.set(resolved, (coverage.get(resolved) ?? 0) + color.count)
    }
  }

  const colors = [...coverage].sort(([aHex, aCount], [bHex, bCount]) =>
    bCount === aCount ? aHex.localeCompare(bHex) : bCount - aCount,
  )

  return { mapping, colors: colors.map(([hex]) => hex) }
}
