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
  /** `rgb` in Oklab, turned once: the reduction measures every sampled color against the seeds many times (ticket 1163). */
  lab: Oklab
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
  // A plain loop: a box can hold every color of a photo (ticket 1163), and this runs for each group of each reduction.
  let total = 0
  let r = 0
  let g = 0
  let b = 0
  for (const color of box) {
    total += color.count
    r += color.rgb.r * color.count
    g += color.rgb.g * color.count
    b += color.rgb.b * color.count
  }
  return { r: r / total, g: g / total, b: b / total }
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

/** Median cut by splitting the widest box (the lowest on a tie) until done. Over k-means (fixed steps, no unlucky
 * start) and a fixed octree (adapts to where flat artwork's few colors crowd the cube). The splits don't depend on
 * how many boxes are wanted, so they are kept: 13 boxes after 12 is one split more (ticket 1163). */
function medianCutter(colors: WeightedColor[]) {
  const boxes: MeasuredBox[] = [measured(colors)]
  /** Each split made: the place the left half took and the right half pushed at the end. */
  const steps: { at: number; left: WeightedColor[]; right: WeightedColor[] }[] = []
  let spent = false

  function split(): void {
    let widest = 0
    for (let at = 1; at < boxes.length; at += 1) {
      if (boxes[at]!.spread > boxes[widest]!.spread) widest = at
    }
    // A box of one color cannot split: a spread of -1 says so.
    if (boxes[widest]!.spread < 0) {
      spent = true
      return
    }
    const [left, right] = splitBox(boxes[widest]!.colors)
    boxes[widest] = measured(left)
    boxes.push(measured(right))
    steps.push({ at: widest, left, right })
  }

  /** The boxes, at most `maxColors` of them: fewer when every box is down to one color. */
  return (maxColors: number): WeightedColor[][] => {
    while (!spent && boxes.length < maxColors) split()
    const result = [colors]
    for (const step of steps.slice(0, Math.max(0, maxColors - 1))) {
      result[step.at] = step.left
      result.push(step.right)
    }
    return result
  }
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
function chooseByDifference(candidates: readonly Candidate[], maxColors: number, kept: readonly Oklab[] = []): Oklab[] {
  const chosen: Oklab[] = [...kept]
  // Squared, ticket 1163: the least of the roots is the root of the least, so the picks are the same without a root per
  // candidate per color kept.
  const nearest = candidates.map((candidate) => {
    let least = Infinity
    for (const lab of chosen) least = Math.min(least, distanceSquared(candidate.lab, lab))
    return least
  })
  while (chosen.length < maxColors) {
    let best = -1
    let bestScore = 0
    candidates.forEach((candidate, at) => {
      // Capped at 1 (black to white), so the first pick, near nothing yet, is the biggest.
      const distance = Math.sqrt(nearest[at]!)
      const score = distance < LEAST_COLOR_DISTANCE ? 0 : candidate.count * Math.min(distance, 1)
      if (score > bestScore) {
        best = at
        bestScore = score
      }
    })
    if (best < 0) break
    const lab = candidates[best]!.lab
    chosen.push(lab)
    for (let at = 0; at < candidates.length; at += 1) {
      nearest[at] = Math.min(nearest[at]!, distanceSquared(candidates[at]!.lab, lab))
    }
  }
  return chosen
}

function distanceSquared(a: Oklab, b: Oklab): number {
  return (a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2
}

/** The index of the closest of `colors` to `lab`. */
function closest(colors: readonly Oklab[], lab: Oklab): number {
  let best = 0
  let bestDistance = Infinity
  for (let at = 0; at < colors.length; at += 1) {
    const distance = distanceSquared(colors[at]!, lab)
    if (distance < bestDistance) {
      best = at
      bestDistance = distance
    }
  }
  return best
}

/** The sampled colors grouped round the colors chosen by difference, each joining its nearest (ticket 0890): a group
 * gathers one region of the picture, not a slice of the cube cut by cell count, so two regions don't blend. */
function groupByDifference(sampled: readonly WeightedColor[], maxColors: number, cut: ReturnType<typeof medianCutter>): WeightedColor[][] {
  const boxes = cut(Math.min(sampled.length, Math.max(maxColors * CANDIDATES_PER_COLOR, LEAST_CANDIDATES)))
  const candidates = boxes.map((box) => ({ lab: toOklab(representative(box)), count: size(box) }))
  return filledUp(sampled, maxColors, groupAround(sampled, chooseByDifference(candidates, maxColors)))
}

/** The sampled colors grouped round `seeds`, each joining its nearest; the groups that end alike joined. */
function groupAround(sampled: readonly WeightedColor[], seeds: readonly Oklab[]): WeightedColor[][] {
  const groups: WeightedColor[][] = seeds.map(() => [])
  for (const color of sampled) groups[closest(seeds, color.lab)]!.push(color)
  return joinNear(groups.filter((group) => group.length > 0))
}

/** The groups with the places a join freed given away (ticket 0892): while fewer than `maxColors` are left, the picture's
 * own color most different from the groups' (at least the least distance from each) seeds one more, and the sampled
 * colors are grouped round them again. Ends at the count asked or when no color is that different; the most groups is kept. */
function filledUp(sampled: readonly WeightedColor[], maxColors: number, first: WeightedColor[][]): WeightedColor[][] {
  const own = sampled.map((color) => ({ lab: color.lab, count: color.count }))
  let best = first
  let groups = first
  for (let round = 0; round < maxColors && groups.length < maxColors; round++) {
    const labs = groups.map((group) => toOklab(channelsOf(boxColor(group))))
    const seeds = chooseByDifference(own, labs.length + 1, labs)
    if (seeds.length === labs.length) break
    groups = groupAround(sampled, seeds)
    if (groups.length > best.length) best = groups
  }
  return best
}

/** The groups with any two whose colors ended closer than the least distance joined, the smaller into the bigger, until
 * none are: a join moves the joined color, so it is measured again. */
function joinNear(groups: WeightedColor[][]): WeightedColor[][] {
  const kept = groups.map((colors) => ({ colors, lab: toOklab(channelsOf(boxColor(colors))), cells: size(colors) }))
  for (;;) {
    kept.sort((a, b) => b.cells - a.cells)
    const small = kept.findIndex((group, at) => kept.slice(0, at).some((big) => colorDistance(big.lab, group.lab) < LEAST_COLOR_DISTANCE))
    if (small < 0) return kept.map((group) => group.colors)
    const [joining] = kept.splice(small, 1)
    const big = kept.find((group) => colorDistance(group.lab, joining!.lab) < LEAST_COLOR_DISTANCE)!
    big.colors = [...big.colors, ...joining!.colors]
    big.cells += joining!.cells
    big.lab = toOklab(channelsOf(boxColor(big.colors)))
  }
}

/** How many cells a group of sampled colors covers. */
function size(group: readonly WeightedColor[]): number {
  let cells = 0
  for (const color of group) cells += color.count
  return cells
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
 * they are (flat artwork, pixel art); more are chosen by difference (ticket 0890), never two within the least distance.
 * @internal The app reduces through pictureReducer; the tests reduce once. */
export function reducePictureColors(counts: ReadonlyMap<string, number>, maxColors: number): ReducedColors {
  return pictureReducer(counts)(maxColors)
}

/** A picture's reduction to any count, with the work every count shares done once: for asking again and again (ticket
 * 1163, reduceDelivering). */
export function pictureReducer(counts: ReadonlyMap<string, number>): (maxColors: number) => ReducedColors {
  const sampled: WeightedColor[] = [...counts].map(([hex, count]) => {
    const rgb = channelsOf(hex)
    return { hex, rgb, lab: toOklab(rgb), count }
  })
  const cut = medianCutter([...sampled])
  return (maxColors) => reduceSampled(sampled, maxColors, cut)
}

function reduceSampled(sampled: WeightedColor[], maxColors: number, cut: ReturnType<typeof medianCutter>): ReducedColors {
  const boxes = sampled.length === 0 ? [] : sampled.length <= maxColors ? sampled.map((color) => [color]) : groupByDifference(sampled, maxColors, cut)

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
