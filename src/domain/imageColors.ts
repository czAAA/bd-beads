import { channelsOf, colorDistance, toHex, toOklab, type Oklab, type Rgb } from './color'

/** The colors a Convert image (ticket 58) takes from a picture: reduced to a buyable count with no dithering (ticket
 * 177, ADR 0010); convertColors.ts then matches each to the chosen source. */

/** The least distance (ΔEOK, colorDistance) between two colors a reduced picture delivers (ticket 0890), before the
 * match to the source and after it. 0.09 is where the benchmark portrait's graded dark ground first became one black,
 * its four photos' mean ΔE up by 0.4 (converter benchmark, 02-comparison.md). */
export const LEAST_COLOR_DISTANCE = 0.09

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

/** A box with how far it spreads along its widest channel, worked out once: the Colors slider asks for thousands of
 * boxes from a photo (ticket 0747), and only the two halves of a split change. */
interface MeasuredBox {
  colors: WeightedColor[]
  spread: number
}

function measured(colors: WeightedColor[]): MeasuredBox {
  return { colors, spread: colors.length > 1 ? channelRange(colors, widestChannel(colors)) : -1 }
}

/** Median cut down to at most `maxColors` boxes by splitting the widest box until done. Over k-means (fixed steps,
 * no unlucky start) and a fixed octree (adapts to where flat artwork's few colors crowd the cube). */
function medianCut(colors: WeightedColor[], maxColors: number): WeightedColor[][] {
  const boxes: MeasuredBox[] = [measured(colors)]

  while (boxes.length < maxColors) {
    let widest = 0
    for (let at = 1; at < boxes.length; at += 1) {
      if (boxes[at]!.spread > boxes[widest]!.spread) widest = at
    }
    // A box of one color cannot split: a spread of -1 says so.
    if (boxes[widest]!.spread < 0) break

    const [left, right] = splitBox(boxes[widest]!.colors)
    boxes[widest] = measured(left)
    boxes.push(measured(right))
  }

  return boxes.map((box) => box.colors)
}

/** How many median-cut boxes a reduction picks its colors from, per color asked: enough that a small region of the
 * picture has a box of its own, few enough to stay fast on the Colors slider (ticket 0747). */
const CANDIDATES_PER_COLOR = 4
/** The fewest boxes it picks from, so a small count asked still sees the picture's small regions. */
const LEAST_CANDIDATES = 64

/** A median-cut box as a color the reduction may keep: where it lies and how much of the picture it covers. */
interface Candidate {
  lab: Oklab
  count: number
}

/** The candidates the reduction keeps (ticket 0890): the biggest first, then each time the one that covers most times how
 * far it is from the nearest kept, so a noisy ground spends one color and a small figure its own; none within the least
 * distance of a kept one. */
function chooseByDifference(candidates: readonly Candidate[], maxColors: number): Oklab[] {
  const nearest = candidates.map(() => Infinity)
  const chosen: Oklab[] = []
  while (chosen.length < maxColors) {
    let best = -1
    let bestScore = 0
    candidates.forEach((candidate, at) => {
      // Capped at 1 (black to white), so the first pick, near nothing yet, is the biggest.
      const score = nearest[at]! < LEAST_COLOR_DISTANCE ? 0 : candidate.count * Math.min(nearest[at]!, 1)
      if (score > bestScore) {
        best = at
        bestScore = score
      }
    })
    if (best < 0) break
    const lab = candidates[best]!.lab
    chosen.push(lab)
    candidates.forEach((candidate, at) => {
      nearest[at] = Math.min(nearest[at]!, colorDistance(candidate.lab, lab))
    })
  }
  return chosen
}

/** The index of the closest of `colors` to `lab`. */
function closest(colors: readonly Oklab[], lab: Oklab): number {
  let best = 0
  let bestDistance = Infinity
  colors.forEach((color, at) => {
    const distance = colorDistance(color, lab)
    if (distance < bestDistance) {
      best = at
      bestDistance = distance
    }
  })
  return best
}

/** The sampled colors grouped round the colors chosen by difference, each joining its nearest (ticket 0890): a group
 * gathers one region of the picture, not a slice of the cube cut by cell count, so two regions don't blend. */
function groupByDifference(sampled: readonly WeightedColor[], maxColors: number): WeightedColor[][] {
  const boxes = medianCut([...sampled], Math.min(sampled.length, Math.max(maxColors * CANDIDATES_PER_COLOR, LEAST_CANDIDATES)))
  const candidates = boxes.map((box) => ({ lab: toOklab(representative(box)), count: size(box) }))
  const chosen = chooseByDifference(candidates, maxColors)
  const groups: WeightedColor[][] = chosen.map(() => [])
  for (const color of sampled) groups[closest(chosen, toOklab(color.rgb))]!.push(color)
  return joinNear(groups.filter((group) => group.length > 0))
}

/** The groups with any two whose colors ended closer than the least distance joined, the smaller into the bigger, until
 * none are: a join moves the joined color, so it is measured again. */
function joinNear(groups: WeightedColor[][]): WeightedColor[][] {
  const kept = groups.map((colors) => ({ colors, lab: toOklab(channelsOf(boxColor(colors))) }))
  for (;;) {
    kept.sort((a, b) => size(b.colors) - size(a.colors))
    const small = kept.findIndex((group, at) => kept.slice(0, at).some((big) => colorDistance(big.lab, group.lab) < LEAST_COLOR_DISTANCE))
    if (small < 0) return kept.map((group) => group.colors)
    const [joining] = kept.splice(small, 1)
    const big = kept.find((group) => colorDistance(group.lab, joining!.lab) < LEAST_COLOR_DISTANCE)!
    big.colors = [...big.colors, ...joining!.colors]
    big.lab = toOklab(channelsOf(boxColor(big.colors)))
  }
}

/** How many cells a group of sampled colors covers. */
function size(group: readonly WeightedColor[]): number {
  return group.reduce((sum, color) => sum + color.count, 0)
}

/** A picture's colors reduced to a buyable count (ticket 177, ADR 0010), before any snap: the Convert image wizard
 * matches each to its source afterwards, so a remap or an empty survives a change of source (spec 0645). */
export interface ReducedColors {
  /** The colors the reduction kept, each a box's cell-weighted average, most of the picture first. */
  colors: { hex: string; count: number }[]
  /** Every sampled hex to the kept color it became: itself when nothing was reduced. */
  byHex: Map<string, string>
  /** Whether the picture was reduced, so what it delivers keeps the least distance (ticket 0890); a picture with no
   * more colors than asked keeps its own, however alike. */
  keptApart: boolean
}

/** The color a box of the reduction stands for. */
function boxColor(box: readonly WeightedColor[]): string {
  // A box of one is that color itself, untouched.
  return box.length === 1 ? box[0]!.hex : toHex(representative(box))
}

/** At most `maxColors` colors for sampled cell colors, ordered by coverage. Up to `maxColors` distinct colors are kept as
 * they are (flat artwork, pixel art); more are chosen by difference (ticket 0890), never two within the least distance. */
export function reducePictureColors(counts: ReadonlyMap<string, number>, maxColors: number): ReducedColors {
  const sampled: WeightedColor[] = [...counts].map(([hex, count]) => ({ hex, rgb: channelsOf(hex), count }))
  const boxes = sampled.length === 0 ? [] : sampled.length <= maxColors ? sampled.map((color) => [color]) : groupByDifference(sampled, maxColors)

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
  return { colors, byHex, keptApart: sampled.length > maxColors }
}
