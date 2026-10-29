import { channelsOf, colorDistance, toHex, toOklab, type Rgb } from './color'

/** The colors a Convert image (ticket 58) takes from a picture: reduced to a buyable count with no dithering (ticket
 * 177, ADR 0010); convertColors.ts then matches each to the chosen source. */

/** The closest of `colors` to `hex` by how alike they look (colorDistance), or undefined when there are none to
 * choose from. */
export function nearestColor(colors: readonly string[], hex: string): string | undefined {
  const target = toOklab(channelsOf(hex))
  let best: string | undefined
  let bestDistance = Infinity

  for (const candidate of colors) {
    const distance = colorDistance(target, toOklab(channelsOf(candidate)))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }

  return best
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

/** Splits a box at the cell-count median of its widest channel, so a color covering most of the picture pulls the
 * split towards itself rather than counting like a stray bead. */
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

/** Median cut down to at most `maxColors` boxes by splitting the widest box until done. Over k-means (fixed steps,
 * no unlucky start) and a fixed octree (adapts to where flat artwork's few colors crowd the cube). */
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

/** A picture's colors reduced to a buyable count (ticket 177, ADR 0010), before any snap: the Convert image wizard
 * matches each to its source afterwards, so a remap or an empty survives a change of source (spec 0645). */
export interface ReducedColors {
  /** The colors the reduction kept, each a box's cell-weighted average, most of the picture first. */
  colors: { hex: string; count: number }[]
  /** Every sampled hex to the kept color it became: itself when nothing was reduced. */
  byHex: Map<string, string>
}

/** The color a box of the reduction stands for. */
function boxColor(box: readonly WeightedColor[]): string {
  // A box of one is that color itself, untouched.
  return box.length === 1 ? box[0]!.hex : toHex(representative(box))
}

/** At most `maxColors` colors for sampled cell colors, ordered by coverage. Up to `maxColors` distinct colors skip median
 * cut; two boxes that average to one hex count as one color. */
export function reducePictureColors(counts: ReadonlyMap<string, number>, maxColors: number): ReducedColors {
  const sampled: WeightedColor[] = [...counts].map(([hex, count]) => ({ hex, rgb: channelsOf(hex), count }))
  const boxes = sampled.length === 0 ? [] : sampled.length <= maxColors ? sampled.map((color) => [color]) : medianCut(sampled, maxColors)

  const byHex = new Map<string, string>()
  const coverage = new Map<string, number>()
  for (const box of boxes) {
    const kept = boxColor(box)
    for (const color of box) {
      byHex.set(color.hex, kept)
      coverage.set(kept, (coverage.get(kept) ?? 0) + color.count)
    }
  }

  const colors = [...coverage]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => (b.count === a.count ? a.hex.localeCompare(b.hex) : b.count - a.count))
  return { colors, byHex }
}
